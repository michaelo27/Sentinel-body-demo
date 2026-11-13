//! Sentinel Body — agent account controller.
//!
//! Deployed on `agent-<id>.<sentinel-body-contract>`. The agent account is created
//! with NO full-access key; only this contract's code can act on its behalf.
//! Every mutating method asserts `predecessor_account_id == parent`, so only the
//! NFT contract can command the agent. Keep this wasm tiny: its bytes are locked
//! as storage in every agent account and dominate the mint cost.

use near_sdk::{
    env, near, require, AccountId, Allowance, NearToken, Promise, PublicKey,
};

/// Extra balance kept above the protocol storage requirement so the account
/// can never be reclaimed / can always pay for its own storage.
const RESERVE_BUFFER_YOCTO: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR

#[near(contract_state)]
pub struct AgentAccount {
    /// The NFT contract. The only account allowed to command this one.
    parent: AccountId,
    /// The single restricted function-call key, if one has been installed.
    worker_key: Option<PublicKey>,
}

impl Default for AgentAccount {
    fn default() -> Self {
        env::panic_str("AgentAccount must be initialized with new(parent)");
    }
}

#[near]
impl AgentAccount {
    /// Called by the parent NFT contract in the same receipt batch that creates
    /// and funds this account. `#[init]` guarantees one-time initialization.
    #[init]
    pub fn new(parent: AccountId) -> Self {
        require!(
            env::predecessor_account_id() == parent,
            "Only the declared parent can initialize an agent account"
        );
        Self { parent, worker_key: None }
    }

    fn assert_parent(&self) {
        require!(
            env::predecessor_account_id() == self.parent,
            "ERR_ONLY_PARENT: only the Sentinel Body NFT contract can command this agent"
        );
    }

    /// View: proves the account has exactly one restricted worker key and that
    /// its public key is known. No full-access key is ever created here.
    pub fn worker_key(&self) -> Option<PublicKey> {
        self.worker_key.clone()
    }

    pub fn parent(&self) -> AccountId {
        self.parent.clone()
    }

    /// Transfer NEAR out, always keeping the storage reserve.
    pub fn withdraw(&mut self, to: AccountId, amount: NearToken) -> Promise {
        self.assert_parent();
        let storage_reserve =
            (env::storage_usage() as u128) * env::storage_byte_cost().as_yoctonear() + RESERVE_BUFFER_YOCTO;
        let balance = env::account_balance().as_yoctonear();
        require!(amount.as_yoctonear() > 0, "ERR_ZERO_AMOUNT");
        require!(
            balance >= storage_reserve + amount.as_yoctonear(),
            "ERR_RESERVE: agent must keep enough NEAR for its own storage"
        );
        Promise::new(to).transfer(amount)
    }

    /// Replace the worker key. Deletes the old key and adds a function-call key
    /// limited to `receiver_id` + `method_names` with a small gas allowance.
    /// This is the "bring your own runtime" path.
    pub fn set_worker_key(
        &mut self,
        public_key: PublicKey,
        allowance: NearToken,
        receiver_id: AccountId,
        method_names: String,
    ) -> Promise {
        self.assert_parent();
        require!(!method_names.is_empty(), "ERR_EMPTY_METHOD_NAMES");
        let allowance = Allowance::limited(allowance)
            .expect("ERR_ZERO_ALLOWANCE: a limited key needs a non-zero allowance");

        let mut promise = Promise::new(env::current_account_id());
        if let Some(old) = self.worker_key.take() {
            promise = promise.delete_key(old);
        }
        self.worker_key = Some(public_key.clone());
        promise.add_access_key_allowance(public_key, allowance, receiver_id, method_names)
    }

    /// Human-readable on-chain description, useful for explorers.
    pub fn describe(&self) -> String {
        format!(
            "Sentinel Body agent controlled by {}; worker key: {:?}",
            self.parent, self.worker_key
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(predecessor: AccountId) {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(predecessor);
        b.current_account_id(accounts(1));
        b.account_balance(NearToken::from_near(2));
        b.storage_usage(10_000);
        testing_env!(b.build());
    }

    #[test]
    fn init_requires_parent() {
        ctx(accounts(0));
        let c = AgentAccount::new(accounts(0));
        assert_eq!(c.parent(), accounts(0));
        assert!(c.worker_key().is_none());
    }

    #[test]
    #[should_panic(expected = "Only the declared parent")]
    fn init_rejects_stranger() {
        ctx(accounts(2));
        AgentAccount::new(accounts(0));
    }

    #[test]
    #[should_panic(expected = "ERR_ONLY_PARENT")]
    fn stranger_cannot_withdraw() {
        ctx(accounts(0));
        let mut c = AgentAccount::new(accounts(0));
        ctx(accounts(2));
        let _ = c.withdraw(accounts(2), NearToken::from_millinear(1));
    }

    #[test]
    fn parent_can_withdraw_and_reserve_is_enforced() {
        ctx(accounts(0));
        let mut c = AgentAccount::new(accounts(0));
        let _ = c.withdraw(accounts(2), NearToken::from_millinear(10));
        // storage reserve = 10_000 * 1e19 + 0.01 NEAR = 0.11 NEAR of 2 NEAR
    }

    #[test]
    #[should_panic(expected = "ERR_RESERVE")]
    fn reserve_is_enforced() {
        ctx(accounts(0));
        let mut c = AgentAccount::new(accounts(0));
        let _ = c.withdraw(accounts(2), NearToken::from_near(100));
    }

    #[test]
    fn set_worker_key_tracks_single_key() {
        ctx(accounts(0));
        let mut c = AgentAccount::new(accounts(0));
        let pk: PublicKey = "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap();
        let _ = c.set_worker_key(
            pk.clone(),
            NearToken::from_millinear(250),
            accounts(0),
            "publish_snapshot".to_string(),
        );
        assert_eq!(c.worker_key(), Some(pk));
    }
}
