import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import sendOtpHandler from './api/send-otp.js';
import verifyOtpHandler from './api/verify-otp.js';
import googleAuthHandler from './api/google-auth.js';
import healthHandler from './api/health.js';
import storeHandler from './api/store';
import ogProductHandler from './api/og-product.js';
import metaFeedHandler from './api/meta-feed.js';
import sitemapHandler from './api/sitemap.js';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (!url.startsWith('/api/')) return next();

        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', async () => {
          let body = {};
          if (raw) { try { body = JSON.parse(raw); } catch { body = {}; } }
          (req as any).body = body;
          const reqUrlObj = new URL(req.url || '/', 'http://localhost');
          (req as any).query = Object.fromEntries(reqUrlObj.searchParams.entries());
          const mockRes = {
            statusCode: 200,
            setHeader: (k: string, v: string) => res.setHeader(k, v),
            status(code: number) { this.statusCode = code; return this; },
            json(data: any) {
              res.statusCode = this.statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            send(data: any) {
              res.statusCode = this.statusCode;
              res.end(typeof data === 'string' ? data : JSON.stringify(data));
            },
            end: () => res.end()
          };
          try {
            if (url === '/api/send-otp') await sendOtpHandler(req, mockRes);
            else if (url === '/api/verify-otp') await verifyOtpHandler(req, mockRes);
            else if (url === '/api/google-auth') await googleAuthHandler(req, mockRes);
            else if (url === '/api/health') await healthHandler(req, mockRes);
            else if (url === '/api/store') await storeHandler(req, mockRes);
            else if (url === '/api/og-product') await ogProductHandler(req, mockRes);
            else if (url === '/api/meta-feed') await metaFeedHandler(req, mockRes);
            else if (url === '/api/sitemap') await sitemapHandler(req, mockRes);
            else next();
          } catch (err: any) {
            mockRes.status(500).json({ success: false, error: err.message });
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  server: { port: 5175, open: false, host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-excel': ['xlsx']
        }
      }
    },
    chunkSizeWarningLimit: 900
  }
});
