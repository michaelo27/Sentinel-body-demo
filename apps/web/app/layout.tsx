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
  title: 'Sentinel Body — Own the agent. Unlock the intelligence.',
  description: 'A living AI agent NFT on NEAR testnet. Each Sentinel Body owns a dedicated on-chain account and unlocks verifiable, holder-gated ecosystem intelligence.',
  openGraph: { title: 'Sentinel Body', description: 'Own the agent. Unlock the intelligence.', type: 'website' },
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
              <div><strong style={{fontSize:22,fontWeight:900}}>SENTINEL<span style={{color:'var(--green)'}}> BODY</span></strong><p className="small muted" style={{marginTop:12}}>Collect the body. Inspect the signal.</p></div>
              <nav aria-label="Footer"><Link href="/collection">Collection</Link><Link href="/about">About</Link><Link href="/live">Intelligence</Link><Link href="/proof">Proof</Link><Link href="/vault">Vault</Link></nav>
            </div>
            <p className="tiny tertiary" style={{marginTop:30,lineHeight:1.8}}>NEAR testnet research prototype · off-chain analytics, on-chain commitments · no investment or reward promises. Check data age and source limitations. Selected character shown as website artwork; deployed NFT media remains unchanged.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
