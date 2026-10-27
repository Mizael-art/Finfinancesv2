import { ValidationError } from "@/lib/errors";
import { isValidISODate } from "@/lib/date";

export function requireText(value: unknown, field: string, label: string, max = 120): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new ValidationError(`Informe ${label}.`, field);
  if (text.length > max) throw new ValidationError(`Use no máximo ${max} caracteres em ${label}.`, field);
  return text;
}

export function optionalText(value: unknown, field: string, label: string, max = 500): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  if (text.length > max) throw new ValidationError(`Use no máximo ${max} caracteres em ${label}.`, field);
  return text;
}

/** Centavos inteiros, nunca fracionários nem NaN. */
export function requireCents(value: unknown, field: string, label: string, min = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ValidationError(`O ${label} precisa ser um valor válido.`, field);
  if (value < min) throw new ValidationError(min >= 1 ? `O ${label} precisa ser maior que zero.` : `O ${label} não pode ser negativo.`, field);
  return value;
}

export function requireIntInRange(value: unknown, field: string, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`Informe ${label} entre ${min} e ${max}.`, field);
  }
  return value;
}

export function requireDate(value: unknown, field: string, label: string): string {
  if (typeof value !== "string" || !isValidISODate(value)) throw new ValidationError(`Informe ${label} válida.`, field);
  return value;
}

export function optionalDate(value: unknown, field: string, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requireDate(value, field, label);
}

export function requireOneOf<T extends string>(value: unknown, field: string, label: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new ValidationError(`Escolha ${label} válida.`, field);
  return value as T;
}

/** Minúsculas sem acento, para busca e comparação de nomes. */
export const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Remove chaves com valor undefined (o IndexedDB aceitaria, mas deixa o registro limpo). */
export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
