import { OAuth2Client } from 'google-auth-library';

export const DEFAULT_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';

export async function verifyGoogleCredential(credential, audience = DEFAULT_GOOGLE_CLIENT_ID) {
  if (!credential || typeof credential !== 'string') throw new Error('Missing credential');
  if (!audience) throw new Error('Google client ID not configured');
  const client = new OAuth2Client(audience);
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.email_verified) throw new Error('Unverified Google account');
  return {
    name: payload.name || payload.email.split('@')[0],
    email: payload.email,
    avatar: payload.picture || '',
    googleId: payload.sub
  };
}
