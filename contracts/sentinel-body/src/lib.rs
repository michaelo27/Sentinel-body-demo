//! Sentinel Body — NFT contract, agent registry and snapshot commitments.
//!
//! * NEP-171 core, NEP-177 metadata, NEP-181 enumeration, NEP-297 events.
//! * `mint_agent` creates and funds `agent-<id>.<this>` in one batch of promises,
//!   deploys the embedded controller wasm, initializes it with `parent = this`,
//!   and adds ONE function-call key restricted to `publish_snapshot` on this
//!   contract. The agent account never receives a full-access key.
//! * `publish_snapshot` may only be called by a registered agent account, with
//!   `signer == predecessor` (i.e. signed by the agent's own restricted key).
//! * Only content hashes and provenance live on-chain; index values never do.

use near_contract_standards::non_fungible_token::{
    core::{NonFungibleTokenCore, NonFungibleTokenResolver},
    enumeration::NonFungibleTokenEnumeration,
    metadata::{
        NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
    },
    events::NftMint, NonFungibleToken, Token, TokenId,
};
use near_sdk::{
    borsh::{BorshDeserialize, BorshSerialize},
    collections::LookupMap,
    env, near, require,
    serde::{Deserialize, Serialize},
    serde_json::{self, json},
    AccountId, Allowance, BorshStorageKey, Gas, NearToken, Promise, PromiseError,
    PromiseOrValue, PublicKey,
};
use std::collections::HashMap;

/// Bytes of the controller contract. `scripts/build-contracts.sh` builds the
/// size-optimized wasm first and overwrites this file before this crate compiles.
const AGENT_WASM: &[u8] = include_bytes!("../res/agent_account.wasm");

/// Account record + access key + controller state + registry entries, in bytes.
/// An estimate, documented in contracts/README.md; the dominant term is wasm size.
const ACCOUNT_OVERHEAD_BYTES: u128 = 900;

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    NonFungibleToken,
    TokenMetadata,
    TokenEnumeration,
    Approval,
    AgentOfToken,
    TokenOfAgent,
    PendingMints,
    Snapshots,
    LastPublish,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct SnapshotCommitment {
    pub id: String,
    pub content_hash: String,
    pub token_id: String,
    pub agent_account: AccountId,
    pub block_timestamp: String,
    pub block_height: u64,
    pub methodology_version: String,
    pub observed_block_heights: String,
    pub uri_hint: String,
}

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct PendingMint {
    receiver: AccountId,
    agent_account: AccountId,
    deposit: u128,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractConfig {
    pub contract_id: AccountId,
    pub admin: AccountId,
    pub paused: bool,
    pub next_token_id: u64,
    pub mint_cost_yocto: String,
    pub controller_wasm_bytes: usize,
    pub seed_balance_near: String,
    pub worker_allowance_near: String,
    pub default_worker_key: PublicKey,
    pub min_publish_interval_seconds: u64,
    pub snapshot_limit: u32,
    pub gateway_base: String,
    pub storage_byte_cost_yocto: String,
}

#[near(contract_state)]
pub struct SentinelBody {
    tokens: NonFungibleToken,
    metadata: NFTContractMetadata,
    admin: AccountId,
    next_token_id: u64,
    agent_of_token: LookupMap<u64, AccountId>,
    token_of_agent: LookupMap<AccountId, u64>,
    pending: LookupMap<u64, PendingMint>,
    default_worker_key: PublicKey,
    worker_allowance: NearToken,
    seed_balance: NearToken,
    min_publish_interval_ns: u64,
    snapshot_seq: u64,
    snapshot_limit: u32,
    snapshots: LookupMap<u64, SnapshotCommitment>,
    last_publish_ns: LookupMap<AccountId, u64>,
    paused: bool,
    gateway_base: String,
}

impl Default for SentinelBody {
    fn default() -> Self {
        env::panic_str("SentinelBody must be initialized with new(...)")
    }
}

fn emit(event: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({
            "standard": "sentinel_body",
            "version": "1.0.0",
            "event": event,
            "data": [data]
        })
    ));
}

