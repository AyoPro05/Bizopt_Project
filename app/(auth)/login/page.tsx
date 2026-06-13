"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
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
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password");
        return;
      }
      router.push("/device-check?next=/ai-studio");
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((prev) => ({ ...prev, email: undefined }));
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((prev) => ({ ...prev, password: undefined }));
  }

  return (
    <div className="card-panel p-8 shadow-[var(--shadow-elevated)]">
      <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Sign in to {APP_NAME}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="on">
        <div>
          <label htmlFor="login-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => updateEmail(e.target.value)}
            required
            error={!!fieldErrors.email}
            ariaDescribedBy={fieldErrors.email ? "login-email-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.email && (
            <p id="login-email-error" className="mt-1 text-xs text-red-700">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="login-password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => updatePassword(e.target.value)}
            required
            error={!!fieldErrors.password}
            ariaDescribedBy={fieldErrors.password ? "login-password-error" : undefined}
            className="mt-1"
          />
          {fieldErrors.password && (
            <p id="login-password-error" className="mt-1 text-xs text-red-700">
              {fieldErrors.password}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        No account?{" "}
        <Link href="/signup" className="text-[var(--color-accent)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
