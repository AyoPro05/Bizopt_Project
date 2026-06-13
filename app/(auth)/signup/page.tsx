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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    orgName?: string;
    email?: string;
    password?: string;
  }>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (form.orgName.length > 100) next.orgName = "Workspace name is too long.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nextFieldErrors = validate();
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const flatten = data.error?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        if (flatten) {
          setFieldErrors({
            name: flatten.name?.[0],
            orgName: flatten.orgName?.[0],
            email: flatten.email?.[0],
            password: flatten.password?.[0],
          });
        }
        setError(data.error?.email?.[0] ?? data.error ?? "Signup failed");
        return;
      }
      await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      router.push("/device-check?next=/ai-studio");
    } catch {
      setError("Unable to create account right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <div className="card-panel p-8 shadow-[var(--shadow-elevated)]">
      <h1 className="font-display text-2xl font-semibold">Create your workspace</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        {BILLING.trialDisplayPrice} for {BILLING.trialDays} days, then {BILLING.displayPrice}/mo
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="on">
        <div>
          <label htmlFor="signup-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="signup-name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
            error={!!fieldErrors.name}
            ariaDescribedBy={fieldErrors.name ? "signup-name-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.name && (
            <p id="signup-name-error" className="mt-1 text-xs text-red-700">
              {fieldErrors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="signup-org" className="text-sm font-medium">
            Workspace
          </label>
          <Input
            id="signup-org"
            name="organization"
            autoComplete="organization"
            value={form.orgName}
            onChange={(e) => updateField("orgName", e.target.value)}
            placeholder="My business"
            error={!!fieldErrors.orgName}
            ariaDescribedBy={fieldErrors.orgName ? "signup-org-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.orgName && (
            <p id="signup-org-error" className="mt-1 text-xs text-red-700">
              {fieldErrors.orgName}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="signup-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
            error={!!fieldErrors.email}
            ariaDescribedBy={fieldErrors.email ? "signup-email-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.email && (
            <p id="signup-email-error" className="mt-1 text-xs text-red-700">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="signup-password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            required
            minLength={8}
            error={!!fieldErrors.password}
            ariaDescribedBy={fieldErrors.password ? "signup-password-error" : undefined}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">At least 8 characters</p>
          {fieldErrors.password && (
            <p id="signup-password-error" className="mt-1 text-xs text-red-700">
              {fieldErrors.password}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-accent)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