#[near]
impl SentinelBody {
    #[init]
    pub fn new(
        admin: AccountId,
        default_worker_key: PublicKey,
        gateway_base: String,
        min_publish_interval_seconds: u64,
    ) -> Self {
        require!(!env::state_exists(), "Already initialized");
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Sentinel Body".to_string(),
            symbol: "SNTNL".to_string(),
            icon: None,
            base_uri: Some(gateway_base.clone()),
            reference: None,
            reference_hash: None,
        };
        metadata.assert_valid();
        // The agent account itself must be able to stake the storage for the
        // embedded controller wasm (1 NEAR / 100 KB), plus an operating buffer.
        // This is why minting a Sentinel costs ~1.9 NEAR of TESTNET tokens
        // rather than the ~0.01 NEAR of a typical NFT. See contracts/README.md.
        let controller_storage = (AGENT_WASM.len() as u128 + ACCOUNT_OVERHEAD_BYTES)
            * env::storage_byte_cost().as_yoctonear();
        let seed_balance = NearToken::from_yoctonear(
            controller_storage + NearToken::from_millinear(350).as_yoctonear(),
        );
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                admin.clone(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::TokenEnumeration),
                Some(StorageKey::Approval),
            ),
            metadata,
            admin,
            next_token_id: 0,
            agent_of_token: LookupMap::new(StorageKey::AgentOfToken),
            token_of_agent: LookupMap::new(StorageKey::TokenOfAgent),
            pending: LookupMap::new(StorageKey::PendingMints),
            default_worker_key,
            worker_allowance: NearToken::from_millinear(250),
            seed_balance,
            min_publish_interval_ns: min_publish_interval_seconds * 1_000_000_000,
            snapshot_seq: 0,
            snapshot_limit: 50,
            snapshots: LookupMap::new(StorageKey::Snapshots),
            last_publish_ns: LookupMap::new(StorageKey::LastPublish),
            paused: false,
            gateway_base,
        }
    }

    // ------------------------------------------------------------------ helpers
    fn assert_admin(&self) {
        require!(
            env::predecessor_account_id() == self.admin,
            "ERR_ONLY_ADMIN"
        );
    }

    fn assert_one_yocto(&self) {
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "ERR_REQUIRES_1_YOCTO: forces a wallet signature"
        );
    }

    fn assert_token_owner(&self, token_id: &str) {
        let owner = self
            .tokens
            .owner_by_id
            .get(&token_id.to_string())
            .unwrap_or_else(|| env::panic_str("ERR_UNKNOWN_TOKEN"));
        require!(
            owner == env::predecessor_account_id(),
            "ERR_NOT_TOKEN_OWNER: this action moves with the NFT"
        );
    }

    fn mint_cost_yocto(&self) -> u128 {
        // seed_balance already includes the controller's storage cost; the rest
        // is allowance headroom and a gas/buffer margin kept by the contract.
        let gas_headroom = NearToken::from_millinear(60).as_yoctonear();
        self.seed_balance.as_yoctonear()
            + self.worker_allowance.as_yoctonear()
            + gas_headroom
    }

    // -------------------------------------------------------------------- views
    /// Deposit required by `mint_agent`, in yoctoNEAR. Call before minting.
    pub fn mint_cost(&self) -> near_sdk::json_types::U128 {
        near_sdk::json_types::U128(self.mint_cost_yocto())
    }

    pub fn agent_account_of(&self, token_id: String) -> Option<AccountId> {
        token_id.parse::<u64>().ok().and_then(|id| self.agent_of_token.get(&id))
    }

    pub fn token_of_agent(&self, account_id: AccountId) -> Option<String> {
        self.token_of_agent.get(&account_id).map(|id| id.to_string())
    }

    pub fn is_holder(&self, account_id: AccountId) -> bool {
        self.tokens.nft_supply_for_owner(account_id).0 > 0
    }

    pub fn config(&self) -> ContractConfig {
        ContractConfig {
            contract_id: env::current_account_id(),
            admin: self.admin.clone(),
            paused: self.paused,
            next_token_id: self.next_token_id,
            mint_cost_yocto: self.mint_cost_yocto().to_string(),
            controller_wasm_bytes: AGENT_WASM.len(),
            seed_balance_near: (self.seed_balance.as_yoctonear() as f64 / 1e24).to_string(),
            worker_allowance_near: (self.worker_allowance.as_yoctonear() as f64 / 1e24)
                .to_string(),
            default_worker_key: self.default_worker_key.clone(),
            min_publish_interval_seconds: self.min_publish_interval_ns / 1_000_000_000,
            snapshot_limit: self.snapshot_limit,
            gateway_base: self.gateway_base.clone(),
            storage_byte_cost_yocto: env::storage_byte_cost().as_yoctonear().to_string(),
        }
    }

    // --------------------------------------------------------------------- mint
    #[payable]
    pub fn mint_agent(&mut self, receiver_id: Option<AccountId>) -> Promise {
        require!(!self.paused, "ERR_PAUSED");
        let receiver = receiver_id.unwrap_or_else(|| env::predecessor_account_id());
        let deposit = env::attached_deposit();
        require!(
            deposit.as_yoctonear() >= self.mint_cost_yocto(),
            "ERR_INSUFFICIENT_DEPOSIT: call mint_cost() and attach that amount"
        );

        let token_id = self.next_token_id;
        self.next_token_id += 1;
        let agent_account: AccountId = format!("agent-{}.{}", token_id, env::current_account_id())
            .parse()
            .expect("valid agent subaccount id");
        self.pending.insert(
            &token_id,
            &PendingMint {
                receiver: receiver.clone(),
                agent_account: agent_account.clone(),
                deposit: deposit.as_yoctonear(),
            },
        );

        let parent = env::current_account_id();
        let init_args = json!({ "parent": parent }).to_string().into_bytes();
        let allowance = Allowance::limited(self.worker_allowance)
            .expect("worker allowance must be non-zero");

        emit(
            "agent_provisioning_started",
            json!({
                "token_id": token_id.to_string(),
                "agent_account": agent_account,
                "receiver_id": receiver,
                "deposit": deposit.as_yoctonear().to_string()
            }),
        );

        Promise::new(agent_account.clone())
            .create_account()
            .transfer(self.seed_balance)
            .deploy_contract(AGENT_WASM.to_vec())
            .function_call(
                "new".to_string(),
                init_args,
                NearToken::from_yoctonear(0),
                Gas::from_tgas(100),
            )
            .add_access_key_allowance(
                self.default_worker_key.clone(),
                allowance,
                parent.clone(),
                "publish_snapshot".to_string(),
            )
            .then(
                Self::ext(parent)
                    .with_static_gas(Gas::from_tgas(90))
                    .on_agent_created(token_id, agent_account, receiver, deposit),
            )
    }

    /// Admin-only Genesis mint (token 0). Ensures snapshots can flow before any
    /// user mints. Genesis is always a valid publisher.
    #[payable]
    pub fn mint_genesis(&mut self) -> Promise {
        self.assert_admin();
        require!(self.next_token_id == 0, "ERR_GENESIS_ALREADY_EXISTS");
        self.mint_agent(Some(self.admin.clone()))
    }

    #[private]
    pub fn on_agent_created(
        &mut self,
        token_id: u64,
        agent_account: AccountId,
        receiver_id: AccountId,
        deposit: NearToken,
        #[callback_result] result: Result<(), PromiseError>,
    ) {
        self.pending.remove(&token_id);
        if result.is_err() {
            // Roll the counter back and refund the whole deposit. No NFT exists.
            if self.next_token_id == token_id + 1 {
                self.next_token_id = token_id;
            }
            Promise::new(receiver_id.clone()).transfer(deposit).detach();
            emit(
                "agent_provisioning_failed",
                json!({ "token_id": token_id.to_string(), "refunded_to": receiver_id }),
            );
            return;
        }

        self.agent_of_token.insert(&token_id, &agent_account);
        self.token_of_agent.insert(&agent_account, &token_id);

        let extra = json!({
            "agent_account": agent_account,
            "genesis_block": env::block_height(),
            "controller": "near-sdk 5.30.1",
        })
        .to_string();
        let token_metadata = TokenMetadata {
            title: Some(format!("Sentinel Body #{}", token_id)),
            description: Some(
                "A living AI agent. Holding this body unlocks the live, verifiable intelligence vault; transferring it transfers the agent and the access right.".to_string(),
            ),
            media: Some(format!("{}/api/nft/{}/art.svg", self.gateway_base, token_id)),
            // Deliberately None: the SVG is dynamic (state-reactive), so a static
            // content hash would be wrong. See contracts/README.md.
            media_hash: None,
            copies: Some(1),
            issued_at: None,
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: Some(extra),
            reference: None,
            reference_hash: None,
        };
        // A private callback has no attached deposit, so use the no-refund
        // variant and emit the standard NEP-297 mint event explicitly.
        let token = self.tokens.internal_mint_with_refund(
            token_id.to_string(),
            receiver_id.clone(),
            Some(token_metadata),
            None,
        );
        NftMint {
            owner_id: &token.owner_id,
            token_ids: &[&token.token_id],
            memo: None,
        }
        .emit();

        let refund = deposit
            .as_yoctonear()
            .saturating_sub(self.mint_cost_yocto());
        if refund > 0 {
            Promise::new(receiver_id.clone())
                .transfer(NearToken::from_yoctonear(refund))
                .detach();
        }
        emit(
            "agent_born",
            json!({
                "token_id": token_id.to_string(),
                "agent_account": agent_account,
                "owner_id": receiver_id,
                "genesis_block": env::block_height()
            }),
        );
    }

    // ----------------------------------------------- owner-gated agent control
    /// Synchronous ownership check + 1 yoctoNEAR to force a wallet signature.
    #[payable]
    pub fn agent_withdraw(
        &mut self,
        token_id: String,
        to: AccountId,
        amount: NearToken,
    ) -> Promise {
        self.assert_one_yocto();
        self.assert_token_owner(&token_id);
        let agent = self
            .agent_account_of(token_id.clone())
            .unwrap_or_else(|| env::panic_str("ERR_NO_AGENT_FOR_TOKEN"));
        let args = json!({ "to": to, "amount": amount }).to_string().into_bytes();
        Promise::new(agent).function_call(
            "withdraw".to_string(),
            args,
            NearToken::from_yoctonear(1),
            Gas::from_tgas(30),
        )
    }

    /// Bring your own runtime: rotate the agent's restricted function-call key.
    #[payable]
    pub fn agent_set_worker_key(
        &mut self,
        token_id: String,
        public_key: PublicKey,
        allowance: NearToken,
    ) -> Promise {
        self.assert_one_yocto();
        self.assert_token_owner(&token_id);
        let agent = self
            .agent_account_of(token_id.clone())
            .unwrap_or_else(|| env::panic_str("ERR_NO_AGENT_FOR_TOKEN"));
        let args = json!({
            "public_key": public_key,
            "allowance": allowance,
            "receiver_id": env::current_account_id(),
            "method_names": "publish_snapshot"
        })
        .to_string()
        .into_bytes();
        Promise::new(agent).function_call(
            "set_worker_key".to_string(),
            args,
            NearToken::from_yoctonear(1),
            Gas::from_tgas(30),
        )
    }

    // ------------------------------------------------------ snapshot commitments
    /// Called by the agent runtime, signed with the agent account's restricted
    /// function-call key. `signer == predecessor` prevents relaying.
    pub fn publish_snapshot(
        &mut self,
        snapshot_id: String,
        content_hash: String,
        methodology_version: String,
        observed_block_heights: String,
        uri_hint: String,
    ) {
        let signer = env::signer_account_id();
        let predecessor = env::predecessor_account_id();
        require!(
            signer == predecessor,
            "ERR_SIGNER_MUST_BE_AGENT: publish_snapshot cannot be relayed"
        );
        let token_id = self
            .token_of_agent
            .get(&predecessor)
            .unwrap_or_else(|| env::panic_str("ERR_UNREGISTERED_AGENT"));
        require!(
            self.tokens.owner_by_id.contains_key(&token_id.to_string()),
            "ERR_AGENT_NOT_ACTIVE"
        );
        require!(content_hash.len() == 64, "ERR_HASH_LENGTH: expected 64 hex chars");
        require!(
            content_hash
                .bytes()
                .all(|b| (b'0'..=b'9').contains(&b) || (b'a'..=b'f').contains(&b)),
            "ERR_HASH_FORMAT: expected lowercase hex SHA-256"
        );
        require!(snapshot_id.len() <= 128, "ERR_ID_TOO_LONG");
        require!(!methodology_version.is_empty(), "ERR_METHODOLOGY_REQUIRED");

        let now_ns = env::block_timestamp_ms() * 1_000_000;
        if let Some(last) = self.last_publish_ns.get(&predecessor) {
            require!(
                now_ns.saturating_sub(last) >= self.min_publish_interval_ns,
                "ERR_RATE_LIMIT: minimum publish interval not elapsed"
            );
        }
        self.last_publish_ns.insert(&predecessor, &now_ns);

        let seq = self.snapshot_seq;
        self.snapshot_seq += 1;
        let commitment = SnapshotCommitment {
            id: snapshot_id.clone(),
            content_hash: content_hash.clone(),
            token_id: token_id.to_string(),
            agent_account: predecessor.clone(),
            block_timestamp: env::block_timestamp_ms().to_string(),
            block_height: env::block_height(),
            methodology_version,
            observed_block_heights,
            uri_hint,
        };
        self.snapshots.insert(&seq, &commitment);
        // Bounded storage: keep only the newest `snapshot_limit` commitments.
        if seq >= self.snapshot_limit as u64 {
            self.snapshots.remove(&(seq - self.snapshot_limit as u64));
        }
        emit(
            "snapshot_published",
            json!({
                "snapshot_id": snapshot_id,
                "content_hash": content_hash,
                "token_id": token_id.to_string(),
                "agent_account": predecessor,
                "sequence": seq,
                "methodology_version": commitment.methodology_version
            }),
        );
    }

    /// NEP-413 fallback: a wallet without signMessage sends this transaction.
    /// The gateway reads the receipt logs via the `tx` RPC and verifies the nonce.
    pub fn attest_holder(&self, nonce: String) {
        require!(nonce.len() >= 16 && nonce.len() <= 128, "ERR_BAD_NONCE");
        require!(
            self.is_holder(env::predecessor_account_id()),
            "ERR_NOT_HOLDER"
        );
        emit(
            "holder_attested",
            json!({
                "account_id": env::predecessor_account_id(),
                "nonce": nonce,
                "block_height": env::block_height()
            }),
        );
    }

    pub fn latest_snapshot(&self) -> Option<SnapshotCommitment> {
        if self.snapshot_seq == 0 {
            return None;
        }
        self.snapshots.get(&(self.snapshot_seq - 1))
    }

    pub fn snapshots(&self, from: u64, limit: u32) -> Vec<SnapshotCommitment> {
        let first = if self.snapshot_seq > self.snapshot_limit as u64 {
            self.snapshot_seq - self.snapshot_limit as u64
        } else {
            0
        };
        let start = from.max(first);
        let end = (start + limit.min(50) as u64).min(self.snapshot_seq);
        (start..end)
            .filter_map(|i| self.snapshots.get(&i))
            .collect()
    }

    pub fn snapshot_by_id(&self, id: String) -> Option<SnapshotCommitment> {
        let first = if self.snapshot_seq > self.snapshot_limit as u64 {
            self.snapshot_seq - self.snapshot_limit as u64
        } else {
            0
        };
        (first..self.snapshot_seq).find_map(|i| {
            self.snapshots
                .get(&i)
                .filter(|c| c.id == id)
        })
    }

    // -------------------------------------------------------------------- admin
    pub fn set_default_worker_key(&mut self, public_key: PublicKey) {
        self.assert_admin();
        self.default_worker_key = public_key;
    }

    pub fn set_min_publish_interval(&mut self, seconds: u64) {
        self.assert_admin();
        require!(seconds <= 3600, "ERR_INTERVAL_TOO_LARGE");
        self.min_publish_interval_ns = seconds * 1_000_000_000;
    }

    pub fn set_snapshot_limit(&mut self, limit: u32) {
        self.assert_admin();
        require!(limit >= 1 && limit <= 200, "ERR_BAD_LIMIT");
        self.snapshot_limit = limit;
    }

    pub fn pause(&mut self) {
        self.assert_admin();
        self.paused = true;
    }

    pub fn unpause(&mut self) {
        self.assert_admin();
        self.paused = false;
    }
}

