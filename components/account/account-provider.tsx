"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type AccountSession = { id: string; label: string; createdAt: string; lastUsedAt: string; expiresAt: string; current?: boolean };
export type AccountData = {
  user: { id: string; email: string; name: string | null; emailVerified: boolean | string | null };
  currentSessionId: string | null;
  sessions: AccountSession[];
  mobileSessions: AccountSession[];
  workspace: { id: string; name: string; role: string; planLabel: string; memberCount: number; canInvite: boolean; inviteDisabledReason?: string | null; canManageBilling: boolean };
  workspaces: { id: string; name: string; role: string }[];
  capabilities: string[];
  supportStaff: boolean;
  preferences: { supportEmail: boolean; localDraftRecovery: boolean };
  deletionPolicy?: Record<string, unknown>;
};

export async function accountRequest<T>(url: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "The request could not be completed. Please try again.");
  return data as T;
}

type ContextValue = { account: AccountData | null; loading: boolean; error: string; refresh: () => Promise<void>; update: (body: Record<string, unknown>) => Promise<unknown> };
const AccountContext = createContext<ContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const requestedGeneration = generation.current;
    try {
      const data = await accountRequest<AccountData>("/api/account");
      if (mounted.current && requestedGeneration === generation.current) { setAccount(data); setError(""); }
    } catch (err) { if (mounted.current && requestedGeneration === generation.current) setError(err instanceof Error ? err.message : "Account details are unavailable."); }
    finally { if (mounted.current && requestedGeneration === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const clear = () => { generation.current += 1; setAccount(null); };
    window.addEventListener("bizopt:account-cleared", clear);
    return () => { mounted.current = false; window.removeEventListener("bizopt:account-cleared", clear); };
  }, [refresh]);
  async function update(body: Record<string, unknown>) {
    const result = await accountRequest("/api/account", body);
    await refresh();
    return result;
  }
  return <AccountContext.Provider value={{ account, loading, error, refresh, update }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("AccountProvider is required.");
  return context;
}
