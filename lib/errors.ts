/** Erros de domínio: a UI decide a mensagem pelo tipo, sem depender de texto. */
export class ValidationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class NotFoundError extends Error {
  constructor(label: string, id: string) {
    super(`${label} não encontrado(a): ${id}`);
    this.name = "NotFoundError";
  }
}

/** O item não pode ser excluído porque outros registros dependem dele. */
export class InUseError extends Error {
  readonly count: number;
  constructor(message: string, count = 1) {
    super(message);
    this.name = "InUseError";
    this.count = count;
  }
}