// -------------------------------------------------------------- NEP-171 core
#[near]
impl NonFungibleTokenCore for SentinelBody {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens
            .nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens
            .nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for SentinelBody {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id,
            approved_account_ids,
        )
    }
}

#[near]
impl NonFungibleTokenEnumeration for SentinelBody {
    fn nft_total_supply(&self) -> near_sdk::json_types::U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(
        &self,
        from_index: Option<near_sdk::json_types::U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> near_sdk::json_types::U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<near_sdk::json_types::U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for SentinelBody {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.clone()
    }
}

// --------------------------------------------------------------- unit tests
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn pk() -> PublicKey {
        "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap()
    }

    fn meta() -> TokenMetadata {
        TokenMetadata { title: Some("Sentinel Body #test".into()), ..Default::default() }
    }

    fn setup(predecessor: AccountId, deposit: u128) -> SentinelBody {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(predecessor.clone());
        b.signer_account_id(predecessor.clone());
        b.current_account_id(accounts(0));
        b.attached_deposit(NearToken::from_yoctonear(deposit));
        b.account_balance(NearToken::from_near(100));
        testing_env!(b.build());
        SentinelBody::new(
            accounts(0),
            pk(),
            "https://vault.example".to_string(),
            20,
        )
    }

    #[test]
    fn mint_cost_is_dominated_by_controller_wasm() {
        let c = setup(accounts(0), 0);
        let cost = c.mint_cost().0;
        assert!(cost > AGENT_WASM.len() as u128 * 10_000_000_000_000_000_000);
        assert_eq!(c.config().controller_wasm_bytes, AGENT_WASM.len());
    }

