"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { postIdentity, ResendVerificationForm, SignInLink } from "./flow-forms";

export function AccountSecurityForm({emailVerified,email}:{emailVerified:boolean;email?:string}) {
  const [currentPassword,setCurrentPassword]=useState("");const [password,setPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");const [emailPassword,setEmailPassword]=useState("");const [newEmail,setNewEmail]=useState("");const [busy,setBusy]=useState<"password"|"email"|null>(null);const [error,setError]=useState("");const [message,setMessage]=useState("");const [signedOut,setSignedOut]=useState(false);
  async function save(event:React.FormEvent,kind:"password"|"email") {
    event.preventDefault();setBusy(kind);setError("");setMessage("");
    if(kind === "password" && password!==confirmPassword){setError("Passwords must match.");setBusy(null);return;}
    try {
      const response=await postIdentity(kind === "password" ? "/api/account/password" : "/api/account/email/request",kind === "password" ? {currentPassword,password,confirmPassword} : {currentPassword:emailPassword,email:newEmail});
      setCurrentPassword("");setPassword("");setConfirmPassword("");setEmailPassword("");setMessage(response.message);
      if(kind === "password") {setSignedOut(true);await signOut({redirect:false});}
    } catch(caught) {setError(caught instanceof Error ? caught.message : "Please try again.");} finally {setBusy(null);}
  }
  if(!emailVerified) return <section className="card-panel p-5"><h2 className="font-semibold">Verify your email</h2><p className="mt-2 text-sm text-[var(--color-ink-muted)]">Confirm your current email before changing your password or email address.</p><ResendVerificationForm initialEmail={email}/></section>;
  return <section className="card-panel space-y-6 p-5" aria-labelledby="account-security-title">
    <div><h2 id="account-security-title" className="font-semibold">Account security</h2><p className="mt-2 text-sm text-[var(--color-ink-muted)]">All browser and mobile sessions, including this session, are revoked after a password or email change.</p></div>
    {error && <p role="alert" className="text-sm text-[var(--color-danger-fg)]">{error}</p>}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    {signedOut ? <SignInLink>Sign in again</SignInLink> : <>
      <form onSubmit={event=>save(event,"password")} className="space-y-4" aria-labelledby="change-password-title">
        <h3 id="change-password-title" className="font-medium">Change password</h3>
        <div><label htmlFor="account-current-password" className="text-sm">Current password</label><Input id="account-current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={100} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} className="mt-1"/></div>
        <div><label htmlFor="account-new-password" className="text-sm">New password</label><Input id="account-new-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event=>setPassword(event.target.value)} className="mt-1" ariaDescribedBy="account-password-help"/><p id="account-password-help" className="mt-1 text-xs text-[var(--color-ink-muted)]">At least 8 characters; no more than 72 UTF-8 bytes.</p></div>
        <div><label htmlFor="account-confirm-password" className="text-sm">Confirm new password</label><Input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} className="mt-1"/></div>
        <Button type="submit" disabled={busy!==null}>{busy === "password" ? "Saving…" : "Change password"}</Button>
      </form>
      <form onSubmit={event=>save(event,"email")} className="space-y-4 border-t border-[var(--color-border)] pt-5" aria-labelledby="change-email-title">
        <h3 id="change-email-title" className="font-medium">Change email</h3><p className="text-sm text-[var(--color-ink-muted)]">Your current email stays active until you confirm the new address. A security notice will then be queued for your old address.</p>
        <div><label htmlFor="account-new-email" className="text-sm">New email address</label><Input id="account-new-email" name="email" type="email" autoComplete="email" required maxLength={254} value={newEmail} onChange={event=>setNewEmail(event.target.value)} className="mt-1"/></div>
        <div><label htmlFor="account-email-password" className="text-sm">Current password</label><Input id="account-email-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={100} value={emailPassword} onChange={event=>setEmailPassword(event.target.value)} className="mt-1"/></div>
        <Button type="submit" disabled={busy!==null}>{busy === "email" ? "Queuing…" : "Send new email confirmation"}</Button>
      </form>
    </>}
  </section>;
}
