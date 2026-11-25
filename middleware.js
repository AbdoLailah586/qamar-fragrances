export const config = {
  matcher: ['/ar/product/:path*', '/product/:path*']
};

export default function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|applebot|bingbot|google-structured-data-testing-tool/i.test(userAgent);
  if (isCrawler) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const allIdx = parts.indexOf('all');
    if (allIdx !== -1 && parts[allIdx + 1]) {
      url.pathname = '/api/og-product';
      url.searchParams.set('id', decodeURIComponent(parts[allIdx + 1]));
      return Response.redirect(url, 307);
    }
  }
}