    #[test]
    fn hash_validation_rules() {
        let mut c = setup(accounts(0), 0);
        let agent: AccountId = "agent-0.sentinel-body.testnet".parse().unwrap();
        c.token_of_agent.insert(&agent, &0);
        c.tokens.internal_mint_with_refund("0".into(), accounts(0), Some(meta()), None);
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(agent.clone());
        b.signer_account_id(agent.clone());
        b.current_account_id(accounts(0));
        b.block_timestamp(1_000_000u64 * 1_000_000);
        testing_env!(b.build());
        let good = "a".repeat(64);
        c.publish_snapshot(
            "s1".into(),
            good.clone(),
            "v1".into(),
            "{}".into(),
            "".into(),
        );
        assert_eq!(c.latest_snapshot().unwrap().content_hash, good);
    }

    #[test]
    #[should_panic(expected = "ERR_HASH_LENGTH")]
    fn rejects_short_hash() {
        let mut c = setup(accounts(0), 0);
        let agent: AccountId = "agent-0.sentinel-body.testnet".parse().unwrap();
        c.token_of_agent.insert(&agent, &0);
        c.tokens.internal_mint_with_refund("0".into(), accounts(0), Some(meta()), None);
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(agent.clone());
        b.signer_account_id(agent.clone());
        b.current_account_id(accounts(0));
        testing_env!(b.build());
        c.publish_snapshot("s".into(), "abc".into(), "v1".into(), "{}".into(), "".into());
    }

