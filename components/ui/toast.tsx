import { useEffect, useState } from "react";
import { Check, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/helpers";
import { LoadingSpinner } from "./loading-spinner";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: (id: string) => void;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <Check className="h-5 w-5 flex-shrink-0" />,
  error: <AlertCircle className="h-5 w-5 flex-shrink-0" />,
  info: <AlertCircle className="h-5 w-5 flex-shrink-0" />,
  loading: <LoadingSpinner size="sm" label="" />,
};

const colors: Record<ToastType, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
  loading: "bg-slate-700 text-white",
};

export function Toast({
  id,
  message,
  type = "info",
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (type === "loading") return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose?.(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, type, duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose?.(id), 300);
  };

  return (
    <div
      role="status"
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all duration-300",
        colors[type],
        isExiting && "opacity-0 translate-y-2"
      )}
    >
      <div aria-hidden="true">{icons[type]}</div>
      <p className="text-sm font-medium">{message}</p>
      {type !== "loading" && (
        <button
          onClick={handleClose}
          aria-label="Close notification"
          className="ml-auto hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}
