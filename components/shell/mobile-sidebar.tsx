"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/helpers";
import { APP_NAME } from "@/lib/constants";
import { nav } from "./nav-config";
import { useMobileNav } from "./mobile-nav-context";

export function MobileSidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useMobileNav();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, [isOpen]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => { if (query.matches) close(); };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [close]);
  return <dialog ref={dialogRef} aria-labelledby="mobile-nav-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget && event.clientX > event.currentTarget.getBoundingClientRect().right) close(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw_-_2rem))] max-w-none overflow-y-auto border-0 border-r border-[var(--color-border-strong)] bg-[var(--color-card)] p-0 text-[var(--color-ink)] shadow-xl backdrop:bg-black/40">
    <div className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b shell-divider px-5 py-4"><Link id="mobile-nav-title" href="/home" onClick={close} className="font-display text-xl font-semibold">{APP_NAME}</Link><button type="button" onClick={close} aria-label="Close menu" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--color-surface)]"><X className="h-5 w-5"/></button></div>
      <nav className="flex-1 space-y-0.5 p-3" aria-label="Mobile navigation">{nav.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(href + "/"); return <Link key={href} href={href} onClick={close} aria-current={active ? "page" : undefined} className={cn("nav-item relative min-h-11", active && "nav-item-active")}><Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-subtle)]")}/>{label}</Link>; })}</nav>
    </div>
  </dialog>;
}
