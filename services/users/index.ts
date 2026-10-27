import { nowISO } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import type { User } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { compact, requireText } from "../shared/validation";

/** Perfil local único: salvar de novo atualiza em vez de duplicar. */
export function createUsersService(storage: Storage) {
  const repo = () => storage.repo("users");
  const getCurrent = async (): Promise<User | undefined> => (await repo().list())[0];
  return {
    getCurrent,
    async save(input: { name: string; nickname?: string; email?: string; avatar?: string }): Promise<User> {
      const name = requireText(input.name, "name", "seu nome", 60);
      const email = input.email?.trim() || undefined;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("E-mail inválido.", "email");
      const current = await getCurrent();
      // Sem `nickname` na chamada (ex.: salvar só o perfil em Configurações), mantém o apelido que já existe.
      const nickname = input.nickname === undefined ? current?.nickname : input.nickname.trim() ? requireText(input.nickname, "nickname", "o apelido", 30) : undefined;
      const now = nowISO();
      return repo().put(compact({ id: current?.id ?? newId(), createdAt: current?.createdAt ?? now, updatedAt: now, name, nickname, email, avatar: input.avatar }) as User);
    },
  };
}
