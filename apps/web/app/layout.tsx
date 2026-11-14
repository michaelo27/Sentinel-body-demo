import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Nav } from '@/components/nav';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Sentinel Buddies — Mint an NFT. Unlock an AI agent.',
  description: 'Meet your buddy. Unlock the intel. Mint an NFT, get a linked agent account, investigate NEAR accounts and ask AI to explain saved on-chain evidence.',
  openGraph: { title: 'Sentinel Buddies', description: 'Mint an NFT. Unlock an AI agent.', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#05070A', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <style>{`:root{--sans:var(--font-geist),Inter,ui-sans-serif,system-ui,sans-serif;--mono:var(--font-geist-mono),ui-monospace,monospace;--serif:var(--font-serif),Georgia,serif;}`}</style>
        <Providers>
          <Nav />
          <main>{children}</main>
          <footer className="wrap" style={{ paddingTop: 64, paddingBottom: 48, borderTop: '1px solid var(--border)', marginTop: 80 }}>
            <div className="collect-footer">
              <div><strong style={{fontSize:22,fontWeight:900}}>SENTINEL<span style={{color:'var(--green)'}}> BUDDIES</span></strong><p className="small muted" style={{marginTop:12}}>Meet your buddy. Inspect the signal.</p></div>
              <nav aria-label="Footer"><Link href="/collection">Collection</Link><Link href="/about">About</Link><Link href="/live">Network report</Link><Link href="/proof">Report records</Link><Link href="/vault">My intel vault</Link></nav>
            </div>
            <p className="tiny tertiary" style={{marginTop:30,lineHeight:1.8}}>NEAR testnet research prototype · off-chain analytics, on-chain commitments · no investment or reward promises. Check data age and source limitations. See Collection for registered NFT artwork and current on-chain ownership.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
