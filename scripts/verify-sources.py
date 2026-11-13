#!/usr/bin/env python3
"""Sentinel Body — evidence collector for docs/SOURCES.md.

Makes REAL requests to every candidate endpoint and writes machine-readable
results to config/sources.json. No endpoint is trusted until it appears here
with a 2xx and a recorded response shape. Re-run with:
    python3 scripts/verify-sources.py

Everything here is read-only. No keys, no paid endpoints, no NEAR Lake S3.
"""
from __future__ import annotations
import concurrent.futures as cf
import json
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHECKED = datetime.now(timezone.utc).isoformat(timespec="seconds")
UA = "SentinelBody/0.1 (NEAR hackathon MVP; public-data demo; read-only)"
TIMEOUT = 20
# 2026-11-12: rpc.{mainnet,testnet}.near.org now answer every JSON-RPC call with
# 429 "THIS ENDPOINT IS DEPRECATED! ... Switch to https://fastnear.com". FastNEAR
# is therefore PRIMARY for data reads; Foundation nodes are kept last as a
# last-resort fallback and health-checked so their status is visible.
MAIN = "https://free.rpc.fastnear.com"
TEST = "https://test.rpc.fastnear.com"
MAIN_DEPRECATED = "https://rpc.mainnet.near.org"
TEST_DEPRECATED = "https://rpc.testnet.near.org"

EXPECTED_DEGRADED = {
    "status:rpc.mainnet.near.org", "jsonrpc-status:rpc.mainnet.near.org",
    "status:rpc.testnet.near.org", "jsonrpc-status:rpc.testnet.near.org",
    "status:near-testnet.drpc.org", "nearblocks:v1_retired",
    "solana:getFees_removed", "explorer:testnet_tx",
    # deliberate negative controls: their RPC error IS the verified fact
    "mainnet:archival:-100000",                  # GARBAGE_COLLECTED_BLOCK boundary
    "testnet:view_account:sentinel-body.testnet",  # UNKNOWN_ACCOUNT => name is available
}


def rpc(method: str, params=None) -> dict:
    return {"jsonrpc": "2.0", "id": "sentinel-verify", "method": method,
            "params": params if params is not None else []}


def view_account(account_id: str, extra: dict | None = None) -> dict:
    return rpc("query", {"request_type": "view_account", "account_id": account_id,
                         **(extra or {"finality": "final"})})


def view_call(account_id: str, method_name: str, args: dict) -> dict:
    import base64
    return rpc("query", {"request_type": "call_function", "account_id": account_id,
                         "method_name": method_name,
                         "args_base64": base64.b64encode(
                             json.dumps(args, separators=(",", ":")).encode()).decode(),
                         "finality": "final"})


def access_keys(account_id: str) -> dict:
    return rpc("query", {"request_type": "view_access_key_list",
                         "account_id": account_id, "finality": "final"})


USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"  # Circle docs: bare 64-hex, NO .near suffix


MAIN_FALLBACKS = [MAIN, "https://near-testnet.drpc.org" if False else MAIN_DEPRECATED]
TEST_FALLBACKS = [TEST, "https://near-testnet.drpc.org", TEST_DEPRECATED]


def post_json(urls, method: str, params, timeout=TIMEOUT):
    """Ordered fallbacks + exponential backoff. Mirrors the runtime RPC client."""
    urls = [urls] if isinstance(urls, str) else urls
    last = None
    for url in urls:
        for attempt in range(3):
            body = json.dumps(rpc(method, params)).encode()
            req = urllib.request.Request(url, data=body, headers={
                "Content-Type": "application/json", "User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=timeout,
                                           context=ssl.create_default_context()) as r:
                    return json.loads(r.read())
            except Exception as e:
                last = e
                time.sleep(0.4 * (2 ** attempt))
    raise RuntimeError(f"all RPC fallbacks failed: {last}")


def get_json(url: str, timeout=TIMEOUT):
    last = None
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout,
                                       context=ssl.create_default_context()) as r:
                return json.loads(r.read())
        except Exception as e:
            last = e
            time.sleep(0.4 * (2 ** attempt))
    raise RuntimeError(f"GET failed: {last}")


