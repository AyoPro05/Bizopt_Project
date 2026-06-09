"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CircleDot, Laptop2, ShieldCheck } from "lucide-react";

function getFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  return btoa(parts.join("|")).slice(0, 64);
}

export default function DeviceCheckPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "binding" | "done" | "error">("checking");
  const [message, setMessage] = useState("");
  const [sessionLabel, setSessionLabel] = useState("Current browser session");

  useEffect(() => {
    async function check() {
      const browser = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
        ? "Safari"
        : /Chrome/.test(navigator.userAgent)
        ? "Chrome"
        : /Firefox/.test(navigator.userAgent)
        ? "Firefox"
        : "Browser";
      const platform = /Mac/i.test(navigator.userAgent)
        ? "Mac"
        : /Windows/i.test(navigator.userAgent)
        ? "Windows"
        : /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? "iOS"
        : /Android/i.test(navigator.userAgent)
        ? "Android"
        : "Device";
      setSessionLabel(`${platform} · ${browser}`);

      const fp = getFingerprint();
      const res = await fetch(`/api/devices/status?fingerprint=${encodeURIComponent(fp)}`);
      const data = await res.json();
      if (data.bound && data.entitlementActive) {
        router.replace("/home");
        return;
      }
      if (data.bound) {
        setStatus("done");
        setMessage("Session recognized. Continue to billing to complete activation.");
        return;
      }
      setStatus("binding");
    }
    check();
  }, [router]);

  async function bindDevice() {
    setStatus("binding");
    const fp = getFingerprint();
    const res = await fetch("/api/devices/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fingerprint: fp,
        platform: navigator.platform,
        label: "This device",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error === "subscription_inactive"
        ? "Start your subscription first. We will authorize this session immediately after payment."
        : data.error ?? "Could not authorize this session");
      return;
    }
    setStatus("done");
    setMessage("Session authorized. Head to billing to activate your subscription.");
  }

  const statusBadge =
    status === "done"
      ? {
          label: "Authorized Workspace",
          className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        }
      : status === "error"
      ? {
          label: "Authorization Needed",
          className: "bg-amber-50 text-amber-700 border border-amber-200",
        }
      : {
          label: "Verifying Session",
          className: "bg-slate-100 text-slate-600 border border-slate-200",
        };

  return (
    <div className="card-panel p-8 shadow-[var(--shadow-elevated)]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-soft)]">
        <ShieldCheck className="h-6 w-6 text-[var(--color-accent-hover)]" />
      </div>
      <h1 className="text-center font-display text-2xl font-semibold">Secure workspace session</h1>
      <p className="mt-2 text-center text-sm text-[var(--color-ink-muted)]">
        We verify this session so background automation tasks stay synchronized safely with your
        account across publishing, growth, and compliance workflows.
      </p>

      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-card)] shadow-[var(--shadow-card)]">
              <Laptop2 className="h-4 w-4 text-[var(--color-ink-muted)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-ink)]">Current Active Session</p>
              <p className="truncate text-xs text-[var(--color-ink-muted)]">{sessionLabel}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}>
            <CircleDot className="h-3 w-3" />
            {statusBadge.label}
          </span>
        </div>
      </div>

      {message && <p className="mt-4 text-center text-sm text-[var(--color-ink-muted)]">{message}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {status !== "done" && (
          <Button onClick={bindDevice} disabled={status === "checking"}>
            {status === "binding" ? "Authorizing..." : "Authorize this session"}
          </Button>
        )}
        <Button variant="secondary" onClick={() => router.push("/billing")}>
          Go to billing
        </Button>
        <Button variant="ghost" onClick={() => router.push("/home")}>
          Skip to Home
        </Button>
      </div>
    </div>
  );
}
