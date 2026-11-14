//! Append-only artwork registry in a separate storage key. The existing
//! SentinelBody Borsh state layout and all collection prefixes are unchanged.
//! Artwork is assigned by numeric token ID; no image or media hash may repeat.
use super::*;
use near_sdk::json_types::Base64VecU8;

const ART_KEY: &[u8] = b"SNTL:ARTWORK:V1";
const MAX_ARTWORKS: usize = 50;

#[derive(Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ArtworkEntry {
    pub name: String,
    pub media: String,
    pub media_hash: Base64VecU8,
}

fn read_registry() -> Option<Vec<ArtworkEntry>> {
    env::storage_read(ART_KEY).map(|bytes| {
        serde_json::from_slice(&bytes).expect("ERR_ART_REGISTRY_CORRUPT")
    })
}

impl SentinelBody {
    pub(crate) fn assert_artwork_available(&self, token_id: u64) {
        if let Some(entries) = read_registry() {
            require!((token_id as usize) < entries.len(), "ERR_ARTWORK_SOLD_OUT");
        }
    }

    pub(crate) fn apply_registered_artwork(&self, token_id: u64, metadata: &mut TokenMetadata) {
        if let Some(entries) = read_registry() {
            let art = entries.get(token_id as usize).expect("ERR_ARTWORK_NOT_REGISTERED");
            metadata.title = Some(format!("Sentinel Body #{} — {}", token_id, art.name));
            metadata.description = Some("A Sentinel Body collectible linked to a NEAR agent account. Holding a qualifying token grants holder-tool access. Monitoring runs off-chain; ownership does not promise autonomous AI activity or financial returns.".to_string());
            metadata.media = Some(art.media.clone());
            metadata.media_hash = Some(art.media_hash.clone());
            metadata.copies = Some(1);
            metadata.updated_at = Some(env::block_timestamp_ms().to_string());
            let mut extra: serde_json::Value = metadata.extra.as_ref()
                .and_then(|text| serde_json::from_str(text).ok())
                .unwrap_or_else(|| json!({}));
            require!(extra.is_object(), "ERR_EXISTING_EXTRA_NOT_OBJECT");
            extra["artwork"] = json!({"version":1,"edition":token_id,"name":art.name,"assignment":"token-id; append-only registry"});
            metadata.extra = Some(extra.to_string());
            // Preserve existing reference and all agent/genesis data in extra.
        }
    }
}

#[near]
impl SentinelBody {
    /// Public assignment manifest. Empty means legacy media is still active.
    pub fn collection_artwork(&self) -> Vec<ArtworkEntry> {
        read_registry().unwrap_or_default()
    }

