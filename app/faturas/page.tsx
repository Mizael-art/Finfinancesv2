import { Suspense } from "react";
import InvoicesView from "@/components/invoices/InvoicesView";

export default function FaturasPage() {
  return (
    <Suspense fallback={null}>
      <InvoicesView />
    </Suspense>
  );
}