def build_checks(height: int, testnet_tx: str, faucet_key: str) -> list:
    """(id, label, method, url, body, headers, rate_limit_note)"""
    C = []
    add = lambda *a: C.append(a)

    # ---- RPC endpoints: GET /status + JSON-RPC POST status ----
    for cid, url, note in [
        ("test.rpc.fastnear.com", "https://test.rpc.fastnear.com", "PRIMARY testnet RPC. Free, no key. JSON-RPC POST works; GET /status works."),
        ("near-testnet.drpc.org", "https://near-testnet.drpc.org", "TESTNET FALLBACK #2. GET /status returns 404; JSON-RPC POST works."),
        ("free.rpc.fastnear.com", "https://free.rpc.fastnear.com", "PRIMARY mainnet RPC. Free, no key. Pinned-block reads work to ~86,400 blocks back."),
        ("rpc.testnet.near.org", "https://rpc.testnet.near.org", "DEPRECATED 2026-11-12: JSON-RPC returns 429 'THIS ENDPOINT IS DEPRECATED! STOP USING IT NOW! Switch to https://fastnear.com'. Last-resort only."),
        ("rpc.mainnet.near.org", "https://rpc.mainnet.near.org", "DEPRECATED 2026-11-12: JSON-RPC returns 429 deprecation notice. Last-resort only."),
    ]:
        add(f"status:{cid}", "NEAR RPC /status (health + chain_id + height)", "GET",
            f"{url}/status", None, {}, note)
        add(f"jsonrpc-status:{cid}", "JSON-RPC status method (POST /)", "POST",
            url, rpc("status"), {}, note)

    add("mainnet:gas_price", "gas_price at final block (yoctoNEAR per gas unit)", "POST",
        MAIN, rpc("gas_price", {"finality": "final"}), {}, "free RPC; cache 1 min")
    add("mainnet:EXPERIMENTAL_protocol_config", "EXPERIMENTAL_protocol_config: storage_amount_per_byte, gas costs", "POST",
        MAIN, rpc("EXPERIMENTAL_protocol_config", {"finality": "final"}), {}, "large JSON (~50KB); cache 10 min")
    add("mainnet:validators", "validators [null]: staking/validator cohort", "POST",
        MAIN, rpc("validators", [None]), {}, "params MUST be [null]; {finality:...} is a parse error")
    add("mainnet:block", "block by finality (pinned block heights)", "POST",
        MAIN, rpc("block", {"finality": "final"}), {}, "free RPC")
    for delta in (100, 1000, 10000, 43200, 86400, 100000):
        add(f"mainnet:archival:-{delta}", f"view_account at pinned block height latest-{delta} (24h delta feasibility)",
            "POST", MAIN, view_account("intents.near", {"block_id": height - delta}), {},
            "FastNEAR serves pinned state to ~86,400 blocks back (~12h). 100000+ is garbage collected; 24h Capital Flow therefore uses the documented snapshot-diff fallback.")
    for acct in ("intents.near", "wrap.near", "v2.ref-finance.near", "aurora",
                 "meta-pool.near", "linear-protocol.near", "dclv2.ref-labs.near",
                 "contract.main.burrow.near", USDC):
        add(f"mainnet:view_account:{acct}", f"cohort account existence + balance: {acct}",
            "POST", MAIN, view_account(acct), {}, "free RPC view call")
    add("mainnet:ft_metadata:wrap.near", "ft_metadata on wrap.near (NEP-141 shape)", "POST",
        MAIN, view_call("wrap.near", "ft_metadata", {}), {}, "free RPC view call")
    add("mainnet:ft_balance_of:wrap.near", "ft_balance_of on wrap.near for intents.near", "POST",
        MAIN, view_call("wrap.near", "ft_balance_of", {"account_id": "intents.near"}), {}, "free RPC view call")
    add("mainnet:ft_metadata:USDC", "ft_metadata on Circle native USDC (bare 64-hex account id)", "POST",
        MAIN, view_call(USDC, "ft_metadata", {}), {}, "free RPC view call")
    add("mainnet:ft_balance_of:USDC", "ft_balance_of USDC for intents.near", "POST",
        MAIN, view_call(USDC, "ft_balance_of", {"account_id": "intents.near"}), {}, "free RPC view call")
    add("mainnet:view_access_key_list", "view_access_key_list shape (agent key proof)", "POST",
        MAIN, access_keys("wrap.near"), {}, "TOO_MANY_ACCESS_KEYS for >100 keys; agent accounts have exactly 1")
    add("mainnet:view_code", "view_code shape (contract deployed check)", "POST",
        MAIN, rpc("query", {"request_type": "view_code", "account_id": "wrap.near",
                            "finality": "final"}), {}, "returns base64 wasm; large")
    add("testnet:view_access_key", "view_access_key single-key shape (NEP-413 pubkey check)", "POST",
        TEST, rpc("query", {"request_type": "view_access_key", "account_id": "faucet.testnet",
                            "public_key": faucet_key, "finality": "final"}), {}, "free RPC view call")
    add("testnet:tx", f"tx status for real tx {testnet_tx[:12]}... (attestation fallback)", "POST",
        TEST, rpc("tx", {"tx_hash": testnet_tx, "sender_account_id": "testnet",
                         "wait_until": "FINAL"}), {}, "free RPC; use wait_until=FINAL")
    add("testnet:gas_price", "testnet gas_price", "POST", TEST,
        rpc("gas_price", {"finality": "final"}), {}, "free RPC")
    add("testnet:EXPERIMENTAL_protocol_config", "testnet protocol config", "POST", TEST,
        rpc("EXPERIMENTAL_protocol_config", {"finality": "final"}), {}, "free RPC; cache 10 min")
    for acct in ("sentinel-body.testnet", "testnet"):
        add(f"testnet:view_account:{acct}", f"testnet account existence/name availability: {acct}",
            "POST", TEST, view_account(acct), {}, "free RPC view call")

    # ---- free data APIs ----
    add("coingecko:ping", "CoinGecko free API ping", "GET",
        "https://api.coingecko.com/api/v3/ping", None, {}, "free tier ~5-15 req/min; cache >=60s")
    add("coingecko:simple_price", "NEAR/ETH/SOL USD price (free simple/price)", "GET",
        "https://api.coingecko.com/api/v3/simple/price?ids=near,ethereum,solana&vs_currencies=usd&include_last_updated_at=true",
        None, {}, "free tier ~5-15 req/min; Cache-Control max-age=30; cache 60s + stale fallback")
    add("near_ai:models_api", "NEAR AI Cloud official machine-readable model catalog + pricing", "GET",
        "https://cloud-api.near.ai/v1/models", None, {}, "public catalog, no key for reads; Cache-Control no-store; cache locally")
    add("near_ai:pricing_page", "NEAR AI official published pricing page (USD per 1M tokens)", "GET",
        "https://near.ai/pricing", None, {}, "HTML; states rates come from catalog API; last-updated stamped on page")
    add("fastnear:api_root", "FastNEAR API docs (endpoint discovery)", "GET",
        "https://api.fastnear.com/", None, {}, "HTML docs; no key")
    add("fastnear:status", "FastNEAR API /status", "GET",
        "https://api.fastnear.com/status", None, {}, "free, no key")
    add("fastnear:health", "FastNEAR API /health", "GET",
        "https://api.fastnear.com/health", None, {}, "free, no key")
    add("fastnear:v1_account_ft", "FastNEAR /v1/account/{id}/ft (token balances)", "GET",
        "https://api.fastnear.com/v1/account/intents.near/ft", None, {}, "free, no key; large JSON; cache")
    add("fastnear:v1_ft_top", "FastNEAR /v1/ft/{token}/top (top holders)", "GET",
        "https://api.fastnear.com/v1/ft/wrap.near/top", None, {}, "free, no key")
    add("fastnear:v0_public_key", "FastNEAR /v0/public_key/{pk} (pubkey->account)", "GET",
        "https://api.fastnear.com/v0/public_key/ed25519:2dJjJWXgvSG6iMbLFnhjrZhttrznxS225Wfq8Ffqz3Up",
        None, {}, "free, no key")
    add("fastnear:testnet_status", "FastNEAR testnet API /status", "GET",
        "https://test.api.fastnear.com/status", None, {}, "free, no key")
    add("neardata:root", "FastNEAR NEAR Data Server docs", "GET",
        "https://mainnet.neardata.xyz/", None, {}, "HTML docs; free, no key for reads")
    add("neardata:last_block_final", "neardata /v0/last_block/final", "GET",
        "https://mainnet.neardata.xyz/v0/last_block/final", None, {}, "free; 302 redirect")
    add("neardata:first_block", "neardata /v0/first_block", "GET",
        "https://mainnet.neardata.xyz/v0/first_block", None, {}, "free; 302 redirect")
    add(f"neardata:block:{height}", "neardata /v0/block/{height} (full block + actions)", "GET",
        f"https://mainnet.neardata.xyz/v0/block/{height}", None, {}, "free + undocumented apiKey query param; ~170KB/block, sample sparsely")
    add("nearblocks:v3_txns", "NearBlocks API v3 txns (mainnet)", "GET",
        "https://api.nearblocks.io/v3/txns?limit=1", None, {}, "STRICT undocumented rate limit, no rate-limit headers; cache + exponential backoff")
    add("nearblocks:v3_blocks", "NearBlocks API v3 blocks (mainnet)", "GET",
        "https://api.nearblocks.io/v3/blocks?limit=1", None, {}, "STRICT; cache + backoff")
    add("nearblocks:v3_stats", "NearBlocks API v3 stats", "GET",
        "https://api.nearblocks.io/v3/stats", None, {}, "STRICT; cache + backoff")
    add("nearblocks:v3_testnet_txns", "NearBlocks API v3 txns (testnet)", "GET",
        "https://api-testnet.nearblocks.io/v3/txns?limit=1", None, {}, "STRICT; only v3 works (v1 retired 2026-11-05)")
    add("nearblocks:v3_testnet_account_keys", "NearBlocks API v3 account keys (testnet)", "GET",
        "https://api-testnet.nearblocks.io/v3/accounts/testnet/keys", None, {}, "STRICT; cache + backoff")
    add("nearblocks:v1_retired", "NearBlocks API v1 retirement notice (testnet returns 410)", "GET",
        "https://api-testnet.nearblocks.io/v1/txns?limit=1", None, {}, "v1/v2 switch off 2026-11-22; DO NOT BUILD ON v1")
    add("nearblocks:migration_docs", "NearBlocks v3 migration guide", "GET",
        "https://api.nearblocks.io/api-docs/migration", None, {}, "static markdown")
    add("eth:gasPrice:publicnode", "Ethereum public RPC eth_gasPrice", "POST",
        "https://ethereum-rpc.publicnode.com",
        {"jsonrpc": "2.0", "id": 1, "method": "eth_gasPrice", "params": []}, {}, "free public node; cache 60s")
    add("base:gasPrice", "Base public RPC eth_gasPrice", "POST",
        "https://mainnet.base.org",
        {"jsonrpc": "2.0", "id": 1, "method": "eth_gasPrice", "params": []}, {}, "free public node; cache 60s")
    add("solana:rent", "Solana getMinimumBalanceForRentExemption(128)", "POST",
        "https://api.mainnet-beta.solana.com",
        {"jsonrpc": "2.0", "id": 1, "method": "getMinimumBalanceForRentExemption", "params": [128]}, {},
        "public RPC has aggressive per-IP limits; use fallback + cache")
    add("solana:rent:publicnode", "Solana publicnode fallback RPC", "POST",
        "https://solana-rpc.publicnode.com",
        {"jsonrpc": "2.0", "id": 1, "method": "getMinimumBalanceForRentExemption", "params": [128]}, {}, "free fallback")
    add("solana:getFees_removed", "Solana getFees (DEPRECATED — record the error, do not use)", "POST",
        "https://api.mainnet-beta.solana.com",
        {"jsonrpc": "2.0", "id": 1, "method": "getFees", "params": []}, {}, "returns -32601 Method not found; use documented 5000 lamports/signature base fee")

    # ---- package versions ----
    NPM = ["near-api-js", "@near-wallet-selector/core", "@near-wallet-selector/meteor-wallet",
           "@near-wallet-selector/modal-ui", "next", "react", "tailwindcss", "zod",
           "fastify", "framer-motion", "sonner", "lucide-react", "d3-sankey", "borsh",
           "better-sqlite3"]
    for pkg in NPM:
        add(f"npm:{pkg}", f"npm registry latest version for {pkg}", "GET",
            f"https://registry.npmjs.org/{pkg.replace('/', '%2f')}/latest", None, {}, "registry metadata")
    for crate in ["near-sdk", "near-contract-standards", "near-workspaces", "cargo-near"]:
        add(f"crate:{crate}", f"crates.io latest version for {crate}", "GET",
            f"https://crates.io/api/v1/crates/{crate}", None, {}, "registry metadata")
    for repo in ["near/cargo-near", "near/near-cli-rs", "near/near-sdk-rs"]:
        add(f"github:{repo}", f"GitHub latest release for {repo}", "GET",
            f"https://api.github.com/repos/{repo}/releases/latest", None, {}, "unauthenticated 60 req/hr")

    # ---- standards / explorer URLs ----
    add("docs:NEP-413", "NEP-413 signMessage spec", "GET",
        "https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0413.md", None, {}, "static spec")
    add("docs:NEP-297", "NEP-297 event spec", "GET",
        "https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0297.md", None, {}, "static spec")
    add("docs:NEP-171", "NEP-171 NFT core spec", "GET",
        "https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0171.md", None, {}, "static spec")
    add("docs:NEP-177", "NEP-177 NFT metadata spec", "GET",
        "https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0177.md", None, {}, "static spec")
    add("docs:NEP-181", "NEP-181 NFT enumeration spec", "GET",
        "https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0181.md", None, {}, "static spec")
    add("explorer:testnet_tx", f"testnet.nearblocks.io/txns/{testnet_tx[:12]}... (Cloudflare-protected from sandbox)",
        "GET", f"https://testnet.nearblocks.io/txns/{testnet_tx}", None, {},
        "UI link target only; 403 from datacenter IP is expected, browsers pass the challenge")
    return C


