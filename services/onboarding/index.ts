import { nowISO, todayISODate } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import type { OnboardingDraft } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { createAccountsService } from "../accounts";
import { createCategoriesService } from "../categories";
import { createIncomeService } from "../income";
import { createRecurrencesService } from "../recurrences";
import { createSettingsService } from "../settings";
import { createUsersService } from "../users";
import { activeFixedExpenses, activeIncomes, emptyDraft, hasErrors, validateAll } from "./compute";

export * from "./compute";

export type OnboardingMode = "first" | "edit";

/**
 * Primeiro acesso: perfil, renda (só como referência de planejamento), objetivos e, se a pessoa quiser,
 * a primeira conta, gastos fixos e um limite mensal. NADA aqui vira transação: renda não é saldo,
 * e o saldo inicial é só o saldo de abertura da conta.
 */
export function createOnboardingService(storage: Storage) {
  const settings = createSettingsService(storage);
  const users = createUsersService(storage);
  const income = createIncomeService(storage);
  const accounts = createAccountsService(storage);
  const categories = createCategoriesService(storage);
  const recurrences = createRecurrencesService(storage);

  /** Rascunho salvo (para retomar) ou, se já concluído, os valores atuais para editar. */
  async function load(): Promise<{ draft: OnboardingDraft; completed: boolean }> {
    const [s, user, sources] = await Promise.all([settings.get(), users.getCurrent(), income.list()]);
    const base = emptyDraft();
    if (!s.onboardingCompleted) return { draft: { ...base, ...(s.onboardingDraft ?? {}) }, completed: false };
    const draft: OnboardingDraft = {
      ...base, step: 1,
      name: user?.name ?? "", nickname: user?.nickname ?? "",
      goals: s.financialGoals ?? [], monthlyLimitCents: s.monthlyLimitCents ?? 0,
    };
    if (sources.length > 0) {
      draft.incomeMode = sources.length > 1 ? "varias" : sources[0].kind === "variavel" ? "variavel" : "fixa";
      draft.incomes = sources.map((x) => ({ name: x.name, amountCents: x.amountCents }));
      draft.payDay = sources.find((x) => x.isPrimary)?.payDay ?? sources[0].payDay;
    } else draft.incomeMode = "depois";
    return { draft, completed: true };
  }

  return {
    load,

    async saveDraft(draft: OnboardingDraft): Promise<void> {
      if ((await settings.get()).onboardingCompleted) return; // só o primeiro acesso guarda rascunho
      await settings.update({ onboardingDraft: draft });
    },

    async complete(draft: OnboardingDraft, mode: OnboardingMode = "first") {
      const errors = validateAll(mode === "edit" ? { ...draft, accountName: "", accountBalanceCents: 0, fixedExpenses: [] } : draft);
      if (hasErrors(errors)) throw new ValidationError(Object.values(errors)[0] ?? "Confira os dados.");

      await users.save({ name: draft.name, nickname: draft.nickname });

      // Renda: referência de planejamento, não entra em transações nem no saldo.
      const sources = activeIncomes(draft);
      const existing = await income.list();
      const kind = draft.incomeMode === "variavel" ? "variavel" : "fixa";
      for (const [i, row] of sources.entries()) {
        const found = existing[i];
        const data = { name: row.name, amountCents: row.amountCents, payDay: draft.payDay, kind: kind as "fixa" | "variavel", isPrimary: i === 0 };
        if (found) await income.update(found.id, data);
        else await income.create(data);
      }
      if (mode === "edit") for (const extra of existing.slice(sources.length)) await income.remove(extra.id); // renda que foi removida da lista

      if (mode === "first") {
        if ((await categories.list()).length === 0) await categories.seedDefaults();
        if (draft.accountName.trim()) {
          const same = (await accounts.list({ includeArchived: true })).find((a) => a.name.trim().toLowerCase() === draft.accountName.trim().toLowerCase());
          if (!same) await accounts.create({ name: draft.accountName.trim(), type: "corrente", initialBalanceCents: draft.accountBalanceCents });
        }
        const today = todayISODate();
        const known = new Set((await recurrences.list()).map((r) => r.description.trim().toLowerCase()));
        for (const e of activeFixedExpenses(draft)) {
          if (known.has(e.name.trim().toLowerCase())) continue;
          // startDate/lastGeneratedDate = hoje: nada é lançado retroativamente; vale a partir da próxima data de vencimento.
          await recurrences.create({ type: "despesa", description: e.name.trim(), amountCents: e.amountCents, frequency: "mensal", dayOfMonth: e.day, active: true, startDate: today, lastGeneratedDate: today });
        }
      }

      await settings.update({
        onboardingCompleted: true,
        financialGoals: draft.goals,
        monthlyLimitCents: draft.monthlyLimitCents > 0 ? draft.monthlyLimitCents : undefined,
        onboardingDraft: undefined,
      });
      return { completedAt: nowISO() };
    },
  };
}
export type OnboardingService = ReturnType<typeof createOnboardingService>;
