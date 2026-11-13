#!/usr/bin/env bash
# Native unit tests (fast, no sandbox binary download) + optional near-workspaces sandbox tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"
cd "$ROOT"
echo "==> agent-account unit tests"
cargo test --manifest-path contracts/agent-account/Cargo.toml --lib
echo "==> sentinel-body unit tests"
cargo test --manifest-path contracts/sentinel-body/Cargo.toml --lib
echo "==> wasm builds (used by sandbox tests and deployment)"
bash scripts/build-contracts.sh
if [ "${RUN_SANDBOX_TESTS:-0}" = "1" ]; then
  echo "==> near-workspaces sandbox tests (downloads a sandbox binary)"
  cargo test --manifest-path contracts/sentinel-body/Cargo.toml --test sandbox -- --nocapture
else
  echo "==> sandbox tests skipped (set RUN_SANDBOX_TESTS=1; CI sandbox is opt-in via workflow_dispatch)"
fi