def summarize(body: bytes, check_id: str):
    try:
        obj = json.loads(body)
    except Exception:
        return {"kind": "text", "sample": body[:200].decode("utf-8", "replace").replace("\n", " ")}
    if not isinstance(obj, dict):
        return {"kind": type(obj).__name__, "sample": str(obj)[:200]}
    out = {"kind": "json", "top_keys": sorted(obj.keys())[:24]}
    res = obj.get("result")
    if isinstance(res, dict):
        out["result_keys"] = sorted(res.keys())[:32]
        for k in ("chain_id", "latest_block_height", "amount", "block_hash", "block_height",
                  "code_hash", "storage_usage", "gas_price", "min_gas_price", "symbol",
                  "decimals", "nonce", "permission", "final_execution_status"):
            if k in res and not isinstance(res[k], (dict, list)):
                out[k] = res[k]
        if "sync_info" in res and isinstance(res["sync_info"], dict):
            out["sync_info_keys"] = sorted(res["sync_info"].keys())
            out["latest_block_height"] = res["sync_info"].get("latest_block_height")
        if isinstance(res.get("runtime_config"), dict):
            rc = res["runtime_config"]
            out["runtime_config_keys"] = sorted(rc.keys())[:24]
            out["storage_amount_per_byte"] = rc.get("storage_amount_per_byte")
        if isinstance(res.get("keys"), list):
            out["keys_count"] = len(res["keys"])
            if res["keys"]:
                out["first_key_shape"] = sorted(res["keys"][0].keys())
        if isinstance(res.get("current_validators"), list):
            out["current_validators_count"] = len(res["current_validators"])
        if isinstance(res.get("result"), list) and res["result"] and isinstance(res["result"][0], int):
            try:
                out["view_call_result"] = bytes(res["result"]).decode()[:200]
            except Exception:
                out["view_call_result"] = "byte array (%d bytes)" % len(res["result"])
        if isinstance(res.get("receipts_outcome"), list):
            out["receipts_outcome_count"] = len(res["receipts_outcome"])
        if isinstance(res.get("data"), list):
            out["data_count"] = len(res["data"])
    if isinstance(obj.get("data"), list):
        out["data_count"] = len(obj["data"])
        if obj["data"]:
            out["first_item_keys"] = sorted(obj["data"][0].keys())[:20]
    if "error" in obj:
        out["rpc_error"] = str(obj["error"])[:300]
    if "errors" in obj:
        out["errors"] = str(obj["errors"])[:300]
    for k in ("version", "tag_name", "name", "gecko_says", "status", "object"):
        if k in obj and not isinstance(obj[k], (dict, list)):
            out[k] = obj[k]
    if isinstance(obj.get("crate"), dict):
        out["crate_max_version"] = obj["crate"].get("max_version")
    if isinstance(obj.get("near"), dict):
        out["near_price"] = obj["near"]
    return out


