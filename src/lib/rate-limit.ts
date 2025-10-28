import LRU from "lru-cache";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const maxApi = Number(process.env.RATE_LIMIT_MAX_API ?? 60);
const maxLogin = Number(process.env.RATE_LIMIT_MAX_LOGIN ?? 10);

type LimitKey = `${"login" | "api"}:${string}`;

const cache = new LRU<LimitKey, { hits: number; expiresAt: number }>({
  max: 5000,
});

function isBlocked(key: LimitKey, limit: number) {
  const entry = cache.get(key);
  const now = Date.now();
  if (!entry || entry.expiresAt < now) {
    cache.set(key, { hits: 1, expiresAt: now + windowMs });
    return false;
  }
  entry.hits += 1;
  cache.set(key, entry);
  return entry.hits > limit;
}

export function rateLimitLogin(identifier: string) {
  return !isBlocked(`login:${identifier}` as LimitKey, maxLogin);
}

export function rateLimitApi(identifier: string) {
  return !isBlocked(`api:${identifier}` as LimitKey, maxApi);
}
