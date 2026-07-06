export type KosuEnv = {
  NODE_ENV?: string;
  KOSU_DATA_DIR?: string;
  KOSU_SESSION_SECRET?: string;
};

export function validateProductionConfig(env: KosuEnv = process.env): { ok: true } | { ok: false; missing: string[] } {
  if (env.NODE_ENV !== "production") {
    return { ok: true };
  }

  const missing: string[] = [];

  if (!env.KOSU_SESSION_SECRET || env.KOSU_SESSION_SECRET.trim().length < 32) {
    missing.push("KOSU_SESSION_SECRET（32文字以上）");
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

export function requireProductionConfig(env: KosuEnv = process.env) {
  const result = validateProductionConfig(env);

  if (!result.ok) {
    throw new Error(
      `本番環境の設定が不足しています: ${result.missing.join(", ")}`,
    );
  }
}
