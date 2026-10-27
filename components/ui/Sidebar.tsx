"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MORE_LINKS } from "@/features/more/links";

const MAIN = [
  { href: "/", label: "Início" },
  { href: "/transacoes", label: "Transações" },
  { href: "/contas", label: "Contas" },
  { href: "/cartoes", label: "Cartões" },
];

/** (versão de desenvolvimento — se o seu projeto tem uma Sidebar própria, mantenha a sua e adicione estes links) */
export default function Sidebar() {
  const pathname = usePathname();
  const links = [...MAIN, ...MORE_LINKS.map((l) => ({ href: l.href, label: l.label }))];
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-1 overflow-y-auto border-r border-white/[0.06] bg-canvas p-5 lg:flex">
      <p className="mb-4 text-[20px] font-bold text-white">FinFinance</p>
      <nav aria-label="Navegação lateral" className="flex flex-col gap-1">
        {links.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-xl px-3 py-2 transition hover:bg-white/[0.05] ${active ? "bg-white/[0.08] text-white" : "text-white/70"}`}>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
