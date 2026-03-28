"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ToastType = "success" | "error" | "warn" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

function getToastBackground(type: ToastType): string {
  switch (type) {
    case "success":
      return "#1B6B3A";
    case "error":
      return "#B83232";
    case "warn":
      return "#9A7209";
    default:
      return "#1A1916";
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    toasts.forEach((t) => {
      if (t.leaving) return;
      // Start fade-out after 2600ms
      const fadeTimer = setTimeout(() => {
        setToasts((prev) =>
          prev.map((item) =>
            item.id === t.id ? { ...item, leaving: true } : item
          )
        );
      }, 2600);
      // Remove completely after 2800ms
      const removeTimer = setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== t.id));
      }, 2800);
      timers.push(fadeTimer, removeTimer);
    });

    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: getToastBackground(t.type),
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              boxShadow: "0 4px 16px rgba(0,0,0,.15)",
              fontFamily: "'DM Sans', sans-serif",
              opacity: t.leaving ? 0 : 1,
              transform: t.leaving ? "translateY(4px)" : "translateY(0)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              animation: t.leaving ? undefined : "toastIn 0.2s ease",
              pointerEvents: "auto",
              maxWidth: 340,
              wordBreak: "break-word",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
