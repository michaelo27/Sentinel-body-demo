#!/usr/bin/env bash
# Build both NEAR contracts for wasm32-unknown-unknown, size-optimized.
# The controller wasm is embedded into the NFT contract, so IT MUST BE BUILT FIRST.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"
cd "$ROOT"

echo "==> rustc $(rustc -V)"
rustup target list --installed | grep -q wasm32-unknown-unknown || rustup target add wasm32-unknown-unknown

echo "==> building agent-account controller"
cargo build --manifest-path contracts/agent-account/Cargo.toml \
  --target wasm32-unknown-unknown --release
CTRL="target/wasm32-unknown-unknown/release/sentinel_agent_account.wasm"
[ -f "$CTRL" ] || { echo "missing $CTRL"; exit 1; }
mkdir -p "$ROOT/contracts/sentinel-body/res" "$ROOT/target/near"
# Optional size optimization: `WASM_OPT=/path/to/wasm-opt bash scripts/build-contracts.sh`.
# binaryen's `wasm-opt -Oz` saves ~17% on the controller, which is locked in
# EVERY agent account, so it directly reduces mint cost.
if [ -n "${WASM_OPT:-}" ] && [ -x "$WASM_OPT" ]; then
  "$WASM_OPT" -Oz --enable-bulk-memory --strip-debug "$CTRL" -o "$CTRL.opt"
  mv "$CTRL.opt" "$CTRL"
  echo "    wasm-opt applied"
elif command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Oz --enable-bulk-memory --strip-debug "$CTRL" -o "$CTRL.opt" && mv "$CTRL.opt" "$CTRL"
  echo "    wasm-opt applied"
fi
cp "$CTRL" "$ROOT/contracts/sentinel-body/res/agent_account.wasm"
cp "$CTRL" "$ROOT/target/near/agent-account.wasm"
echo "    controller wasm: $(wc -c < "$CTRL") bytes"

echo "==> building sentinel-body (embeds the controller wasm)"
cargo build --manifest-path contracts/sentinel-body/Cargo.toml \
  --target wasm32-unknown-unknown --release
NFT="target/wasm32-unknown-unknown/release/sentinel_body.wasm"
[ -f "$NFT" ] || { echo "missing $NFT"; exit 1; }
cp "$NFT" "$ROOT/target/near/sentinel-body.wasm"
echo "    NFT wasm: $(wc -c < "$NFT") bytes"

echo "==> storage math"
python3 - <<'PY'
import json,os
root=os.getcwd()
ctrl=os.path.getsize('target/near/agent-account.wasm')
overhead=900
byte_cost=10_000_000_000_000_000_000  # verified EXPERIMENTAL_protocol_config, 2026-11-12
storage=(ctrl+overhead)*byte_cost/1e24
seed=0.35; allowance=0.25; gas=0.06
print(f"  controller wasm      {ctrl:>8} bytes")
print(f"  + account overhead   {overhead:>8} bytes")
print(f"  1 NEAR / 100 KB at 1e19 yocto/byte  =>  storage ≈ {storage:.4f} NEAR (LOCKED)")
print(f"  seed {seed} + allowance {allowance} + gas headroom {gas}")
print(f"  => mint_cost ≈ {storage+seed+allowance+gas:.4f} NEAR, free on testnet")
PY
echo "==> done. Artifacts in target/near/"
