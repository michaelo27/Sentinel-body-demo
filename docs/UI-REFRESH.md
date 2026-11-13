# UI01 — collectible-first visual refresh

## Reference and scope
Reviewed the supplied FatNinja screenshots and public home, about and collection pages:
- https://fatninja.framer.website/
- https://fatninja.framer.website/about
- https://fatninja.framer.website/collection

Design interpretation: oversized uppercase type, dark teal grid, acid-lime actions, centered hero showcase, rounded collectible/utility cards, FAQ and a large closing CTA. This is a custom Next implementation, not an import of the Framer template or its branded character assets. No template sales counts, supply claims, rarity scores, staking or royalty promises were imported.

## Implemented
- Redesigned homepage with existing generative orb, live mint quote (or unavailable state), public intelligence teaser, utility sections and FAQ.
- New /collection route with featured Genesis and numeric token lookup against existing /api/agent/:id. This is NOT a full collection index. It does not invent tokens or sale statistics.
- New /about route explaining the actual system and its limits.
- Shared lime/teal styles, navigation and footer applied throughout existing app routes. Functional dashboard layouts are retained, not rewritten as a marketplace.
- Responsive mobile menu and layouts; reduced-motion preference disables decorative orb floating.
- Updated source-export allowlist includes the new files.

## Explicitly unchanged
No new NFT image is selected, generated or uploaded. Existing orb media and token metadata remain unchanged. Artwork selection is the user's second task and requires their separate command.

providers.tsx, lib/ownership.ts, contracts, server/auth, package versions and lockfiles are NOT in this patch. The user's wallet fixes are preserved. No account provisioning, minting, transfer, publishing, receipt-verification changes or key rotation occur. This update does not resolve previously documented security or wallet limitations.

## Validation
Production build passed with /about and /collection added. 14 core, 6 gateway and 4 transaction tests passed. Headless Chromium checked home/about/collection/proof/mint/vault for HTTP 200, desktop horizontal overflow, mobile home at 390px, mobile menu navigation and token lookup submission; no captured page errors. This is not a real-wallet test. Browser check does not establish every source/RPC response is available or validate all dashboard data.

Screenshots and logs: docs/ui-refresh/. Artwork/media can take time to load or fail if the gateway/RPC is unavailable. Missing agent data is labelled unavailable rather than invented. The globe backdrop is CSS decoration, not a geographic flow map. Core numerical-methodology discrepancies are still documented in METHODOLOGY.md.

## Installation and rollback
Use the supplied Apply-UI01.ps1 wrapper after stopping the website. The Python installer checks expected baseline hashes, rejects conflicts, backs up replacements and makes only listed changes. It does not overwrite wallet providers or keys. Rebuild with pnpm build:web and restart the production server; hard refresh the browser. No dependency update is required.

To undo, use the sibling UI01 backup's changes.json: restore replaced files and remove only newly-added paths. Alternatively restore a private pre-update working-folder backup. Do not apply an older full-project archive on top of your newer wallet fixes.

The clean export script already allows the provider file and exports its current content; after this update, re-export instead of distributing an older consolidated ZIP. Review for secrets before sharing. PowerShell wrapper not executed on Windows in the build workspace; Python apply/reapply/conflict handling is tested against baseline files.
