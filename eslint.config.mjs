/*
 * ESLINT — REACT HOOK KURALLARI
 *
 * ┌─ NEDEN VAR ⚠️ ─────────────────────────────────────────────┐
 * │ Projede hiç ESLint yapılandırması yoktu. `next build` ve   │
 * │ `tsc` hook hatalarını GÖREMİYOR: ikisi de tip ve sözdizim  │
 * │ denetliyor, çalışma zamanı davranışını değil.               │
 * │                                                              │
 * │ Mobil menüyü çökerten hata tam da buydu: erken `return`     │
 * │ sonrasına konmuş bir `useState`. Derleme temiz geçti,       │
 * │ kullanıcı menüyü açınca uygulama patladı.                   │
 * │                                                              │
 * │ `rules-of-hooks` bunu HATA olarak yakalıyor.                │
 * └──────────────────────────────────────────────────────────────┘
 */
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/**", "node_modules/**", "out/**", "public/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    /*
     * ⚠ NEXT EKLENTİSİ KAYITLI OLMAK ZORUNDA.
     * Kaynak dosyalarda satır içi
     * `eslint-disable-next-line @next/next/no-img-element`
     * yorumları var. Eklenti yüklü değilse ESLint o kuralı
     * bulamıyor ve HATA veriyor — derleme düşüyor.
     */
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      /* Koşullu / erken çıkış sonrası hook — uygulamayı çökertir */
      "react-hooks/rules-of-hooks": "error",
      /* Eksik bağımlılık: bayat veri ve sonsuz döngü kaynağı */
      "react-hooks/exhaustive-deps": "warn",

      /* Gürültüyü azalt: bunlar tip güvenliğini etkilemiyor */
      "@typescript-eslint/no-explicit-any": "off",
      /* `<img>` bilinçli: görseller R2'den, next/image devre dışı */
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_", varsIgnorePattern: "^_",
      }],
    },
  },
];
