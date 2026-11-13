# Release checklist and Windows clean export

M01–M04 deliver files and evidence, not a production-readiness certificate. M04 adds media and an allowlisted ZIP export utility. Keep using the patched Sentinel Body folder.

## Local checks
Run separately, stopping on each error:
```powershell
Set-Location -LiteralPath "C:\Users\DELL\Desktop\PROJECTS\Sentinel Body"
corepack pnpm install --frozen-lockfile
corepack pnpm test:transactions
corepack pnpm test
corepack pnpm typecheck:web
corepack pnpm build:web
```
These tests/builds passed in the build workspace during prior milestones; successful file merging on your PC does not mean your local build has run. Rust/sandbox and hosted CI are still unverified. README provides a deliberately read-only local walkthrough.

## Make a clean source ZIP (recommended instead of Compress-Archive)
From the project root, after M04 is applied:
```powershell
$Release = Join-Path (Split-Path (Get-Location).Path -Parent) ("Sentinel-Body-Source-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".zip")
py scripts/export-release.py --output "$Release"
if ($LASTEXITCODE -ne 0) { throw "Export failed. Stop and inspect the error." }
Write-Host "Source ZIP: $Release"
```
Use python or python3 instead of py if that is your installed launcher. The exporter uses only Python's standard library (3.9+). It reads config/release-files.json: only those exact paths are included. Unknown files, private backups, keys, actual .env files, .git, installed packages, .next and target are not swept into the ZIP. The reviewed embedded controller WASM is included as source-build input.

The export is source-only: recipients install dependencies and build locally. It adds RELEASE-MANIFEST.json with hashes of all included files. Existing output files are never overwritten. Missing files, unsafe paths, symlinks and obvious literal private-key patterns stop export. These are safeguards, NOT a comprehensive secret detector. Review all included files (including screenshots, logs and user edits) before sharing. A known development fallback JWT secret remains in source; it must never be used for a public deployment.

If you add source files later, intentionally update the allowlist after reviewing them; otherwise they will not be exported. Do not add keys/, .env, private backups, node_modules or build caches. Verify the resulting ZIP contains no sensitive files. Keep your full local working folder and private backups separately.

## Before any trusted/public use — OPEN
- [ ] Revoke/replace exposed testnet credentials and confirm replacement access.
- [ ] Set secure JWT/admin configuration and disable organizer demo mode.
- [ ] Harden/block every admin route; add startup validation and abuse controls.
- [ ] Finish independently verified wallet authentication; M03 disabled the untrusted receipt shortcut.
- [ ] Compile and execute Rust sandbox tests; run hosted CI.
- [ ] Version and correct analytics discrepancies rather than rewriting committed v1 history.
- [ ] Review JSON persistence concurrency/recovery and production architecture.
- [ ] Validate the full current-browser flow and capture a new continuous demo if needed.
- [ ] Obtain an appropriate security review before representing the system as trusted infrastructure.

## Delivery status
M01: repair/evidence; M02: reproducibility/test source (Rust acceptance still open); M03: docs and receipt-route closure; M04: historical presentation assets and clean source packaging. No public hosting, credential rotation, fresh deployment or full production acceptance is claimed. Final delivery does not erase open engineering work.
