import { getStorage } from "@/storage";
import type { ChangeEvent, Storage } from "@/storage/types";
import { createAccountsService } from "./accounts";
import { createBackupService } from "./backup";
import { createBudgetsService } from "./budgets";
import { createCardsService } from "./cards";
import { createCategoriesService } from "./categories";
import { createGoalsService } from "./goals";
import { createIncomeService } from "./income";
import { createInvestmentsService } from "./investments";
import { createInvoicesService } from "./invoices";
import { createOnboardingService } from "./onboarding";
import { createRecurrencesService } from "./recurrences";
import { createReportsService } from "./reports";
import { createSettingsService } from "./settings";
import { createTransactionsService } from "./transactions";
import { createUsersService } from "./users";

/** Monta todos os services sobre um `Storage` (testes passam um banco isolado). */
export function createServices(storage: Storage) {
  return {
    accounts: createAccountsService(storage),
    transactions: createTransactionsService(storage),
    cards: createCardsService(storage),
    invoices: createInvoicesService(storage),
    categories: createCategoriesService(storage),
    budgets: createBudgetsService(storage),
    goals: createGoalsService(storage),
    reports: createReportsService(storage),
    backup: createBackupService(storage),
    income: createIncomeService(storage),
    recurrences: createRecurrencesService(storage),
    investments: createInvestmentsService(storage),
    settings: createSettingsService(storage),
    users: createUsersService(storage),
    onboarding: createOnboardingService(storage),
    /** Avisa a cada gravação (base da UI reativa e do backup automático). */
    subscribe: (listener: (event: ChangeEvent) => void) => storage.subscribe(listener),
  };
}
export type Services = ReturnType<typeof createServices>;

let services: Services | null = null;
/** Só no cliente (efeitos e handlers): o IndexedDB abre no primeiro uso. */
export function getServices(): Services {
  if (!services) services = createServices(getStorage());
  return services;
}
