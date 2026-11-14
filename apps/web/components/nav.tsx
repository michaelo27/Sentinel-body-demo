'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSentinel } from '../app/providers';
import { Copy, LogOut, Menu, X } from 'lucide-react';
import { shortHash } from './ui';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/collection', label: 'Collection' },
  { href: '/about', label: 'About' },
  { href: '/live', label: 'Live intel' },
  { href: '/proof', label: 'Proof' },
  { href: '/agent/0', label: 'Agent' },
  { href: '/mint', label: 'Mint' },
  { href: '/verify', label: 'Verify' },
  { href: '/vault', label: 'Vault' },
];

export function Nav() {
  const path = usePathname();
  const { accountId, mode, logout, connectWallet, connecting } = useSentinel();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  return (
    <header className="nav">
      <div className="wrap" style={{ height: 64, display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: '0 0 auto' }}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Sentinel<span style={{ color: 'var(--green)' }}> Body</span></span>
        </Link>

        <nav aria-label="Primary" style={{ gap: 4, flex: 1 }} className="desktop-only">
          {LINKS.map((l) => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return <Link key={l.href} href={l.href} className="btn btn-ghost btn-sm" style={{
              borderColor: 'transparent', background: active ? 'rgba(255,255,255,.06)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-2)', fontWeight: active ? 600 : 500,
            }}>{l.label}</Link>;
          })}
        </nav>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '0 0 auto' }} className="desktop-only">
          {accountId ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href="/vault" className="chip chip-green" style={{ height: 34 }} title={accountId}><span className="dot dot-live" />{shortHash(accountId, 12)}</Link>
            <button className="btn btn-ghost btn-sm" onClick={logout} aria-label="Disconnect" style={{ minHeight: 34, padding: '0 9px' }}><LogOut size={14} /></button>
          </div> : <button className="btn btn-primary btn-sm" onClick={async () => { setError(''); try { await connectWallet(); } catch (e) { setError((e as Error).message); } }} disabled={connecting}>{connecting ? 'Connecting…' : 'Connect wallet'}</button>}
        </div>

        <button className="btn btn-ghost btn-sm mobile-only" style={{ marginLeft: 'auto' }} onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>

      {open && <div className="mobile-only" style={{ padding: '8px 16px 18px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">{l.label}</Link>)}
        </div>
        <div style={{ marginTop: 12 }}>
          {accountId ? <div style={{ display: 'flex', gap: 8 }}><Link href="/vault" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setOpen(false)}>Open vault · {shortHash(accountId, 8)}</Link><button className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={14} /></button></div>
            : <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={async () => { try { await connectWallet(); } catch (e) { setError((e as Error).message); } }}>Connect wallet</button>}
        </div>
      </div>}
      {error && <div className="small" style={{ padding: '8px 16px', color: 'var(--rose)', borderTop: '1px solid var(--border)' }} role="alert">{error} <button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
    </header>
  );
}
