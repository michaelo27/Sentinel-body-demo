/**
 * Dynamic NFT art — deterministic generative SVG from
 * sha256(token_id + agent_account). State-reactive: one tick per on-chain
 * snapshot published, breathing speed from recency, amber "low fuel" state,
 * dormant state before the first publish.
 *
 * Self-contained (inline CSS keyframes, no external fonts/images) so it renders
 * correctly inside an <img> tag in wallets and marketplaces. Target < 8 KB.
 */
import { sha256HexBrowser } from './canonical.js';

type ArtState = { publishes: number; lastPublishMsAgo: number; lowFuel: boolean; reducedMotion?: boolean };

const HUES = [157, 196, 250]; // NEAR green, cool cyan, violet — brand palette

export async function sentinelArtSvg(tokenId: string, agentAccount: string, state: ArtState = { publishes: 0, lastPublishMsAgo: 1e12, lowFuel: false }): Promise<string> {
  const hex = await sha256HexBrowser(`${tokenId}${agentAccount}`);
  const b = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const hue = HUES[b(0)! % 3]! + (b(1)! % 9) - 4;
  const rings = 3 + (b(2)! % 4);
  const nodes = 5 + (b(3)! % 6);
  const tilt = (b(4)! % 40) - 20;
  const ticks = Math.min(60, Math.max(0, state.publishes));
  const dormant = ticks === 0;
  const amber = state.lowFuel;
  const c1 = amber ? '#FFB547' : `hsl(${hue} 95% 62%)`;
  const c2 = amber ? '#FFB547' : `hsl(${(hue + 45) % 360} 90% 70%)`;
  const glow = dormant ? 0.18 : amber ? 0.42 : 0.72;

  const breathSeconds = dormant ? 9 : Math.max(2.2, Math.min(9, 2.2 + Math.log10(1 + state.lastPublishMsAgo / 60000) * 1.8));
  const orbitSeconds = Math.max(14, 34 - nodes);

  const ringEls = Array.from({ length: rings }, (_, i) => {
    const rr = 108 + i * (128 / Math.max(1, rings));
    const dash = 1 + ((b(5 + i) || 7) % 5);
    return `<circle cx="300" cy="300" r="${rr.toFixed(1)}" fill="none" stroke="${i % 2 ? c2 : c1}" stroke-width="${(1.6 - i * 0.12).toFixed(2)}" opacity="${(0.42 - i * 0.045).toFixed(2)}" stroke-dasharray="${dash * 9} ${dash * 5}" class="ring r${i}"/>`;
  }).join('');

  const nodeEls = Array.from({ length: nodes }, (_, i) => {
    const ang = (b(10 + i) || 60 + i * 17) * (Math.PI / 90) + (i * Math.PI * 2) / nodes;
    const radius = 150 + (b(20 + i) || 100) % 78;
    const x = 300 + Math.cos(ang) * radius;
    const y = 300 + Math.sin(ang) * radius;
    const s = 2.2 + ((b(10 + i) || 5) % 30) / 10;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="${i % 3 === 0 ? c2 : c1}" opacity="${(0.5 + (i % 4) * 0.1).toFixed(2)}" class="node n${i}"/>`;
  }).join('');

  const tickEls = Array.from({ length: ticks }, (_, i) => {
    const ang = (i * 360) / Math.max(12, ticks) - 90;
    return `<line x1="300" y1="42" x2="300" y2="${ticks > 40 ? 50 : 55}" stroke="${c1}" stroke-width="1.4" opacity="0.75" transform="rotate(${ang.toFixed(1)} 300 300)"/>`;
  }).join('');

  const orbitDots = Array.from({ length: 3 }, (_, i) =>
    `<circle cx="300" cy="126" r="${(3.5 - i * 0.6).toFixed(1)}" fill="${c2}" opacity="${(0.9 - i * 0.2).toFixed(2)}"><animateTransform attributeName="transform" type="rotate" from="${i * 120} 300 300" to="${360 + i * 120} 300 300" dur="${orbitSeconds + i * 4}s" repeatCount="indefinite"/></circle>`,
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="Sentinel Body ${escapeXml(tokenId)}: ${ticks} on-chain snapshots, ${dormant ? 'dormant' : amber ? 'low fuel' : 'alive'}">
<defs>
<radialGradient id="bg"><stop offset="0" stop-color="#10161D"/><stop offset="0.72" stop-color="#080C11"/><stop offset="1" stop-color="#05070A"/></radialGradient>
<radialGradient id="core"><stop offset="0" stop-color="#ffffff" stop-opacity="${(glow * 0.95).toFixed(2)}"/><stop offset="0.28" stop-color="${c1}" stop-opacity="${glow.toFixed(2)}"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
<radialGradient id="halo"><stop offset="0" stop-color="${c1}" stop-opacity="0.24"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
<filter id="blur"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<style>
.ring{transform-origin:300px 300px}
.core{transform-origin:300px 300px;animation:breath ${breathSeconds.toFixed(2)}s ease-in-out infinite}
@keyframes breath{0%,100%{transform:scale(0.94);opacity:${(glow * 0.8).toFixed(2)}}50%{transform:scale(1.06);opacity:${glow.toFixed(2)}}}
.r0{animation:spin ${(orbitSeconds * 2).toFixed(1)}s linear infinite}
.r1{animation:spin ${(orbitSeconds * 1.4).toFixed(1)}s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.node{animation:twinkle 4s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:.28}50%{opacity:.9}}
@media (prefers-reduced-motion:reduce){.core,.r0,.r1,.node{animation:none}}
</style>
<rect width="600" height="600" fill="url(#bg)"/>
<circle cx="300" cy="300" r="270" fill="url(#halo)"/>
<g transform="rotate(${tilt} 300 300)">
${ringEls}
<circle cx="300" cy="300" r="70" fill="${c1}" opacity="${(glow * 0.20).toFixed(2)}" filter="url(#blur)"/>
<circle class="core" cx="300" cy="300" r="76" fill="url(#core)"/>
<circle cx="300" cy="300" r="18" fill="#EAF0F6" opacity="${dormant ? '.25' : '.85'}"/>
${nodeEls}
${orbitDots}
</g>
<g>${tickEls}</g>
<circle cx="300" cy="300" r="272" fill="none" stroke="#ffffff" stroke-opacity="0.06"/>
<text x="300" y="576" text-anchor="middle" font-family="monospace" font-size="15" letter-spacing="3" fill="${c1}" opacity="0.55">SENTINEL BODY #${escapeXml(tokenId)}</text>
</svg>`;
}

function escapeXml(s: string) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
}
