"use client";

import React, { createContext, useContext, useState, useCallback, useId } from "react";
import { ToastContainer, type ToastProps } from "@/components/ui/toast";

interface Toast extends ToastProps {
  id: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (
    message: string,
    type?: ToastProps["type"],
    duration?: number
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const baseId = useId();

  const addToast = useCallback(
    (message: string, type: ToastProps["type"] = "info", duration = 5000) => {
      const toastId = `${baseId}-${Date.now()}-${Math.random()}`;
      const newToast: Toast = { id: toastId, message, type, duration };
      setToasts((prev) => [...prev, newToast]);
      return toastId;
    },
    [baseId]
  );

  const removeToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
