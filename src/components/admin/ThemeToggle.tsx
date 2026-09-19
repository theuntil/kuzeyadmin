"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

/** Açık/koyu tema anahtarı — tercih localStorage'da */
export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setDark(t !== "light");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("kb-theme", next); } catch { /* gizli sekme */ }
    setDark(!dark);
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Açık tema" : "Koyu tema"}
      title={dark ? "Açık tema" : "Koyu tema"}
      className="flex h-8 w-8 items-center justify-center rounded-full text-deep-muted transition-colors hover:bg-white/[.06] hover:text-on-deep"
    >
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}
