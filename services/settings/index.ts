import { nowISO } from "@/lib/date";
import type { BackupSettings, Settings } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { THEME_IDS } from "@/features/theme/themes";
import { requireIntInRange, requireOneOf } from "../shared/validation";

const ID = "settings";
const THEME_VALUES = [...THEME_IDS, "escuro", "claro", "sistema"] as const;
const DEFAULT_BACKUP: BackupSettings = { googleConnected: false, autoBackup: false, pending: false };

export type SettingsPatch = Partial<Omit<Settings, "id" | "createdAt" | "updatedAt" | "backup">> & { backup?: Partial<BackupSettings> };

export function createSettingsService(storage: Storage) {
  const repo = () => storage.repo("settings");
  const defaults = (): Settings => {
    const now = nowISO();
    return { id: ID, createdAt: now, updatedAt: now, onboardingCompleted: false, theme: "preto", currency: "BRL", firstDayOfMonth: 1, backup: { ...DEFAULT_BACKUP } };
  };

  async function get(): Promise<Settings> {
    const saved = await repo().get(ID);
    if (!saved) return defaults();
    return { ...defaults(), ...saved, backup: { ...DEFAULT_BACKUP, ...saved.backup } };
  }

  async function update(patch: SettingsPatch): Promise<Settings> {
    const current = await get();
    if (patch.theme !== undefined) requireOneOf(patch.theme, "theme", "o tema", THEME_VALUES);
    if (patch.firstDayOfMonth !== undefined) requireIntInRange(patch.firstDayOfMonth, "firstDayOfMonth", "o dia", 1, 28);
    const { backup, ...rest } = patch;
    const next: Settings = { ...current, ...rest, backup: { ...current.backup, ...backup }, id: ID, updatedAt: nowISO() };
    return repo().put(next);
  }

  return {
    get,
    update,
    isOnboardingCompleted: async () => (await get()).onboardingCompleted,
    completeOnboarding: () => update({ onboardingCompleted: true }),
  };
}
export type SettingsService = ReturnType<typeof createSettingsService>;