def one(check):
    cid, label, method, url, body, headers, note = check
    req = urllib.request.Request(url, method=method)
    req.add_header("User-Agent", UA)
    req.add_header("Accept", "application/json")
    for k, v in headers.items():
        req.add_header(k, v)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    t0 = time.time()
    rec = {"id": cid, "label": label, "method": method, "url": url,
           "rate_limit_note": note, "checked_at": CHECKED,
           "expected_degraded": cid in EXPECTED_DEGRADED,
           "request_body": body if body is not None and len(json.dumps(body)) < 500 else "omitted:large"}
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, data=data, timeout=TIMEOUT,
                                       context=ssl.create_default_context()) as r:
                raw = r.read()
                rec["http_status"] = r.status
                rec["response_headers"] = {k.lower(): v for k, v in r.headers.items()
                                           if k.lower() in ("content-type", "ratelimit-limit",
                                                            "ratelimit-remaining", "ratelimit-reset",
                                                            "x-ratelimit-limit", "x-ratelimit-remaining",
                                                            "retry-after", "cache-control", "server")}
                rec["bytes"] = len(raw)
                rec["shape"] = summarize(raw, cid)
                # HTTP 200 with a JSON-RPC error is NOT a live source.
                rec["live"] = not (rec["shape"].get("rpc_error") or rec["shape"].get("errors"))
                break
        except urllib.error.HTTPError as e:
            raw = e.read()
            rec.update(http_status=e.code, bytes=len(raw), live=False,
                       response_headers={k.lower(): v for k, v in e.headers.items()
                                         if "ratelimit" in k.lower() or k.lower() == "retry-after"},
                       shape=summarize(raw, cid))
            if e.code == 429 and attempt < 2:
                rec["retried_429"] = True
                time.sleep(2.0 * (2 ** attempt))
                continue
            break
        except Exception as e:
            rec.update(http_status=None, live=False, error=f"{type(e).__name__}: {e}")
            break
    rec["elapsed_s"] = round(time.time() - t0, 3)
    return rec


