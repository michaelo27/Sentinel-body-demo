# HOST01 — Vercel + Cloudflare saved-snapshot demo

This is an incremental hosting addition. No existing app, contract, key or dependency files are replaced. Use the freshly migrated Windows project as the source of your frontend, not an older archive.

## Scope and truthful status

- Existing testnet NFT contract: `sntl-02e90eacb8.testnet`.
- Published snapshot: `snap-1794592774-60af8391549c`.
- Canonical content hash verified from the uploaded JSON: `c119694cf636474fd55aee9d94cad9d7158a4a704253f645d1b0295c11c0120a`.
- Worker serves that immutable saved report. It does not collect new data, sign chain transactions or run cron. Its UI delivery mode is replay/saved-snapshot.
- Snapshot is embedded in the Worker bundle, NOT a public static asset. D1 stores authentication challenges and short-lived rate counters, not private keys. No separate paid storage product is required for this one-report demo.
- Holder data requires a valid NEP-413 session plus a fresh on-chain ownership check per request. Full snapshots are also public after the 15-minute delay, as in the original application.
- Challenge verification checks Ed25519 signatures, a matching full-access key on the claimed account, current NFT ownership, expiry and atomic single use in D1.
- Admin runs, organizer/demo minting and client-supplied receipt authentication are disabled.
- The uploaded report's original metadata and observations remain unchanged. The Worker computes the same canonical hash. Serving it does not establish that the analytics are accurate or current.
- Existing on-chain metadata/report URL hints still say localhost. Public hosting does not rewrite historical commitments or minted metadata.

## A. Deploy the Cloudflare Worker without installing Wrangler

Use Cloudflare's dashboard. Interface labels can vary slightly.

1. Stay on Workers Free. Do not activate a paid plan or add a paid resource.
2. Under Storage & Databases > D1, create a database called `sentinel-auth` using the free allocation.
3. Open its Console. Execute each statement in `hosting/cloudflare/schema.sql` (separately if the console does not accept a batch). This creates two small tables and an expiry index.
4. Under Workers & Pages, create a Worker called `sentinel-vault` (or another available name). Start with the Hello World Worker; do NOT choose Pages/static-assets hosting. Deploy the initial placeholder.
5. Worker Settings > Runtime: set compatibility date `2026-04-01`; add compatibility flag `nodejs_compat`. Save.
6. Worker Bindings: add D1 Database binding. Variable/binding name **DB**; select **sentinel-auth**. Save/deploy the binding.
7. Worker Settings > Variables and Secrets:
   - Add **JWT_SECRET** as a **Secret**, using the random value generated below. Never put it in GitHub, Vercel NEXT_PUBLIC variables, screenshots or this chat.
   - Add **ALLOWED_ORIGIN** as plain text. Temporarily use `https://pending.invalid`. Later replace it with the exact production Vercel origin, no trailing slash.
8. Open Edit Code. Replace the default module with the full contents of `hosting/cloudflare/worker.mjs`. This is already bundled; it has no npm installation step. Deploy.
9. Open `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/health`. It should return JSON with the fresh contract and snapshot. This is a saved-snapshot health check, not proof of signature verification.
10. Run the challenge smoke test below. It should return a nonce, message, recipient and expiresAt. Do not post the response here; tell us whether it succeeded. Your Worker URL is public and safe to share.

Generate a new JWT secret and copy it to the Windows clipboard:

```powershell
$Bytes = New-Object byte[] 48
$Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$Rng.GetBytes($Bytes)
$Rng.Dispose()
[Convert]::ToBase64String($Bytes) | Set-Clipboard
Write-Host 'Fresh secret copied. Paste into Cloudflare JWT_SECRET as Secret.'
```

After saving it, clear the clipboard:

```powershell
Set-Clipboard -Value 'cleared'
```

Copy the bundled Worker code to the clipboard:

```powershell
Get-Content -LiteralPath 'C:\Users\DELL\Desktop\PROJECTS\Sentinel Body\hosting\cloudflare\worker.mjs' -Raw | Set-Clipboard
```

Challenge smoke test (replace the example origin with your actual Worker URL):

```powershell
$Worker = 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev'
Invoke-RestMethod -Method Post -Uri "$Worker/auth/challenge" `
    -ContentType 'application/json' `
    -Body '{"accountId":"michaelomario.testnet"}'
```

If this fails, stop and send the non-secret error. Do not loosen authentication, remove the D1 binding or enable demo mode.

## B. Prepare a clean source folder for GitHub

