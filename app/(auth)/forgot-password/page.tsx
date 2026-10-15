import type { Metadata } from "next";
import { ForgotPasswordForm, SignInLink } from "@/components/auth/flow-forms";
export const metadata: Metadata = {title:"Forgot password | BizOpt",referrer:"no-referrer",robots:{index:false,follow:false}};
export default function Page(){return <div className="card-panel p-8"><h1 className="font-display text-2xl font-semibold">Forgot your password?</h1><p className="mt-2 text-sm text-[var(--color-ink-muted)]">If an eligible account exists, we’ll send password reset instructions.</p><ForgotPasswordForm/><p className="mt-5 text-sm"><SignInLink/></p></div>;}