    #[test]
    #[should_panic(expected = "ERR_SIGNER_MUST_BE_AGENT")]
    fn relayed_publish_fails() {
        let mut c = setup(accounts(0), 0);
        let agent: AccountId = "agent-0.sentinel-body.testnet".parse().unwrap();
        c.token_of_agent.insert(&agent, &0);
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(agent.clone());
        b.signer_account_id(accounts(2));
        b.current_account_id(accounts(0));
        testing_env!(b.build());
        c.publish_snapshot("s".into(), "a".repeat(64), "v1".into(), "{}".into(), "".into());
    }

    #[test]
    fn prune_keeps_storage_bounded() {
        let mut c = setup(accounts(0), 0);
        let agent: AccountId = "agent-0.sentinel-body.testnet".parse().unwrap();
        c.token_of_agent.insert(&agent, &0);
        c.tokens.internal_mint_with_refund("0".into(), accounts(0), Some(meta()), None);
        c.set_snapshot_limit(3);
        for i in 0..6 {
            let mut b = VMContextBuilder::new();
            b.predecessor_account_id(agent.clone());
            b.signer_account_id(agent.clone());
            b.current_account_id(accounts(0));
            b.block_timestamp((1_000_000u64 + (i as u64 + 1) * 60_000) * 1_000_000);
            testing_env!(b.build());
            c.publish_snapshot(
                format!("s{}", i),
                "a".repeat(64),
                "v1".into(),
                "{}".into(),
                "".into(),
            );
        }
        assert_eq!(c.snapshots(0, 50).len(), 3);
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_TOKEN_OWNER")]
    fn non_owner_cannot_withdraw() {
        let mut c = setup(accounts(2), 1);
        c.tokens.internal_mint_with_refund("0".into(), accounts(0), Some(meta()), None);
        let _ = c.agent_withdraw("0".into(), accounts(2), NearToken::from_millinear(1));
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_HOLDER")]
    fn non_holder_cannot_attest() {
        let c = setup(accounts(2), 0);
        c.attest_holder("a-nonce-that-is-long-enough".into());
    }
}