Run the export helper only after HOST01 has been installed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\DELL\Desktop\PROJECTS\Sentinel Body\hosting\Export-Hosting.ps1'
```

It creates a new sibling `Sentinel-Hosting-Export-<random>` folder using the reviewed release allowlist plus these hosting files. It removes historical snapshot payloads from the export and checks the fresh contract and both wallet fixes. It never copies keys, actual .env files, node_modules or migration backups. It scans common private-key patterns, but this is not a comprehensive secret audit: inspect the export before sharing.

Create a NEW EMPTY PRIVATE repository in your personal GitHub account, not an organization. Do not initialize it with README/license/gitignore. Use only the clean export folder. Do not use the original working folder or an old Git history: gitignore does not erase secrets from commits.

If Git is already installed, use PowerShell from the new export folder:

```powershell
git init
git add .
git status --short
# Inspect the file list. STOP if you see any credentials or private backups.
git commit -m "Hosted Sentinel Body testnet demo"
git branch -M main
# Replace this with YOUR actual newly created repository URL:
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Authenticate using GitHub's browser/device flow. Never paste an access token into the chat or embed it in a remote URL. If Git is not installed, use GitHub's web upload in small batches, preserving the folder structure and hidden root files (.gitignore). Do not upload dependencies/builds to make a build work.

## C. Deploy Vercel Hobby

1. Add New > Project; import the NEW personal private repository.
2. Framework: Next.js. Root Directory: `apps/web`.
3. Enable inclusion of source files outside the Root Directory (monorepo requirement).
4. Use Node.js 22.x if available. The app requires Node >=20.19.
5. Install command: `cd ../.. && corepack pnpm install --frozen-lockfile`
6. Build command: `corepack pnpm build` (runs inside apps/web).
7. Output Directory: leave Next.js default.
8. Environment variable for Production: **GATEWAY_INTERNAL_URL** = the exact HTTPS Worker origin, without trailing slash. Despite the old variable name, it is now a public HTTPS origin. Next.js rewrites already route `/api`, `/auth`, `/admin` there. Do not put the JWT secret or signing keys in Vercel.
9. Deploy. Cloud build downloads happen on Vercel, not your Windows PC. This package does not claim that the first Vercel build has already succeeded. Send the first build error if any; do not upgrade to a paid plan as a workaround.
10. Copy the stable production `https://...vercel.app` URL. Update Cloudflare **ALLOWED_ORIGIN** to EXACTLY this origin, without a trailing slash. Deploy/save the Worker settings.
11. Use the production URL for tests. Preview deployment origins are intentionally not wildcard-allowed.

Hobby use must comply with Vercel's current plan terms. Keep this a personal, non-commercial testnet research demo with no real-money sales or paid access. Stay within included quotas. Do not enable billing/upgrades just to resolve errors.

## D. Required hosted acceptance checks

- `/api/health` through Vercel: fresh contract ID and correct snapshot ID.
- Logged-out `/api/vault/latest`: 401, never a full holder report.
- `/api/auth/attest-receipt` POST: 410.
- Connect Meteor TESTNET on the production site. Token #1 already exists; DO NOT mint again to test login.
- Go to `/vault`, sign the NEP-413 message, and confirm the saved report is displayed.
- `/verify`: enter the snapshot ID above. Check the hash and public full-report/browser rehash where available.
- Inspect Cloudflare invocation errors/CPU metrics while testing. Local workerd success does not prove the free production CPU budget is met. Error 1102 requires optimization, not blind retries or disabling security checks.
- Log out and confirm the holder endpoint is protected again.
- Capture production URL, vault, verifier and agent key screenshots for submission.

Do NOT claim automatic updates, scheduled publication, transfer revocation tested with a real transfer, or a production security certification. Revocation logic is tested locally; a real hosted transfer test is still separate.

## Free-plan boundaries and later cron work

Official limits checked during preparation: Workers Free currently lists 100,000 requests/day, 10 ms CPU per invocation (including Cron), 50 subrequests per invocation, and five cron triggers per account. Network wait time is different from CPU time. These are limits, not a promise that this particular Worker stays under them. D1 usage also has its own free quotas.

The existing round has dozens of source requests plus publication work. No cron is configured in HOST01. A future publisher needs separate quota measurements, durable state, duplicate/overlap prevention, and only the restricted worker secret. Never upload organizer/contract full-access keys.

Sources:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://vercel.com/docs/limits/fair-use-guidelines

## Files and reproducibility

`worker.mjs` is the deployable bundled module. `worker-source.ts` and `platform.ts` are the source; shared algorithms/config are imported from the existing repository. `snapshot.json` is the unchanged uploaded report. `schema.sql` creates the authentication tables. `wrangler.jsonc` is optional CLI configuration with explicit placeholders; it is NOT needed for dashboard deployment. Do not run wrangler deploy with unresolved placeholders.

`test-worker.mts` runs the mocked Node tests using the project's existing tsx. A separate local workerd + real D1 SQLite test was run during preparation; its RPC was mocked, not an actual wallet signature from the user. No new cloud account, remote D1 database, repository or deployment has been created by the assistant.
