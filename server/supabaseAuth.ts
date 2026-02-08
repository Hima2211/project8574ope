import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Decode the JWT_SECRET from base64 (Supabase format)
// Return a Buffer for base64 secrets (better for binary secrets) or string otherwise
export function getJwtSecret(): Buffer | string {
  let envSecret = (process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production').trim();
  // Strip surrounding quotes if present
  envSecret = envSecret.replace(/^"|"$/g, '');

  // Detect base64-like strings (common for Supabase JWT secrets)
  const base64Like = /^[A-Za-z0-9+/]+={0,2}$/.test(envSecret) && envSecret.length >= 32;

  if (base64Like) {
    return Buffer.from(envSecret, 'base64');
  }

  return envSecret;
}

export default getJwtSecret;
