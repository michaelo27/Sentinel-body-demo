'use client';
import { VaultGate } from '@/components/vault-gate';
import { VaultDashboard } from '@/components/dashboard';
import { AccountMonitor } from '@/components/account-monitor';
import { AccountInvestigator, VaultWelcome } from '@/components/account-investigator';
import { BuddyMissions } from '@/components/buddy-missions';

export default function VaultPage() {
  return <VaultGate title="Your NFT is your way in.">{(vault) => <>
    <VaultWelcome/>
    <nav className="wrap" aria-label="Vault sections" style={{display:'flex',gap:12,flexWrap:'wrap',paddingTop:24}}>
      <a className="btn btn-primary btn-sm" href="#buddy-missions">Give my buddy a mission</a>
      <a className="btn btn-ghost btn-sm" href="#monitored-accounts">Watch my accounts</a>
      <a className="btn btn-ghost btn-sm" href="#shared-intelligence">Ecosystem & agentic economy intel</a>
    </nav>
    <BuddyMissions/>
    <AccountInvestigator/>
    <AccountMonitor />
    <section id="shared-intelligence" aria-label="Ecosystem & agentic economy intel" style={{scrollMarginTop:90}}><VaultDashboard vault={vault} /></section>
  </>}</VaultGate>;
}
