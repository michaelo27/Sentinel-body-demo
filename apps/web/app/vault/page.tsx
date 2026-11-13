'use client';
import { VaultGate } from '@/components/vault-gate';
import { VaultDashboard } from '@/components/dashboard';

export default function VaultPage() {
  return <VaultGate title="Prove it. Then see everything.">{(vault) => <VaultDashboard vault={vault} />}</VaultGate>;
}
