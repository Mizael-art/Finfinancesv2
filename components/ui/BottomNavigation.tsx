"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MORE_PATHS } from "@/features/more/links";

const items = [
  { href: "/", label: "Início", icon: (a: boolean) => <path d={a ? "M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" : "M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"} fill={a ? "currentColor" : "none"} /> },
  { href: "/transacoes", label: "Transações", icon: () => <path d="M7 7h13M7 7 10 4M7 7l3 3M17 17H4M17 17l-3 3M17 17l-3-3" /> },
  { href: "/contas", label: "Contas", icon: () => <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M3 10h18M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" /></> },
  { href: "/cartoes", label: "Cartões", icon: () => <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></> },
  { href: "/mais", label: "Mais", icon: () => <><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></> },
];

export default function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-canvas/90 pb-[max(env(safe-area-inset-bottom,0px),10px)] backdrop-blur-lg"
    >
      <div className="mx-auto flex max-w-[460px] items-stretch justify-between px-2">
        {items.map((it) => {
          const active =
            it.href === "/" ? pathname === "/"
            : it.href === "/mais" ? MORE_PATHS.some((p) => pathname?.startsWith(p))
            : pathname?.startsWith(it.href);
          return (
            <Link
              key={it.href}
              aria-current={active ? "page" : undefined}
              href={it.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {it.icon(!!active)}
              </svg>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
