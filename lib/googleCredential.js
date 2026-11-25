import { OAuth2Client } from 'google-auth-library';

export const DEFAULT_GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  '294509556603-op9cbf1s15b9nk1hgpnb8sfugfvqeer8.apps.googleusercontent.com';

const verifier = new OAuth2Client();

export async function verifyGoogleCredential(credential, audience = DEFAULT_GOOGLE_CLIENT_ID, client = verifier) {
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 12000) {
    throw new Error('Invalid Google credential');
  }
  if (!audience) throw new Error('Google client ID not configured');
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('Unverified Google account');
  }
  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name || payload.email.split('@')[0] || 'عميل قمر للعطور',
    avatar: payload.picture || ''
  };
}
