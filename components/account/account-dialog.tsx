"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/** Native modal supplies focus trapping, background inertness, and Escape dismissal. */
export function AccountDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-card)] p-0 text-[var(--color-ink)] shadow-2xl backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5"><h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose} className="-m-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--color-surface)]"><X className="h-5 w-5" /></button></div>
    <div className="p-5">{children}</div>
  </dialog>;
}
