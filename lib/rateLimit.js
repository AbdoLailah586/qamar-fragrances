import { checkBotId } from 'botid/server';

const l1Buckets = new Map();
let tableReadyPromise = null;

export function extractClientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  const raw =
    (typeof fwd === 'string' && fwd.split(',')[0]) ||
    req?.headers?.['x-real-ip'] ||
    req?.socket?.remoteAddress ||
    'unknown';
  return String(raw || 'unknown').trim().slice(0, 64) || 'unknown';
}

export function resetRateLimiterMemoryForTest() {
  l1Buckets.clear();
  tableReadyPromise = null;
}

async function ensureRateLimitTable(sql) {
  if (!sql || typeof sql.query !== 'function') return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql
      .query(`
        CREATE TABLE IF NOT EXISTS api_rate_limits (
          bucket_key TEXT PRIMARY KEY,
          hits INTEGER NOT NULL DEFAULT 1,
          reset_at TIMESTAMPTZ NOT NULL,
          blocked_until TIMESTAMPTZ,
          last_ip TEXT,
          last_path TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      .catch(() => {
        tableReadyPromise = null;
      });
  }
  await tableReadyPromise;
}

function checkL1Rate(bucketKey, maxHits, windowSeconds, blockSeconds) {
  const now = Date.now();
  if (l1Buckets.size > 10000) {
    for (const [k, v] of l1Buckets.entries()) {
      if (v.resetAt <= now && (!v.blockedUntil || v.blockedUntil <= now)) l1Buckets.delete(k);
    }
  }
  const existing = l1Buckets.get(bucketKey);
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      hits: existing.hits,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000))
    };
  }
  if (!existing || existing.resetAt <= now) {
    l1Buckets.set(bucketKey, { hits: 1, resetAt: now + windowSeconds * 1000, blockedUntil: 0 });
    return { allowed: true, remaining: Math.max(0, maxHits - 1), hits: 1, retryAfterSeconds: 0 };
  }
  existing.hits += 1;
  if (existing.hits > maxHits) {
    existing.blockedUntil = now + (blockSeconds || windowSeconds) * 1000;
    return {
      allowed: false,
      remaining: 0,
      hits: existing.hits,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000))
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, maxHits - existing.hits),
    hits: existing.hits,
    retryAfterSeconds: 0
  };
}

/**
 * Two-tier L1 Memory + L2 Neon Postgres distributed rate limiter.
 * Fails fast in L1 when a single instance absorbs a burst/k6 attack, and syncs
 * across all serverless containers in Neon for distributed sign-in / scraping floods.
 */
export async function checkDistributedRateLimit(
  sql,
  { bucket, scopeKey, maxHits, windowSeconds, blockSeconds = windowSeconds, ip = '', path = '' }
) {
  const key = `${bucket}:${String(scopeKey || ip || 'anon').slice(0, 140)}`;
  const l1 = checkL1Rate(key, maxHits, windowSeconds, blockSeconds);
  if (!l1.allowed) {
    return l1;
  }

  // Only persist/coordinate in Postgres when a real Neon client is available and caller isn't pure mock no-op
  if (!sql || typeof sql.query !== 'function' || !process.env.DATABASE_URL) {
    return l1;
  }

  try {
    await ensureRateLimitTable(sql);
    const rows = await sql.query(
      `
        INSERT INTO api_rate_limits (bucket_key, hits, reset_at, blocked_until, last_ip, last_path, updated_at)
        VALUES (
          $1,
          1,
          NOW() + ($2::text || ' seconds')::interval,
          NULL,
          $3,
          $4,
          NOW()
        )
        ON CONFLICT (bucket_key) DO UPDATE SET
          hits = CASE
            WHEN api_rate_limits.blocked_until IS NOT NULL AND api_rate_limits.blocked_until > NOW()
              THEN api_rate_limits.hits + 1
            WHEN api_rate_limits.reset_at <= NOW()
              THEN 1
            ELSE api_rate_limits.hits + 1
          END,
          reset_at = CASE
            WHEN api_rate_limits.reset_at <= NOW()
              THEN NOW() + ($2::text || ' seconds')::interval
            ELSE api_rate_limits.reset_at
          END,
          blocked_until = CASE
            WHEN api_rate_limits.blocked_until IS NOT NULL AND api_rate_limits.blocked_until > NOW()
              THEN api_rate_limits.blocked_until
            WHEN api_rate_limits.reset_at > NOW() AND (api_rate_limits.hits + 1) > $5
              THEN NOW() + ($6::text || ' seconds')::interval
            ELSE NULL
          END,
          last_ip = COALESCE(NULLIF($3, ''), api_rate_limits.last_ip),
          last_path = COALESCE(NULLIF($4, ''), api_rate_limits.last_path),
          updated_at = NOW()
        RETURNING
          hits,
          (blocked_until IS NOT NULL AND blocked_until > NOW()) AS is_blocked,
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (COALESCE(blocked_until, reset_at) - NOW())))::int) AS retry_after;
      `,
      [key, String(windowSeconds), String(ip || ''), String(path || ''), Number(maxHits), String(blockSeconds)]
    );

    const row = rows?.[0];
    if (row) {
      const blocked = Boolean(row.is_blocked) || Number(row.hits) > maxHits;
      if (blocked) {
        const retrySec = Math.max(1, Number(row.retry_after) || blockSeconds);
        l1Buckets.set(key, {
          hits: Number(row.hits),
          resetAt: Date.now() + retrySec * 1000,
          blockedUntil: Date.now() + retrySec * 1000
        });
        return {
          allowed: false,
          remaining: 0,
          hits: Number(row.hits),
          retryAfterSeconds: retrySec
        };
      }
      return {
        allowed: true,
        remaining: Math.max(0, maxHits - Number(row.hits)),
        hits: Number(row.hits),
        retryAfterSeconds: 0
      };
    }
  } catch {
    // Fallback cleanly to L1 memory protection if rate-limit table write transiently errors
  }

  return l1;
}

export async function enforceRateLimitOr429(req, res, sql, opts) {
  const ip = extractClientIp(req);
  const result = await checkDistributedRateLimit(sql, { ...opts, ip });
  if (!result.allowed) {
    if (res?.setHeader) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      res.setHeader('X-RateLimit-Remaining', '0');
    }
    return {
      limited: true,
      retryAfterSeconds: result.retryAfterSeconds,
      error: opts.message || 'تم تجاوز عدد الطلبات المسموح به. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.'
    };
  }
  return { limited: false, remaining: result.remaining };
}

export async function verifyBotIdIfActive(req, checkLevel = 'basic', deps) {
  if (deps && typeof deps.checkBotId === 'function') {
    const verdict = await deps.checkBotId({ advancedOptions: { headers: req?.headers, checkLevel } });
    if (verdict?.isBot && !verdict?.isVerifiedBot && !verdict?.bypassed) {
      return { blocked: true, reason: 'botid' };
    }
    return { blocked: false };
  }

  const hasVercelContext = Boolean(
    process.env.VERCEL && (req?.headers?.['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN)
  );
  if (!hasVercelContext) return { blocked: false };

  try {
    const verdict = await checkBotId({
      advancedOptions: {
        headers: req?.headers,
        checkLevel
      }
    });
    if (verdict?.isBot && !verdict?.isVerifiedBot && !verdict?.bypassed) {
      return { blocked: true, reason: 'botid' };
    }
  } catch {
    // Do not break requests if BotID OIDC token isn't enabled on the Vercel project yet
  }
  return { blocked: false };
}

export async function getRateLimitSecurityReport(sql) {
  const l1Active = Array.from(l1Buckets.entries())
    .filter(([, v]) => v.blockedUntil > Date.now() || v.hits >= 15)
    .slice(0, 25)
    .map(([bucket_key, v]) => ({
      bucket_key,
      hits: v.hits,
      is_blocked: v.blockedUntil > Date.now()
    }));

  if (!sql || typeof sql.query !== 'function' || !process.env.DATABASE_URL) {
    return { activeBlocks: l1Active.filter(x => x.is_blocked), recentHighTraffic: l1Active };
  }
  try {
    await ensureRateLimitTable(sql);
    const rows = await sql.query(`
      SELECT
        bucket_key,
        hits,
        last_ip,
        last_path,
        reset_at,
        blocked_until,
        (blocked_until IS NOT NULL AND blocked_until > NOW()) AS is_blocked
      FROM api_rate_limits
      WHERE (blocked_until IS NOT NULL AND blocked_until > NOW())
         OR updated_at > NOW() - INTERVAL '2 hours'
      ORDER BY is_blocked DESC, hits DESC, updated_at DESC
      LIMIT 40;
    `);
    const list = rows || [];
    return {
      activeBlocks: list.filter(r => r.is_blocked),
      recentHighTraffic: list
    };
  } catch {
    return { activeBlocks: l1Active.filter(x => x.is_blocked), recentHighTraffic: l1Active };
  }
}
