import type { Goal } from "@/types/finance";
import { formatBRL } from "@/lib/format";
import GoalActionsRow from "./GoalActionsRow";

type Handlers = { onEdit?: () => void; onAdd?: () => void; onWithdraw?: () => void };

export default function GoalCard({ goal, onEdit, onAdd, onWithdraw }: { goal: Goal } & Handlers) {
  const pct = goal.target > 0 ? Math.min(100, Math.floor((goal.current / goal.target) * 100)) : 0;
  const done = goal.current >= goal.target;

  const header = (
    <>
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[14px] font-black text-white"
        style={{ background: `linear-gradient(180deg, ${goal.tone[0]}, ${goal.tone[1]})` }}
        aria-hidden
      >
        {goal.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{goal.name}</p>
        <p className="truncate text-[13px] tabular-nums text-white/45">
          {formatBRL(goal.current)} de {formatBRL(goal.target)}
        </p>
      </div>
      {done ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-ok/15 px-2.5 py-1 text-[12px] font-semibold text-ok">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 13 4 4L19 7" />
          </svg>
          Concluída
        </span>
      ) : (
        <span className="shrink-0 text-[14px] font-bold tabular-nums text-white/80">{pct}%</span>
      )}
    </>
  );

  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar meta ${goal.name}, ${formatBRL(goal.current)} de ${formatBRL(goal.target)}, ${done ? "concluída" : `${pct}%`}`}
          className="mb-3 flex w-full items-center gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          {header}
        </button>
      ) : (
        <div className="mb-3 flex items-center gap-3">{header}</div>
      )}

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${goal.tone[0]}, ${goal.tone[1]})` }}
        />
      </div>

      {goal.hint ? (
        <p className={`mt-2 text-[12px] ${goal.hintTone === "late" ? "font-medium text-bad" : "text-white/45"}`}>{goal.hint}</p>
      ) : (
        !done && <p className="mt-2 text-[12px] text-white/45">Prazo: {goal.deadline}</p>
      )}

      <div className="mt-3">
        <GoalActionsRow onAdd={onAdd} onWithdraw={onWithdraw} canWithdraw={goal.current > 0} />
      </div>
    </article>
  );
}
