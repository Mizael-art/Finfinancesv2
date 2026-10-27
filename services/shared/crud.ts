import { nowISO } from "@/lib/date";
import { NotFoundError } from "@/lib/errors";
import { newId } from "@/lib/id";
import type { Entity, NewEntity } from "@/types/domain";
import type { Repository, Storage, StoreMap, StoreName } from "@/storage/types";

/** Cria o registro completo (id e carimbos) a partir dos dados já validados. */
export function buildEntity<T extends Entity>(data: NewEntity<T>, id: string = newId()): T {
  const now = nowISO();
  return { ...data, id, createdAt: now, updatedAt: now } as unknown as T;
}

interface CrudOptions<T extends Entity> {
  label: string;
  /** Valida/normaliza os dados completos (criação e edição passam por aqui). */
  normalize?: (data: NewEntity<T>, current?: T) => NewEntity<T> | Promise<NewEntity<T>>;
}

/** CRUD genérico sobre uma store; regras específicas entram por `normalize`. */
export function createCrud<K extends StoreName, T extends Entity = StoreMap[K] & Entity>(
  storage: Storage,
  store: K,
  options: CrudOptions<T>,
) {
  const repo = () => storage.repo(store) as unknown as Repository<T>;
  const strip = (e: T): NewEntity<T> => {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = e;
    void _i; void _c; void _u;
    return rest as unknown as NewEntity<T>;
  };

  return {
    repo,
    get: (id: string) => repo().get(id),
    list: () => repo().list(),
    async require(id: string): Promise<T> {
      const found = await repo().get(id);
      if (!found) throw new NotFoundError(options.label, id);
      return found;
    },
    async create(input: NewEntity<T>): Promise<T> {
      const data = options.normalize ? await options.normalize(input) : input;
      return repo().put(buildEntity<T>(data));
    },
    async update(id: string, patch: Partial<NewEntity<T>>): Promise<T> {
      const current = await repo().get(id);
      if (!current) throw new NotFoundError(options.label, id);
      const merged = { ...strip(current), ...patch } as NewEntity<T>;
      const data = options.normalize ? await options.normalize(merged, current) : merged;
      return repo().put({ ...data, id: current.id, createdAt: current.createdAt, updatedAt: nowISO() } as unknown as T);
    },
    async remove(id: string): Promise<void> {
      if (!(await repo().get(id))) throw new NotFoundError(options.label, id);
      await repo().delete(id);
    },
  };
}
