const encoder = new TextEncoder();

export const SHIELD_COOKIE_NAME = '__qamar_shield';
export const SHIELD_TTL_MS = 6 * 60 * 60 * 1000;
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;
export const DEFAULT_POW_BITS = 10; // ~1,024 SHA-256 hashes (~2ms in browser, impossible in pure HTTP k6)

const SCRAPER_OR_LOAD_UA_RE =
  /(?:(?:^|[^a-z])(k6|xk6|locust|gatling|jmeter|vegeta|artillery|wrk|siege|autocannon|bombardier|apachebench|python-requests|python-urllib|pycurl|aiohttp|httpx|scrapy|mechanize|beautifulsoup|go-http-client|fasthttp|httrack|webcopier|offline explorer|teleport|postmanruntime|insomnia|headlesschrome|phantomjs|casperjs|nightmare|playwright|puppeteer|selenium|webdriver|node-fetch|undici|libwww-perl|lwp-trivial)(?:$|[^a-z0-9])|(?:^|[\s(])(curl|wget|httpie|hey|reqwest|axios|ab)\/)/i;

const VERIFIED_CRAWLER_UA_RE =
  /(googlebot|adsbot-google|google-inspectiontool|bingbot|applebot|facebookexternalhit|facebot|instagram|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|meta-externalfetcher)/i;

const edgeBuckets = new Map();

export function checkEdgeMemoryRate(key, maxRequests, windowMs) {
  const now = Date.now();
  if (edgeBuckets.size > 5000) {
    for (const [k, v] of edgeBuckets.entries()) {
      if (v.resetAt <= now) edgeBuckets.delete(k);
    }
  }
  const existing = edgeBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    edgeBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, maxRequests - 1), retryAfterSec: 0 };
  }
  existing.count += 1;
  if (existing.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    retryAfterSec: 0
  };
}

export function resetEdgeMemoryRatesForTest() {
  edgeBuckets.clear();
}

export function isBotOrLoadToolUa(ua = '') {
  const s = String(ua || '').trim();
  if (!s) return true;
  if (VERIFIED_CRAWLER_UA_RE.test(s)) return false;
  return SCRAPER_OR_LOAD_UA_RE.test(s);
}

export function isVerifiedGoodCrawlerUa(ua = '') {
  return VERIFIED_CRAWLER_UA_RE.test(String(ua || ''));
}

export function uaFamilyTag(ua = '') {
  const s = String(ua || '').toLowerCase();
  if (s.includes('edg/')) return 'edge';
  if (s.includes('firefox/')) return 'ff';
  if (s.includes('chrome/') || s.includes('crios/')) return 'chr';
  if (s.includes('safari/')) return 'saf';
  return 'br';
}

export function extractCookie(cookieHeader = '', name = SHIELD_COOKIE_NAME) {
  if (!cookieHeader) return '';
  for (const part of String(cookieHeader).split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return '';
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeHexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSignHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret || 'qamar-edge-shield-fallback')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(sig);
}

export function hasLeadingZeroBits(bytes, difficultyBits = DEFAULT_POW_BITS) {
  const fullBytes = Math.floor(difficultyBits / 8);
  const remBits = difficultyBits % 8;
  for (let i = 0; i < fullBytes; i += 1) {
    if (bytes[i] !== 0) return false;
  }
  if (remBits > 0) {
    const mask = (0xff << (8 - remBits)) & 0xff;
    if ((bytes[fullBytes] & mask) !== 0) return false;
  }
  return true;
}

export async function createChallengePayload(secret, ua = '') {
  const randBytes = new Uint8Array(12);
  crypto.getRandomValues(randBytes);
  const seed = toHex(randBytes);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const tag = uaFamilyTag(ua);
  const sig = await hmacSignHex(secret, `chl:${seed}:${expiresAt}:${tag}`);
  return { seed, expiresAt, difficulty: DEFAULT_POW_BITS, sig };
}

