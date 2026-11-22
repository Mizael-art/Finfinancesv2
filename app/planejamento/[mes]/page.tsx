import PlanningMonthView from "@/components/planning/PlanningMonthView";

export const metadata = { title: "Planejamento do mês · FinFinance" };

export default async function PlanejamentoMesPage({ params, searchParams }: { params: Promise<{ mes: string }>; searchParams: Promise<{ est?: string }> }) {
  const [{ mes }, { est }] = await Promise.all([params, searchParams]);
  // Formato "YYYY-MM"; qualquer outra coisa cai na mensagem de "fora do planejamento".
  const key = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : "0000-01";
  return <PlanningMonthView key={`${key}:${est ?? ""}`} monthKey={key} initialEstimate={est !== "0"} />;
}
