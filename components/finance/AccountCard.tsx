import type { CSSProperties } from "react";
import type { WalletCard } from "@/types/finance";
import { box, cq } from "@/lib/wallet";
import { formatBRL } from "@/lib/format";

function Wordmark({ kind, label }: { kind: WalletCard["wordmark"]; label?: string }) {
  const base: CSSProperties = { fontWeight: 900, lineHeight: 1, color: "#fff" };
  if (kind === "inter") return <span style={{ ...base, fontSize: cq(50), fontStyle: "italic", letterSpacing: "-0.02em", color: "#FFD9C2" }}>inter</span>;
  if (kind === "c6") return <span style={{ ...base, fontSize: cq(54), letterSpacing: "-0.04em" }}>C6</span>;
  if (kind === "nu") return <span style={{ ...base, fontSize: cq(62), letterSpacing: "-0.04em", color: "#E7D6FF" }}>nu</span>;
  return <span style={{ ...base, fontSize: cq(50), letterSpacing: "-0.02em" }}>{label}</span>;
}

export default function AccountCard({ account, index, hidden = false }: { account: WalletCard; index: number; hidden?: boolean }) {
  return (
    <div
      role="listitem"
      className="account-card"
      style={{
        ...box(account.x, account.y, account.w, account.h),
        zIndex: 10 + index,
        animationDelay: `${index * 100}ms`,
        borderRadius: `${cq(72)} ${cq(72)} 0 0`,
        background: `linear-gradient(180deg, ${account.gradient[0]}, ${account.gradient[1]})`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 -8px 24px -12px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ height: cq(110), padding: `0 ${cq(38)} 0 ${cq(40)}` }} className="flex items-center justify-between">
        <Wordmark kind={account.wordmark} label={account.label ?? account.name} />
        <span style={{ fontSize: cq(33) }} className="font-semibold tabular-nums text-white/85">
          {hidden ? "R$••••" : formatBRL(account.balance)}
        </span>
      </div>
    </div>
  );
}
