import { cn } from "@/lib/helpers";
import { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-panel p-6", className)} {...props}>
      {children}
    </div>
  );
}
