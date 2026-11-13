'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';

export type Session = {
  accountId: string | null;
  token: string | null;
  scope: 'holder' | 'preview' | null;
  mode: 'wallet' | 'demo' | null;
  connecting: boolean;
  signMessageSupported: boolean;
};

type Ctx = Session & {
  connectWallet: () => Promise<void>;
  demoSession: (accountId: string) => Promise<void>;
  setHolderToken: (token: string) => void;
  setScope: (scope: 'holder' | 'preview' | null) => void;
  logout: () => void;
  api: <T = any>(path: string, init?: RequestInit & { auth?: boolean }) => Promise<T>;
  signMessage: (params: { message: string; nonce: string; recipient: string }) => Promise<any>;
  callContract: (params: { methodName: string; args: object; gas?: string; deposit?: string }) => Promise<any>;
};

const SentinelCtx = createContext<Ctx | null>(null);
export const useSentinel = () => {
  const c = useContext(SentinelCtx);
  if (!c) throw new Error('useSentinel must be used inside Providers');
  return c;
};

const LS = 'sentinel.session.v1';
const CONTRACT = 'sntl-02e90eacb8.testnet';

export function Providers({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ accountId: null, token: null, scope: null, mode: null, connecting: false, signMessageSupported: false });
  const selectorRef = useRef<any>(null);
  const modalRef = useRef<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) setSession((s) => ({ ...s, ...JSON.parse(raw), connecting: false }));
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback((next: Partial<Session>) => {
    setSession((prev) => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem(LS, JSON.stringify({ accountId: merged.accountId, token: merged.token, scope: merged.scope, mode: merged.mode, signMessageSupported: merged.signMessageSupported })); } catch { /* ignore */ }
      return merged;
    });
  }, []);

  const setupSelector = useCallback(async () => {
    if (selectorRef.current) return selectorRef.current;
    const [{ setupWalletSelector }, { setupModal }, { setupMeteorWallet }] = await Promise.all([
      import('@near-wallet-selector/core'),
      import('@near-wallet-selector/modal-ui'),
      import('@near-wallet-selector/meteor-wallet'),
    ]);
    try { await import('@near-wallet-selector/modal-ui/styles.css'); } catch { /* our own theme wins */ }
    // Wallet Selector v10: the modal is created FROM the selector, not as a module.
    const sel = await setupWalletSelector({
      network: 'testnet',
      modules: [setupMeteorWallet()],
    } as any);
    // Connect identifies an account; do not request a contract access key here.
    // Explicit transaction calls below still provide their receiverId.
    const modal = setupModal(sel, { theme: 'dark' });
    selectorRef.current = sel; modalRef.current = modal;
    return sel;
  }, []);

  const connectWallet = useCallback(async () => {
    persist({ connecting: true });
    try {
      const sel = await setupSelector();
      const modal = modalRef.current;
      if (!modal || typeof modal.show !== 'function') throw new Error('Wallet modal could not be initialized.');
      await modal.show();
      let state = sel.store.getState();
      let account = state?.accounts?.[0];
      if (!account) {
        account = await new Promise<any>((resolve, reject) => {
          // v10 exposes an RxJS observable, not store.subscribe().
          // Its initial emission can be synchronous, before subscribe returns.
          let sub: { unsubscribe(): void } | undefined;
          let settled = false;
          const timer = setTimeout(() => {
            settled = true;
            sub?.unsubscribe();
            reject(new Error('Wallet selection timed out. Choose a wallet and try again.'));
          }, 60000);
          try {
            sub = sel.store.observable.subscribe({
              next: (s: any) => {
                if (!settled && s.accounts?.[0]) {
                  settled = true;
                  clearTimeout(timer);
                  sub?.unsubscribe();
                  resolve(s.accounts[0]);
                }
              },
              error: (error: unknown) => {
                settled = true;
                clearTimeout(timer);
                sub?.unsubscribe();
                reject(error);
              },
            });
            if (settled) sub?.unsubscribe();
          } catch (error) {
            clearTimeout(timer);
            sub?.unsubscribe();
            reject(error);
          }
        });
      }
      const w = await sel.wallet();
      persist({ accountId: account.accountId, mode: 'wallet', connecting: false, signMessageSupported: typeof w?.signMessage === 'function' });
    } catch (e) {
      persist({ connecting: false });
      throw e;
    }
  }, [persist, setupSelector]);

  const demoSession = useCallback(async (accountId: string) => {
    const r = await fetch('/api/demo/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Demo session failed');
    persist({ accountId, token: j.token, scope: 'preview', mode: 'demo', connecting: false, signMessageSupported: false });
  }, [persist]);

  const setHolderToken = useCallback((token: string) => persist({ token, scope: 'holder' }), [persist]);
  const setScope = useCallback((scope: 'holder' | 'preview' | null) => persist({ scope }), [persist]);

  const logout = useCallback(() => {
    try { localStorage.removeItem(LS); } catch { /* ignore */ }
    if (selectorRef.current?.wallet) {
      selectorRef.current.wallet().then((w: any) => w?.signOut?.()).catch(() => {});
    }
    setSession({ accountId: null, token: null, scope: null, mode: null, connecting: false, signMessageSupported: false });
  }, []);

  const api = useCallback(async <T,>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any || {}) };
    if (init.auth !== false) {
      try { const raw = localStorage.getItem(LS); const token = raw ? JSON.parse(raw).token : null; if (token) headers.Authorization = `Bearer ${token}`; } catch { /* ignore */ }
    }
    const res = await fetch(path, { ...init, headers });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j as T;
  }, []);

  const signMessage = useCallback(async (params: { message: string; nonce: string; recipient: string }) => {
    const sel = await setupSelector();
    const w = await sel.wallet();
    if (typeof w?.signMessage !== 'function') throw new Error('This wallet does not support NEP-413 signMessage. Use the on-chain attestation fallback.');
    const nonce = Buffer.from(params.nonce, 'base64');
    return w.signMessage({ message: params.message, nonce, recipient: params.recipient });
  }, [setupSelector]);

  const callContract = useCallback(async ({ methodName, args, gas = '300000000000000', deposit = '0' }: { methodName: string; args: object; deposit?: string; gas?: string }) => {
    const sel = await setupSelector();
    const w = await sel.wallet();
    if (typeof w?.signAndSendTransaction !== 'function') throw new Error('Wallet cannot sign a transaction.');
    const { internalActionToNaj } = await import('@near-wallet-selector/core');
    return w.signAndSendTransaction({
      receiverId: CONTRACT,
      actions: [internalActionToNaj({ type: 'FunctionCall', params: { methodName, args, gas, deposit } })],
    });
  }, [setupSelector]);

  const value = useMemo<Ctx>(() => ({ ...session, connectWallet, demoSession, setHolderToken, setScope, logout, api, signMessage, callContract }), [session, connectWallet, demoSession, setHolderToken, setScope, logout, api, signMessage, callContract]);

  return (
    <SentinelCtx.Provider value={value}>
      {children}
      <Toaster position="bottom-right" theme="dark" richColors closeButton toastOptions={{ style: { background: '#10161D', border: '1px solid rgba(255,255,255,.1)', color: '#EAF0F6' } }} />
    </SentinelCtx.Provider>
  );
}
