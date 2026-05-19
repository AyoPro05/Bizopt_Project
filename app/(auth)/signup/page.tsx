"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BILLING } from "@/lib/constants";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", orgName: "" });
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.email?.[0] ?? data.error ?? "Signup failed");
      return;
    }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.push("/device-check?next=/ai-studio");
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-lg">
      <h1 className="font-display text-2xl font-semibold">Create your workspace</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        {BILLING.trialDisplayPrice} for {BILLING.trialDays} days, then {BILLING.displayPrice}/mo
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Workspace</label>
          <Input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} placeholder="My business" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} className="mt-1" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        Already have an account? <Link href="/login" className="text-[var(--color-accent)] hover:underline">Log in</Link>
      </p>
    </div>
  );
}
