//! Opt-in local sandbox test; no public testnet keys or funds.
//! Build WASM first: bash scripts/build-contracts.sh
use near_workspaces::types::NearToken;
use serde_json::{json, Value};

#[tokio::test]
async fn genesis_transfer_changes_holder_and_keeps_agent() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/near/sentinel-body.wasm");
    let contract = worker.dev_deploy(&std::fs::read(wasm_path)?).await?;
    let admin = worker.dev_create_account().await?;
    let recipient = worker.dev_create_account().await?;
    contract.call("new").args_json(json!({
        "admin": admin.id(),
        "default_worker_key": admin.secret_key().public_key().to_string(),
        "gateway_base": "http://127.0.0.1:8787",
        "min_publish_interval_seconds": 0
    })).transact().await?.into_result()?;
    let cfg: Value = contract.view("config").args_json(json!({})).await?.json()?;
    let cost: u128 = cfg["mint_cost_yocto"].as_str().unwrap().parse()?;
    admin.call(contract.id(), "mint_genesis").args_json(json!({}))
        .deposit(NearToken::from_yoctonear(cost + 100_000_000_000_000_000_000_000))
        .max_gas().transact().await?.into_result()?;
    let token: Value = contract.view("nft_token").args_json(json!({"token_id":"0"})).await?.json()?;
    assert_eq!(token["owner_id"], admin.id().as_str());
    let before: Value = contract.view("agent_account_of").args_json(json!({"token_id":"0"})).await?.json()?;
    assert!(before.is_string());
    admin.call(contract.id(), "nft_transfer")
        .args_json(json!({"receiver_id":recipient.id(), "token_id":"0"}))
        .deposit(NearToken::from_yoctonear(1)).max_gas().transact().await?.into_result()?;
    let old_holder: bool = contract.view("is_holder").args_json(json!({"account_id":admin.id()})).await?.json()?;
    let new_holder: bool = contract.view("is_holder").args_json(json!({"account_id":recipient.id()})).await?.json()?;
    assert!(!old_holder);
    assert!(new_holder);
    let after: Value = contract.view("agent_account_of").args_json(json!({"token_id":"0"})).await?.json()?;
    assert_eq!(before, after);
    Ok(())
}
