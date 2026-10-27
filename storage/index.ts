import { createIndexedDbStorage } from "./indexeddb";
import type { Storage } from "./types";

let instance: Storage | null = null;

/** Único ponto que escolhe o adaptador. Para migrar para Supabase, devolva outro `Storage` aqui. */
export function getStorage(): Storage {
  if (!instance) instance = createIndexedDbStorage();
  return instance;
}
export type { Storage } from "./types";
