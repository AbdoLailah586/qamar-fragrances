import { neon } from '@neondatabase/serverless';
import { currentUser } from '../lib/session.js';
import { isFullAdmin } from '../lib/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ status: 'error', error: 'Method Not Allowed' });
  const DB_URL = process.env.DATABASE_URL || '';
  if (!DB_URL) return res.status(500).json({ status: 'error', database: 'Missing DATABASE_URL' });
  try {
    const sql = neon(DB_URL);
    await sql`SELECT 1;`;
    const user = await currentUser(req, sql).catch(() => null);
    if (!user || !isFullAdmin(user)) {
      return res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    }
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM products`;
    return res.status(200).json({ status: 'ok', database: 'connected', products_count: count, timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
