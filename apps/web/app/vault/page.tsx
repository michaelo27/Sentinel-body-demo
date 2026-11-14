'use client';
import { VaultGate } from '@/components/vault-gate';
import { VaultDashboard } from '@/components/dashboard';
import { AccountMonitor } from '@/components/account-monitor';

export default function VaultPage() {
  return <VaultGate title="Prove it. Then see everything.">{(vault) => <>
    <nav className="wrap" aria-label="Vault sections" style={{display:'flex',gap:12,flexWrap:'wrap',paddingTop:24}}>
      <a className="btn btn-primary btn-sm" href="#monitored-accounts">My monitored accounts</a>
      <a className="btn btn-ghost btn-sm" href="#shared-intelligence">Shared intelligence report</a>
    </nav>
    <AccountMonitor />
    <section id="shared-intelligence" aria-label="Shared intelligence report" style={{scrollMarginTop:90}}><VaultDashboard vault={vault} /></section>
  </>}</VaultGate>;
}