export async function verifyPowSolution({
  seed,
  expiresAt,
  sig,
  nonce,
  ua = '',
  secret,
  difficulty = DEFAULT_POW_BITS
}) {
  const exp = Number(expiresAt);
  if (!seed || !sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const nonceStr = String(nonce ?? '').trim();
  if (!/^\d{1,12}$/.test(nonceStr)) return false;

  const expectedSig = await hmacSignHex(secret, `chl:${seed}:${exp}:${uaFamilyTag(ua)}`);
  if (!timingSafeHexEqual(expectedSig, String(sig))) return false;

  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${seed}:${nonceStr}`));
  return hasLeadingZeroBits(new Uint8Array(digest), difficulty);
}

export async function mintShieldCookieValue(secret, ua = '') {
  const issuedAt = Date.now();
  const rnd = new Uint8Array(8);
  crypto.getRandomValues(rnd);
  const id = toHex(rnd);
  const tag = uaFamilyTag(ua);
  const sig = await hmacSignHex(secret, `shd:${issuedAt}:${id}:${tag}`);
  return `${issuedAt}.${id}.${tag}.${sig}`;
}

export async function verifyShieldCookieValue(cookieVal, secret, ua = '') {
  const parts = String(cookieVal || '').split('.');
  if (parts.length !== 4) return false;
  const [issuedRaw, id, tag, sig] = parts;
  const issuedAt = Number(issuedRaw);
  if (!Number.isFinite(issuedAt) || !/^[a-f0-9]{16}$/.test(id) || !/^[a-f0-9]{64}$/.test(sig)) {
    return false;
  }
  if (Date.now() - issuedAt > SHIELD_TTL_MS || issuedAt > Date.now() + 60_000) return false;
  if (tag !== uaFamilyTag(ua)) return false;
  const expectedSig = await hmacSignHex(secret, `shd:${issuedAt}:${id}:${tag}`);
  return timingSafeHexEqual(expectedSig, sig);
}

export function buildShieldInterstitialHtml(challenge) {
  const jsonPayload = JSON.stringify(challenge).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>جاري تأمين اتصالك | قمر للعطور</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fcfcfd;font-family:system-ui,-apple-system,sans-serif;color:#252a31;text-align:center;padding:24px;}
    .box{max-width:400px;width:100%;background:#fff;border:1px solid #f1e4d4;border-radius:24px;padding:28px 24px;box-shadow:0 20px 50px rgba(37,42,49,0.08);}
    .spin{width:38px;height:38px;margin:0 auto 14px;border:3px solid #fde3c4;border-top-color:#fe9931;border-radius:50%;animation:r .8s linear infinite;}
    @keyframes r{to{transform:rotate(360deg)}}
    h1{font-size:17px;margin:0 0 8px;font-weight:800;}
    p{font-size:13px;color:#585757;margin:0;line-height:1.7;}
  </style>
</head>
<body>
  <div class="box">
    <div class="spin"></div>
    <h1>جاري فحص وتأمين اتصالك بمتجر قمر للعطور</h1>
    <p id="msg">لحظة واحدة للتأكد من أنك زائر حقيقي وحماية المتجر من الهجمات الآلية...</p>
  </div>
  <script>
  (async function(){
    var ch=${jsonPayload};
    var msg=document.getElementById('msg');
    if(navigator.webdriver){if(msg)msg.textContent='تعذر التحقق التلقائي من المتصفح.';return;}
    try{
      var enc=new TextEncoder();
      var n=0;
      var full=Math.floor(ch.difficulty/8),rem=ch.difficulty%8,mask=(0xff<<(8-rem))&0xff;
      while(n<200000){
        var buf=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(ch.seed+':'+n)));
        var ok=true;
        for(var i=0;i<full;i++){if(buf[i]!==0){ok=false;break;}}
        if(ok&&rem>0&&((buf[full]&mask)!==0))ok=false;
        if(ok)break;
        n++;
      }
      var res=await fetch('/__qamar_shield',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:ch.seed,expiresAt:ch.expiresAt,sig:ch.sig,nonce:String(n)})});
      if(res.ok){window.location.replace(window.location.href);return;}
    }catch(e){}
    if(msg)msg.textContent='يرجى تحديث الصفحة للمتابعة.';
  })();
  </script>
</body>
</html>`;
}
