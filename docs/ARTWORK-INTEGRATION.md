# ART01 — selected character integration

## Assets
The user selected the full-body 3D reinterpretation of their supplied illustrated portrait. A transparent cutout was prepared from that selected image, not a newly generated variant. It retains braids, beard, gold-rimmed blue glasses, charcoal/teal technical outfit and lime footwear details.

- apps/web/public/artwork/sentinel-character.webp: lossless transparent browser asset.
- apps/web/public/artwork/sentinel-character.png: transparent PNG copy for reuse.

These are AI-generated reinterpretation assets derived from the user-provided reference. No worldwide uniqueness, ownership clearance or exclusivity is certified. This is one shared character, not a generated collection of distinct token traits.

## Website changes
AgentArt now renders the local character rather than the API orb. Hero/card/about layouts use contain sizing so the head and boots remain visible without circular clipping. The shared component also updates mint and agent previews. Copy explicitly identifies shared website artwork, not unique per-token on-chain media. The mint preview description no longer incorrectly describes the displayed character as dynamic SVG or a fuel indicator.

No NFT metadata, contracts, gateway SVG endpoint, worker, wallet provider, signature verification, mint logic or token ownership is changed. Existing wallets/marketplaces will continue to read their existing metadata/media URL. Publishing this character as actual NFT media requires a separate authorized metadata/storage plan. Do not claim that deploying these frontend assets alone updates NFTs on-chain.

## Validation
Production Next build passed. Core (14) and gateway (6) tests passed. Browser check: home, collection, about, mint, agent/0 return HTTP 200; character images decode successfully; no captured page errors; no horizontal overflow on checked desktop pages or 390px home. Wallet flows and on-chain transactions were not tested or executed. RPC availability can affect quote/state labels but not the static character asset.

Screenshots and logs are in docs/artwork-preview. The patch apply/reapply/conflict checks and source export are tested against Drive + M01–M04 + UI01, with current provider bytes preserved. The Windows wrapper is not executed in this build environment. If you changed a touched source file locally, preflight will stop rather than overwrite it.

## Install / rollback
Apply after UI01, stop website, rebuild and restart. Gateway may remain running. Existing provider fixes remain untouched. Roll back with the sibling ART01 backup changes.json (restore replacements, remove only introduced files), then rebuild. No on-chain rollback is involved because no chain state is modified.
