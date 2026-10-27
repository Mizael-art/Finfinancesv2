"use client";

/** Aviso de sucesso flutuante (acima da navegação inferior no celular). */
export default function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
      {message && (
        <div className="max-w-[420px] rounded-lg border border-ok/30 bg-panel px-4 py-3 text-[14px] font-medium text-ok shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
