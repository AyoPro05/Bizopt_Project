"use client";

import {
  useEffect,
  useRef,
  ReactNode,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/helpers";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  closeLabel?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = "md",
  closeLabel = "Close",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${useId().replace(/:/g, "")}`;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => dialogRef.current?.focus(), 0);

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeydown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeydown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "flex max-h-[90dvh] w-full flex-col gap-4 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-elevated)] outline-none",
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {title && (
            <h2 id={titleId} className="font-display text-xl font-semibold text-[var(--color-ink)]">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-lg p-1 text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