def main():
    height = post_json(MAIN_FALLBACKS, "status", [])["result"]["sync_info"]["latest_block_height"]
    testnet_tx = get_json("https://api-testnet.nearblocks.io/v3/txns?limit=1")["data"][0]["transaction_hash"]
    faucet_keys = post_json(TEST_FALLBACKS, "query", {"request_type": "view_access_key_list",
                                                      "account_id": "faucet.testnet",
                                                      "finality": "final"})["result"]["keys"]
    faucet_key = faucet_keys[0]["public_key"]
    checks = build_checks(height, testnet_tx, faucet_key)
    # 4 workers: the public testnet RPC returned HTTP 429 under 8-way concurrency
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(one, checks))
    results.sort(key=lambda r: r["id"])
    out = {"checked_at": CHECKED, "user_agent": UA, "mainnet_height_at_check": height,
           "testnet_tx_sample": testnet_tx,
           "note": "Generated by scripts/verify-sources.py from real requests. Never hand-edited.",
           "results": results}
    (ROOT / "config" / "sources.json").write_text(json.dumps(out, indent=2) + "\n")
    live = [r for r in results if r.get("live")]
    expected = [r for r in results if not r.get("live") and r.get("expected_degraded")]
    unexpected = [r for r in results if not r.get("live") and not r.get("expected_degraded")]
    print(f"{len(results)} checks, {len(live)} live, {len(expected)} expected-degraded, "
          f"{len(unexpected)} UNEXPECTED failures -> config/sources.json")
    for r in unexpected:
        print(f"  !!! UNEXPECTED {r['id']} {r.get('http_status')}")
    for r in results:
        if not r.get("live") and not r.get("expected_degraded"):
            print(f"  DEGRADED {r['id']:<48} {r.get('http_status')} {r.get('error','')[:80]} "
                  f"{str(r.get('shape',{}).get('rpc_error',''))[:100]}")
    return out


if __name__ == "__main__":
    main()
