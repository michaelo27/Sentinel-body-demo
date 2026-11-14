'use client';
import { VaultGate } from '@/components/vault-gate';
import { VaultDashboard } from '@/components/dashboard';
import { AccountMonitor } from '@/components/account-monitor';
import { AccountInvestigator, VaultWelcome } from '@/components/account-investigator';

export default function VaultPage() {
  return <VaultGate title="Your NFT is your way in.">{(vault) => <>
    <VaultWelcome/>
    <nav className="wrap" aria-label="Vault sections" style={{display:'flex',gap:12,flexWrap:'wrap',paddingTop:24}}>
      <a className="btn btn-primary btn-sm" href="#monitored-accounts">Watch my accounts</a>
      <a className="btn btn-ghost btn-sm" href="#shared-intelligence">Network report & running costs</a>
    </nav>
    <AccountInvestigator/>
    <AccountMonitor />
    <section id="shared-intelligence" aria-label="Network report & running costs" style={{scrollMarginTop:90}}><VaultDashboard vault={vault} /></section>
  </>}</VaultGate>;
}
