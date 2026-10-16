"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { safeInternalDestination } from "@/lib/redirect-url";
import { captureIdentityProof, type CapturedProof } from "./proof";

function callbackQuery() {
  const raw=new URLSearchParams(window.location.search).get("callbackUrl");
  return raw ? `?callbackUrl=${encodeURIComponent(safeInternalDestination(raw,window.location.origin))}` : "";
}
export function SignInLink({children="Sign in"}:{children?:React.ReactNode}) {
  const [query,setQuery]=useState("");useEffect(()=>setQuery(callbackQuery()),[]);
  return <Link href={`/login${query}`} className="text-[var(--color-accent)] hover:underline">{children}</Link>;
}
export async function postIdentity(url:string,body:unknown) {
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"same-origin",cache:"no-store",referrerPolicy:"no-referrer"});
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "This action could not be completed. Please try again.");
  return data as {ok:boolean;message:string};
}
function EmailRequestForm({mode,initialEmail=""}:{mode:"verification"|"reset";initialEmail?:string}) {
  const [email,setEmail]=useState(initialEmail);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");const [cooldown,setCooldown]=useState(0);
  useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  const id=mode === "reset" ? "recovery-email" : "verification-email";
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try {
      const callbackUrl=safeInternalDestination(new URLSearchParams(window.location.search).get("callbackUrl"),window.location.origin);
      const result=await postIdentity(`/api/auth/${mode === "reset" ? "password-reset" : "verification"}/request`,{email,callbackUrl});
      setMessage(result.message);setCooldown(60);
    } catch(caught) {setError(caught instanceof Error ? caught.message : "Please try again.");} finally {setBusy(false);}
  }
  return <form onSubmit={submit} className="mt-5 space-y-4">
    <div><label htmlFor={id} className="text-sm font-medium">Email address</label><Input id={id} name="email" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254} className="mt-1"/></div>
    {error && <p role="alert" className="text-sm text-[var(--color-danger-fg)]">{error}</p>}
    <p role="status" aria-live="polite" className="text-sm text-[var(--color-ink-muted)]">{message}{cooldown>0 && ` You can request another email in ${cooldown} seconds.`}</p>
    <Button type="submit" disabled={busy || cooldown>0} className="w-full">{busy ? "Queuing request…" : cooldown>0 ? `Wait ${cooldown}s` : mode === "reset" ? "Request password reset" : "Resend verification email"}</Button>
  </form>;
}
export function ForgotPasswordForm() {return <EmailRequestForm mode="reset"/>;}
export function ResendVerificationForm({initialEmail}:{initialEmail?:string}) {return <EmailRequestForm mode="verification" initialEmail={initialEmail}/>;}

export function ProofConfirmation({mode}:{mode:"verification"|"reset"}) {
  const [proof,setProof]=useState<CapturedProof|null>(null);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");const [password,setPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");const captured=useRef(false);
  useEffect(()=>{if(captured.current)return;captured.current=true;setProof(captureIdentityProof(window.location,window.history));setLoaded(true);},[]);
  const emailChange=proof?.purpose === "email-change";
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(!proof)return;setBusy(true);setError("");
    if(mode === "reset" && password !== confirmPassword){setError("Passwords must match.");setBusy(false);return;}
    try {
      const endpoint=mode === "reset" ? "/api/auth/password-reset/confirm" : emailChange ? "/api/account/email/confirm" : "/api/auth/verification/confirm";
      const result=await postIdentity(endpoint,{id:proof.id,token:proof.token,...(mode === "reset" ? {password,confirmPassword} : {})});
      setProof(null);setPassword("");setConfirmPassword("");setMessage(result.message);
    } catch(caught) {setError(caught instanceof Error ? caught.message : "Please try again.");} finally {setBusy(false);}
  }
  return <div className="card-panel p-8 shadow-[var(--shadow-elevated)]">
    <h1 className="font-display text-2xl font-semibold">{mode === "reset" ? "Reset your password" : emailChange ? "Confirm your new email" : "Confirm your email"}</h1>
    <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{mode === "reset" ? "Choose a new password. You will need to sign in again after saving it." : emailChange ? "Stay signed in to the account that requested this change, then confirm your new address. If needed, sign in and reopen the original email link." : "Use the button below to finish verification. This does not activate paid access."}</p>
    {message ? <><p role="status" className="mt-5 text-sm">{message}</p><p className="mt-4"><SignInLink>Sign in to continue</SignInLink></p></> : loaded && !proof ? <>
      <p role="alert" className="mt-5 text-sm">This link is missing, invalid or obsolete. Request a new email below.</p>
      {mode === "reset" ? <ForgotPasswordForm/> : <ResendVerificationForm/>}
    </> : <form onSubmit={submit} className="mt-5 space-y-4">
      {mode === "reset" && <>
        <div><label htmlFor="reset-password" className="text-sm font-medium">New password</label><Input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event=>setPassword(event.target.value)} className="mt-1" ariaDescribedBy="reset-password-help"/><p id="reset-password-help" className="mt-1 text-xs text-[var(--color-ink-muted)]">At least 8 characters; no more than 72 UTF-8 bytes.</p></div>
        <div><label htmlFor="reset-confirm-password" className="text-sm font-medium">Confirm new password</label><Input id="reset-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} className="mt-1"/></div>
      </>}
      {error && <p role="alert" className="text-sm text-[var(--color-danger-fg)]">{error}</p>}
      <Button type="submit" disabled={busy || !proof} className="w-full">{busy ? "Saving…" : mode === "reset" ? "Save new password" : emailChange ? "Confirm new email" : "Confirm email"}</Button>
    </form>}
    {!message && <p className="mt-5 text-sm"><SignInLink/></p>}
  </div>;
}
