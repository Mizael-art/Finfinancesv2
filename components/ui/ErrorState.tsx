"use client";

export default function ErrorState({ title = "Não foi possível carregar.", description = "Seus dados continuam salvos neste aparelho. Tente novamente.", onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-bad/25 bg-bad/[0.06] px-6 py-8 text-center">
      <p className="text-[16px] font-semibold text-white">{title}</p>
      <p className="mt-1.5 max-w-[300px] text-[14px] leading-relaxed text-white/55">{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 h-11 rounded-lg border border-white/[0.1] bg-white/[0.06] px-5 text-[14px] font-semibold text-white transition active:scale-95 hover:bg-white/[0.1]">
          Tentar novamente
        </button>
      )}
    </div>
  );
}
