# Threat model and release blockers

Scope: source review of the testnet prototype, not an independent audit. Assets: signing keys, holder sessions, gateway compute/budget, payload availability, ownership registry and credibility of displayed measurements.

## Immediate blockers
1. **Exposed testnet credentials:** the original public Drive ZIP contains keys/testnet.json. Assume compromise; revoke/rotate or provision fresh accounts after validating replacement access. Restrict sharing. Deleting local files is not on-chain revocation. No rotation has been performed by these patches.
2. **Untrusted receipt authentication:** before M03, /api/auth/attest-receipt accepted caller-supplied receipt fields/logs and could confuse a fabricated receipt for proof of controlling a holder account. M03 disables this route with HTTP 410. A public holder check is not identity proof. Do not re-enable without independent server verification of transaction success, signer, receiver, nonce and contract event provenance. Client UI fallback compatibility is now limited and requires follow-up.
3. **Development defaults:** DEMO_MODE defaults to 1 and JWT_SECRET has a known development fallback. Explicitly disable demo mode and provide a strong private JWT secret. Startup does not enforce this automatically. Credential-dependent organizer demo endpoints are not suitable for anonymous public exposure.
4. **Admin surface:** /admin/run-now requires a token only when ADMIN_TOKEN is nonempty. /admin/rounds and /admin/invalidate-holder lack equivalent authorization. Set ADMIN_TOKEN and block all /admin/* at the network/reverse-proxy boundary outside a private demo; this is not a substitute for implementing proper authorization.

## Threat/control matrix
| Threat | Current control | Residual risk / required work |
|---|---|---|
| Stolen worker key | Restricted publish method/receiver | Can publish false data or spend allowance; source correctness not enforced |
| Stolen organizer keys | None against exposed credentials | Rotate/reprovision; never fund compromised accounts |
| Fake identity | Challenge/signature or server transaction path | Wallet flow and receipt provenance need independent adversarial testing |
| Session replay/theft | Short JWT lifetime | localStorage/XSS, known secret if unconfigured; stronger session handling needed |
| Transfer then reuse token | Holder recheck and cache invalidation | Cache/RPC lag; no instantaneous global revocation guarantee |
| Snapshot tampering | Canonical hash vs on-chain commitment | Cannot prove observation accuracy; unsigned delivery metadata separate |
| Provider outage/false data | Multiple RPC/source fallbacks, stale labels | Correlated failures, inconsistent finality, missing values and biased sources |
| Lost broadcast response | M02 refuses re-sign/retry after attempt | Manual recovery required; transaction may have succeeded |
| Vault crash/concurrency | JSON files, persist before publish | No atomic multi-file transaction; corruption/multi-writer races |
| Endpoint abuse | Partial route guards | Rate limiting, quotas, body limits and monitoring need review |
| Public-data leakage | Delayed public tier | Already-downloaded payloads cannot be revoked; confidentiality is time-limited |
| Untrusted toolchain/dependencies | Lockfiles | CI/toolchain actions not fully pinned; supply-chain audit still needed |

## Deployment prerequisites, not completed guarantees
- Replace exposed keys and verify exact access-key permissions on-chain.
- Disable demo endpoints; deny admin routes externally; require secure configuration at startup.
- Independently verify receipt evidence against the intended contract and signer; test signature and transaction fallbacks against spoofing/replay.
- Add authentication rate limits, origin/CORS policy review, secure transport, secrets management, observability and recovery tests.
- Replace or harden JSON persistence for production, centralize challenges/cache for multiple instances, and verify bounded revocation behavior.
- Compile/run sandbox tests; inspect contract promise failures and provisioning recovery; audit contracts and gateway.

M03 does not claim these prerequisites are completed. Do not label the service production-ready. Keep local demonstrations firewalled because the gateway binds to all interfaces.
