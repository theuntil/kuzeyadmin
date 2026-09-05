import { Skeleton } from "@/components/ui";

/**
 * İÇERİK İSKELETİ
 *
 * ┌─ YALNIZCA İÇERİK ⚠️ ──────────────────────────────────────┐
 * │ Kenar çubuğu layout'ta olduğu için burada YOK. Eskiden     │
 * │ tüm ekran iskelete dönüyordu ve menü kayboluyordu; sayfa   │
 * │ geçişlerinde panel yeniden açılıyor gibi duruyordu.        │
 * │                                                              │
 * │ Artık menü yerinde kalıyor, yalnızca sağdaki içerik alanı  │
 * │ bekliyor.                                                    │
 * └──────────────────────────────────────────────────────────────┘
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-9 w-52" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    </div>
  );
}
