import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showSuccess: (message: string) => push(message, "success"),
      showError: (message: string) => push(message, "error"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full px-4 md:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border animate-in slide-in-from-bottom-2 duration-200 ${
              t.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {t.type === "error" ? (
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-semibold flex-1 leading-snug">{t.message}</p>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast precisa ser usado dentro de um <ToastProvider>");
  }
  return ctx;
}
