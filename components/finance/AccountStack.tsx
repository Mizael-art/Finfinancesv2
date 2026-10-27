import type { WalletCard } from "@/types/finance";
import AccountCard from "./AccountCard";

export default function AccountStack({ accounts, hidden }: { accounts: WalletCard[]; hidden?: boolean }) {
  return (
    <div role="list" aria-label="Contas" className="absolute inset-0">
      {accounts.map((a, i) => (
        <AccountCard key={a.id} account={a} index={i} hidden={hidden} />
      ))}
    </div>
  );
}
