"use client";

import { cloneElement, isValidElement, ReactElement, useId, useState } from "react";
import { cn } from "@/lib/helpers";

interface TooltipProps {
  content: React.ReactNode;
  children: ReactElement;
  placement?: "top" | "bottom";
  className?: string;
}

const placements = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
};

export function Tooltip({ content, children, placement = "top", className }: TooltipProps) {
  const id = useId();
  const tooltipId = `tooltip${id.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {isValidElement(children) &&
        cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-describedby": open ? tooltipId : undefined,
        })}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 w-max rounded-lg px-2 py-1 text-xs font-medium opacity-90",
            "bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-fg)]",
            placements[placement],
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
