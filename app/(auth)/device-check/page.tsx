"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

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

  useEffect(() => {
    async function check() {
      const fp = getFingerprint();
      const res = await fetch(`/api/devices/status?fingerprint=${encodeURIComponent(fp)}`);
      const data = await res.json();
      if (data.bound && data.entitlementActive) {
        router.replace("/home");
        return;
      }
      if (data.bound) {
        setStatus("done");
        setMessage("Device recognized. Complete billing to unlock features.");
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
        ? "Subscribe first — we'll bind your device after payment."
        : data.error ?? "Could not bind device");
      return;
    }
    setStatus("done");
    setMessage("Device bound. Head to billing to activate your subscription.");
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center shadow-lg">
      <Smartphone className="mx-auto h-12 w-12 text-[var(--color-accent)]" />
      <h1 className="mt-4 font-display text-2xl font-semibold">Device check</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
        BizOpt binds 1 device per subscription to prevent account sharing abuse.
      </p>
      {message && <p className="mt-4 text-sm">{message}</p>}
      <div className="mt-6 flex flex-col gap-3">
        {status !== "done" && (
          <Button onClick={bindDevice} disabled={status === "checking"}>
            {status === "binding" ? "Binding…" : "Bind this device"}
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
