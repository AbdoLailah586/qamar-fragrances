import { ipAddress, next } from '@vercel/functions';
import {
  SHIELD_COOKIE_NAME,
  buildShieldInterstitialHtml,
  checkEdgeMemoryRate,
  createChallengePayload,
  extractCookie,
  isBotOrLoadToolUa,
  isVerifiedGoodCrawlerUa,
  mintShieldCookieValue,
  verifyPowSolution,
  verifyShieldCookieValue
} from './lib/edgeShield.js';

export const config = {
  matcher: ['/((?!assets/|149e9513-|favicon\\.|sw\\.js$|manifest\\.webmanifest$|offline\\.html$).*)']
};

function getShieldSecret() {
  return process.env.SHIELD_SECRET || process.env.SESSION_SECRET || 'qamar-edge-shield-2026-hmac-salt';
}

function getClientIp(request) {
  return (
    ipAddress(request) ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function jsonBlock(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function tooManyResponse(isApi, retryAfterSec) {
  if (isApi) {
    return jsonBlock(
      429,
      { error: 'تم تجاوز حد الطلبات المسموح به. انتظر لحظات ثم أعد المحاولة.', code: 'RATE_LIMITED' },
      { 'Retry-After': String(retryAfterSec) }
    );
  }
  return new Response('Too Many Requests — يرجى الانتظار قليلاً قبل إعادة تحميل الصفحة.', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': String(retryAfterSec)
    }
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const ua = request.headers.get('user-agent') || '';
  const ip = getClientIp(request);
  const secret = getShieldSecret();

  // 1. Payment gateway webhooks & health checks rely on cryptographic HMAC verification inside their handlers
  if (path === '/api/payment-callback' || path === '/api/health') {
    return next();
  }

  // 2. Meta feed / sitemap / robots (meta-feed enforces secret token; rate-limited cleanly at Edge)
  if (path === '/sitemap.xml' || path === '/robots.txt' || path === '/meta-feed.csv' || path === '/meta-feed.xml' || path.startsWith('/api/meta-feed') || path === '/api/sitemap') {
    const rate = checkEdgeMemoryRate(`feed:${ip}`, 30, 60_000);
    if (!rate.allowed) return tooManyResponse(true, rate.retryAfterSec);
    return next();
  }

  const isApi = path.startsWith('/api/');
  const isImage = path.startsWith('/qamar-images/') || path.startsWith('/pwa/');
  const cookieHeader = request.headers.get('cookie') || '';
  const shieldCookie = extractCookie(cookieHeader, SHIELD_COOKIE_NAME);

  // 3. Proof-of-Work verification endpoint handled purely at the Edge (never hits serverless/DB)
  if (path === '/__qamar_shield') {
    if (method !== 'POST') return jsonBlock(405, { error: 'Method Not Allowed' });
    const rate = checkEdgeMemoryRate(`pow:${ip}`, 15, 60_000);
    if (!rate.allowed) return tooManyResponse(true, rate.retryAfterSec);
    if (isBotOrLoadToolUa(ua)) {
      return jsonBlock(403, { error: 'Blocked automated client', code: 'BOT_BLOCKED' });
    }
    let body: Record<string, any> = {};
    try {
      body = (await request.json()) || {};
    } catch {
      return jsonBlock(400, { error: 'Invalid challenge payload' });
    }
    const ok = await verifyPowSolution({
      seed: body?.seed,
      expiresAt: body?.expiresAt,
      sig: body?.sig,
      nonce: body?.nonce,
      ua,
      secret
    });
    if (!ok) {
      return jsonBlock(403, { error: 'Security verification failed', code: 'POW_INVALID' });
    }
    const token = await mintShieldCookieValue(secret, ua);
    const secureFlag = url.protocol === 'https:' ? '; Secure' : '';
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${SHIELD_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=21600${secureFlag}`
      }
    });
  }

  // 4. Hard-block load testers (k6, Locust, JMeter, Artillery, etc.) and scrapers BEFORE cache & DB
  if (isBotOrLoadToolUa(ua)) {
    if (isApi) {
      return jsonBlock(403, { error: 'الوصول عبر الأدوات الآلية محظور.', code: 'AUTOMATED_TOOL_BLOCKED' });
    }
    return new Response('Access denied: automated scraping and load-testing tools are blocked.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // 5. Verified search & social preview crawlers (Googlebot, Meta OG, WhatsApp) allowed on public HTML/images ONLY
  const goodCrawler = isVerifiedGoodCrawlerUa(ua);
  if (goodCrawler) {
    if (isApi && !path.startsWith('/api/og-product')) {
      return jsonBlock(403, { error: 'Restricted API endpoint' });
    }
    if (!['GET', 'HEAD'].includes(method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const botRate = checkEdgeMemoryRate(`goodbot:${ip}`, 120, 60_000);
    if (!botRate.allowed) return tooManyResponse(false, botRate.retryAfterSec);
    return next();
  }

  // 6. Edge burst rate limits per route class
  if (path === '/api/send-otp' || path === '/api/verify-otp' || path === '/api/google-auth') {
    const authRate = checkEdgeMemoryRate(`edgeauth:${ip}`, 15, 60_000);
    if (!authRate.allowed) return tooManyResponse(true, authRate.retryAfterSec);
  } else if (path.startsWith('/api/store')) {
    const isPost = method === 'POST';
    const apiRate = checkEdgeMemoryRate(`edgeapi:${isPost ? 'w' : 'r'}:${ip}`, isPost ? 45 : 90, 60_000);
    if (!apiRate.allowed) return tooManyResponse(true, apiRate.retryAfterSec);
  } else if (isImage) {
    const imgRate = checkEdgeMemoryRate(`edgeimg:${ip}`, 220, 60_000);
    if (!imgRate.allowed) return tooManyResponse(false, imgRate.retryAfterSec);
    return next();
  } else {
    const pageRate = checkEdgeMemoryRate(`edgepage:${ip}`, 90, 60_000);
    if (!pageRate.allowed) return tooManyResponse(false, pageRate.retryAfterSec);
  }

  // 7. Verify HMAC-signed Edge Browser Shield Cookie (stops k6 even if User-Agent is spoofed!)
  const hasShield = await verifyShieldCookieValue(shieldCookie, secret, ua);

  if (isApi) {
    if (!hasShield) {
      return jsonBlock(403, {
        error: 'يرجى تحديث الصفحة للتحقق الأمني من المتصفح قبل استدعاء API المتجر.',
        code: 'SHIELD_CHALLENGE_REQUIRED'
      });
    }
    return next();
  }

  // 8. Browser Proof-of-Work Interstitial for first-visit unverified storefront HTML requests
  if (['GET', 'HEAD'].includes(method) && !hasShield && !isImage) {
    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/html') || accept === '*/*' || !accept) {
      const challenge = await createChallengePayload(secret, ua);
      return new Response(buildShieldInterstitialHtml(challenge), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Robots-Tag': 'noindex'
        }
      });
    }
  }

  return next();
}
