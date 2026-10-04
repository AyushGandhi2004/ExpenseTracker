/** An error whose message is safe and useful to show the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/** Postgres SQLSTATE of a (possibly Drizzle-wrapped) error. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

/** Maps known database errors to friendly messages; rethrows anything else. */
export function toUserError(error: unknown, messages: { duplicate?: string; inUse?: string }): never {
  if (error instanceof UserError) throw error;
  const code = pgErrorCode(error);
  if (code === PG_UNIQUE_VIOLATION && messages.duplicate) throw new UserError(messages.duplicate);
  if (code === PG_FOREIGN_KEY_VIOLATION && messages.inUse) throw new UserError(messages.inUse);
  throw error;
}
