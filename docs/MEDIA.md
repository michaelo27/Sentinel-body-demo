# Presentation assets — provenance and limits

| Asset | Format | Description |
|---|---|---|
| hero.png | PNG | AI-generated conceptual artwork: a glowing agent core. Illustration, not an actual on-chain object or UI. |
| screenshots/demo.gif | GIF | Nine-slide montage of artwork and historical browser screenshots. |
| sentinel-demo.webm | WebM / VP8 | Approximately 16.2 seconds, 960×540, silent screenshot slideshow. Not a continuous screen recording. |

## View locally
Open the PNG/GIF in a browser or image viewer. Open the WebM in a current browser or compatible video player. No external font, analytics, CDN or hosted video link is required. These are local assets, not a public video deployment.

## Captions required when sharing
Suggested caption: “Sentinel Body testnet prototype — historical screenshot walkthrough. Not a fresh continuous execution recording. Current limitations and security changes are documented in the repository.”

The slides include historical proof, mint/unlock, vault, agent console and transfer evidence. They predate M03's disabled client-receipt authentication shortcut. They do NOT demonstrate that the current wallet fallback works. The hero is generated artwork and not transaction evidence. Exact historical timestamps and JSON reports are available in docs/screenshots; transaction-link accuracy is limited by the historical hash bug noted in DELIVERY-AUDIT.md.

## Suggested 60-second narration (text only)
“Sentinel Body links a NEAR testnet NFT to an agent account and verifiable snapshot commitments. A separate off-chain worker gathers data and computes the dashboard. Public viewers see delayed data; a verified holder can access the holder tier. The proof panel recomputes a snapshot hash in the browser. Hash agreement proves that the payload matches the commitment, not that every source or calculation is correct. Historical test evidence shows access moving when the previous holder transfers its last NFT, while the agent history remains. This is a research prototype. Exposed credentials, wallet compatibility, methodology discrepancies and unverified sandbox testing remain release blockers. These slides are historical evidence, not a recording of a freshly completed production deployment.”

## Submission honesty
Do not describe this asset as a complete live demo video, audited deployment, or proof of an investment signal. Capture a new continuous demo only after fresh credentials, independently verified authentication and remaining acceptance checks are ready. Do not put credentials or environment variables in the recording.