    /// Register the initial set or append new entries. Existing assignments
    /// cannot be edited/reordered through this method. Pause first and wait
    /// for all provisioning callbacks to finish. Supply is bounded by entries.
    /// Attach storage deposit; surplus is refunded to the admin.
    #[payable]
    pub fn append_collection_artwork(&mut self, entries: Vec<ArtworkEntry>) {
        self.assert_admin();
        require!(self.paused, "ERR_PAUSE_BEFORE_ARTWORK_UPDATE");
        require!(!entries.is_empty(), "ERR_EMPTY_ARTWORK_BATCH");
        let old = read_registry();
        let initial = old.is_none();
        let mut all = old.unwrap_or_default();
        require!(all.len() + entries.len() <= MAX_ARTWORKS, "ERR_ARTWORK_LIMIT_50");
        // No in-flight mint may cross initial registry activation.
        require!(self.next_token_id <= MAX_ARTWORKS as u64, "ERR_EXISTING_SUPPLY_TOO_LARGE");
        for id in 0..self.next_token_id {
            require!(self.pending.get(&id).is_none(), "ERR_PENDING_MINT_WAIT");
        }
        for art in entries {
            require!(!art.name.trim().is_empty() && art.name.len() <= 80, "ERR_ARTWORK_NAME");
            require!(art.media.starts_with("https://") && art.media.len() <= 512 && !art.media.chars().any(char::is_whitespace), "ERR_ARTWORK_HTTPS_URL");
            require!(art.media_hash.0.len() == 32, "ERR_ARTWORK_HASH_32_BYTES");
            require!(!all.iter().any(|a| a.media == art.media || a.media_hash.0 == art.media_hash.0), "ERR_DUPLICATE_ARTWORK");
            all.push(art);
        }
        require!(all.len() as u64 >= self.next_token_id, "ERR_ARTWORK_MUST_COVER_EXISTING_IDS");
        let before = env::storage_usage();
        env::storage_write(ART_KEY, &serde_json::to_vec(&all).expect("serialize artwork registry"));
        if initial {
            // Token media URLs are absolute HTTPS URLs, not localhost-relative.
            self.metadata.base_uri = None;
            for id in 0..self.next_token_id {
                let token_id = id.to_string();
                if self.tokens.owner_by_id.get(&token_id).is_none() { continue; }
                let mut metadata = self.tokens.token_metadata_by_id.as_ref()
                    .expect("ERR_TOKEN_METADATA_DISABLED").get(&token_id)
                    .expect("ERR_EXISTING_TOKEN_METADATA_MISSING");
                self.apply_registered_artwork(id, &mut metadata);
                self.tokens.token_metadata_by_id.as_mut().expect("metadata map")
                    .insert(&token_id, &metadata);
            }
        }
        let bytes = env::storage_usage().saturating_sub(before);
        let cost = (bytes as u128).checked_mul(env::storage_byte_cost().as_yoctonear())
            .expect("storage cost overflow");
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= cost, "ERR_ARTWORK_STORAGE_DEPOSIT");
        if attached > cost {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(attached-cost)).detach();
        }
        emit("collection_artwork_registered", json!({"initial":initial,"registered":all.len(),"existing_tokens_updated":if initial {self.tokens.owner_by_id.len()} else {0},"storage_bytes":bytes}));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{testing_env, test_utils::{accounts, VMContextBuilder}};
    fn context(who:AccountId) {
        let mut b=VMContextBuilder::new();
        b.current_account_id(accounts(0)).predecessor_account_id(who.clone()).signer_account_id(who)
            .account_balance(NearToken::from_near(100)).attached_deposit(NearToken::from_near(1));
        testing_env!(b.build());
    }
    fn setup()->SentinelBody {
        context(accounts(0));
        let mut c=SentinelBody::new(accounts(0),"ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp".parse().unwrap(),"http://localhost:8787".into(),20);
        c.paused=true;c
    }
    fn art(n:u8)->ArtworkEntry {
        ArtworkEntry{name:format!("Variant {n}"),media:format!("https://example.com/{n}.webp"),media_hash:Base64VecU8(vec![n;32])}
    }
    #[test]
    fn existing_ownership_agent_and_extra_survive_assignment() {
        let mut c=setup();let a:AccountId="agent-0.alice".parse().unwrap();
        c.tokens.internal_mint_with_refund("0".into(),accounts(1),Some(TokenMetadata{extra:Some(json!({"agent_account":a,"genesis_block":42}).to_string()),..Default::default()}),None);
        c.agent_of_token.insert(&0,&a);c.token_of_agent.insert(&a,&0);c.next_token_id=1;
        let state_before=near_sdk::borsh::to_vec(&c).unwrap();
        c.append_collection_artwork(vec![art(0),art(1)]);
        assert_eq!(c.tokens.owner_by_id.get(&"0".to_string()),Some(accounts(1)));
        assert_eq!(c.agent_account_of("0".into()),Some(a));
        let m=c.tokens.token_metadata_by_id.as_ref().unwrap().get(&"0".to_string()).unwrap();
        assert_eq!(m.media,Some("https://example.com/0.webp".into()));
        assert_eq!(m.media_hash.unwrap().0,vec![0;32]);
        assert_eq!(serde_json::from_str::<serde_json::Value>(&m.extra.unwrap()).unwrap()["genesis_block"],42);
        assert_eq!(c.metadata.base_uri, None);
        c.metadata.base_uri = Some("http://localhost:8787".into());
        assert_eq!(state_before,near_sdk::borsh::to_vec(&c).unwrap(),"Other existing contract state fields/collection descriptors unchanged");
    }
    #[test]
    fn append_preserves_previous_assignment_and_new_mint_uses_id() {
        let mut c=setup();c.append_collection_artwork(vec![art(0)]);
        c.append_collection_artwork(vec![art(1)]);
        let entries=c.collection_artwork();assert_eq!(entries.len(),2);assert_eq!(entries[0].media,art(0).media);
        let mut m=TokenMetadata::default();c.apply_registered_artwork(1,&mut m);assert_eq!(m.media,Some(art(1).media));
    }
    #[test]
    #[should_panic(expected="ERR_ARTWORK_SOLD_OUT")]
    fn rejects_mint_beyond_registered_artworks(){let mut c=setup();c.append_collection_artwork(vec![art(0)]);c.assert_artwork_available(1);}
    #[test]
    #[should_panic(expected="ERR_DUPLICATE_ARTWORK")]
    fn duplicate_hash_rejected(){let mut c=setup();let mut a=art(1);a.media_hash=art(0).media_hash;c.append_collection_artwork(vec![art(0),a]);}
    #[test]
    #[should_panic(expected="ERR_ONLY_ADMIN")]
    fn non_admin_rejected(){let mut c=setup();context(accounts(2));c.append_collection_artwork(vec![art(0)]);}
    #[test]
    #[should_panic(expected="ERR_PAUSE_BEFORE_ARTWORK_UPDATE")]
    fn unpaused_rejected(){let mut c=setup();c.paused=false;c.append_collection_artwork(vec![art(0)]);}
    #[test]
    #[should_panic(expected="ERR_PENDING_MINT_WAIT")]
    fn pending_mint_rejected(){let mut c=setup();c.next_token_id=1;c.pending.insert(&0,&PendingMint{receiver:accounts(1),agent_account:accounts(2),deposit:0});c.append_collection_artwork(vec![art(0)]);}
    #[test]
    #[should_panic(expected="ERR_ARTWORK_MUST_COVER_EXISTING_IDS")]
    fn insufficient_artwork_coverage_rejected(){let mut c=setup();c.next_token_id=2;c.append_collection_artwork(vec![art(0)]);}
}
