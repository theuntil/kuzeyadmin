"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { cn } from "@/lib/utils";

/**
 * ÜSTTEN İNEN BİLDİRİM
 *
 * Sade: kenarlık yok, rengi tonun kendisi taşıyor (yumuşak zemin +
 * yazı rengi). Önceki sürümde her bildirimde ayrıca renkli bir
 * kenarlık da vardı — iki katmanlı renk gürültü yaratıyordu.
 *
 * Hata bildirimleri kendiliğinden kapanmaz sürede daha uzun kalır;
 * başarı/bilgi kısa sürede kaybolur.
 */
type Kind = "success" | "error" | "info";
interface Item { id: number; kind: Kind; text: string; leaving?: boolean }

interface Ctx {
  toast: (t: string, k?: Kind) => void;
  success: (t: string) => void;
  error: (t: string) => void;
}

const C = React.createContext<Ctx | null>(null);
export function useToast(): Ctx {
  return React.useContext(C) ?? { toast: () => {}, success: () => {}, error: () => {} };
}

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const toast = React.useCallback((text: string, kind: Kind = "info") => {
    const id = ++seq;
    setItems((p) => [...p.slice(-2), { id, kind, text }]);

    const life = kind === "error" ? 5200 : 3000;
    setTimeout(() => {
      setItems((p) => p.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 200);
    }, life);
  }, []);

  const value = React.useMemo<Ctx>(() => ({
    toast,
    success: (t: string) => toast(t, "success"),
    error: (t: string) => toast(t, "error"),
  }), [toast]);

  return (
    <C.Provider value={value}>
      {children}
      {mounted && createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[400] flex flex-col items-center gap-2 p-4">
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-[420px] items-center gap-2.5 rounded-[16px] px-4 py-3.5 text-[13.5px] font-medium leading-[1.5]",
                t.leaving ? "ct-toast-out" : "ct-toast-in",
                t.kind === "error" ? "bg-danger-soft text-danger"
                  : t.kind === "success" ? "bg-green-soft text-green"
                  : "bg-surface text-ink",
              )}
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              {t.kind !== "info" && (
                <Icon name={t.kind === "success" ? "check" : "warn"} size={16} />
              )}
              <span className="min-w-0 flex-1 break-words">{t.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </C.Provider>
  );
}
