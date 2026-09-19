"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "./index";
import { cn } from "@/lib/utils";

/**
 * PENCERE
 *
 * Masaüstünde ortada, mobilde alttan. Escape ile kapanır ve
 * arka plan kaydırması durur.
 */
export function Modal({
  open, onClose, title, children, footer, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div className="ct-fade absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line bg-page sm:rounded-[24px]",
          wide ? "sm:max-w-[720px]" : "sm:max-w-[520px]",
        )}
        style={{ animation: "ct-modal-in .28s var(--ease-ct) both", boxShadow: "var(--shadow)" }}
      >
        <header className="flex items-center gap-3 border-b border-line2 px-6 py-4">
          <h2 className="flex-1 text-[16px] font-semibold tracking-[-.01em]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-chip hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="ct-scrollbar flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-2.5 border-t border-line2 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Onay penceresi — silme gibi geri alınamaz işlemler için */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = "Onayla", loading, danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Vazgeç</Button>
          <Button
            variant={danger ? "danger" : "accent"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-[14px] leading-[1.65] text-ink2">{description}</p>}
    </Modal>
  );
}
