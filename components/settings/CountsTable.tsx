import { compareCounts } from "@/features/backup/viewModels";
import type { StoreName } from "@/storage/types";

/** Tabela "Agora → Backup" por tipo de dado (só mostra o que existe em algum dos lados). */
export default function CountsTable({ current, incoming, heading = "Agora → Backup" }: { current: Record<StoreName, number>; incoming: Record<StoreName, number>; heading?: string }) {
  const rows = compareCounts(current, incoming);
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="flex justify-between text-[11px] uppercase tracking-wide text-white/35"><span>Item</span><span>{heading}</span></p>
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <li key={r.store} className="flex items-center justify-between gap-3 py-2 text-[14px]">
            <span className="capitalize text-white/70">{r.label}</span>
            <span className="tabular-nums text-white"><span className="text-white/45">{r.current}</span> → <span className="font-semibold">{r.incoming}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
