import type { ReactNode } from "react";

/** Estado vazio: ícone, título, explicação e uma ação. */
export default function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-6 py-10 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-lg bg-white/[0.05] text-white/60">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icon}</svg>
      </div>
      <h2 className="text-[17px] font-semibold text-white">{title}</h2>
      {description && <p className="mt-1.5 max-w-[300px] text-[14px] leading-relaxed text-white/50">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
