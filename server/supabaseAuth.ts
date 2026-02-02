import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Decode the JWT_SECRET from base64 (Supabase format)
// Return a Buffer for base64 secrets (better for binary secrets) or string otherwise
function getJwtSecret(): Buffer | string {
  let envSecret = (process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production').trim();
  // Strip surrounding quotes if present
  envSecret = envSecret.replace(/^"|"$/g, '');

  // Detect base64-like strings (common for Supabase JWT secrets)
  const base64Like = /^[A-Za-z0-9+/]+={0,2}$/.test(envSecret) && envSecret.length >= 32;

  if (base64Like) {
    try {
      const buf = Buffer.from(envSecret, 'base64');
      // Re-encode and compare to avoid false-positives
      if (buf.toString('base64').replace(/=+$/, '') === envSecret.replace(/=+$/, '')) {
        console.log('✅ Using base64-decoded JWT_SECRET (Buffer)');
        return buf;
      }
    } catch (e) {
      // Fall through and use string
    }
  }

  console.log('✅ Using JWT_SECRET as string');
  return envSecret;
}

const JWT_SECRET = getJwtSecret();

/**
 * Create or get a user by wallet address
 * Called after Privy authenticates the wallet
 * 
 * This function generates a deterministic user ID from the wallet address
 * without needing to connect to Supabase API (avoiding DNS/network issues)
 */
export async function getOrCreateSupabaseUser(walletAddress: string, email?: string) {
  try {
    console.log(`🔑 Creating JWT user for wallet: ${walletAddress}`);
    
    if (!walletAddress) {
      console.error('❌ No wallet address provided');
      return null;
    }

    // Generate a deterministic user ID from wallet address
    // This ensures the same wallet always gets the same user ID
    const userId = crypto
      .createHash('sha256')
      .update(walletAddress.toLowerCase())
      .digest('hex')
      .slice(0, 32); // Use first 32 chars as user ID
    
    const userEmail = email || `${walletAddress.toLowerCase()}@wallet.local`;
    
    console.log(`✅ User ready: ${userId}`);

    return {
      id: userId,
      email: userEmail,
      wallet: walletAddress.toLowerCase(),
    };
  } catch (error: any) {
    console.error('❌ Error in getOrCreateSupabaseUser:', error.message);
    return null;
  }
}

/**
 * Generate a Supabase-compatible JWT token
 * Uses local signing - no external API calls needed
 */
export function generateSupabaseToken(userId: string, walletAddress: string) {
  try {
    console.log(`🔐 Generating JWT for user: ${userId}`);
    
    // Use JWT secret to create token
    const token = jwt.sign(
      {
        aud: 'authenticated',
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        email: `${walletAddress.toLowerCase()}@wallet.local`,
        user_metadata: {
          wallet_address: walletAddress.toLowerCase(),
        },
      },
      JWT_SECRET,
      {
        algorithm: 'HS256',
      }
    );

    console.log(`✅ JWT token generated (${token.length} chars)`);
    return token;
  } catch (error: any) {
    console.error('❌ Error generating JWT:', error.message);
    return null;
  }
}

/**
 * Verify a Supabase JWT token
 */
export function verifySupabaseToken(token: string) {
  try {
    console.log('🔍 Verifying JWT token...');
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    console.log(`✅ JWT verified for user: ${decoded.sub}`);
    return decoded as any;
  } catch (error: any) {
    console.error('❌ JWT verification failed:', error.message);
    return null;
  }
}

/**
 * Middleware to verify Supabase JWT
 */
export function SupabaseAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const url = req.originalUrl || req.url;
  
  console.log(`\n🔐 SupabaseAuthMiddleware for ${req.method} ${url}`);
  console.log(`   Authorization header: ${authHeader ? 'Present' : 'MISSING'}`);

  // Check for Passport session auth (for backward compatibility)
  if (!authHeader && req.isAuthenticated && req.isAuthenticated()) {
    console.log('✅ Using session-based auth');
    return next();
  }

  if (!authHeader) {
    console.error('❌ No Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  console.log(`🔑 Token received (${token.length} chars)`);
  console.log(`   Token preview: ${token.substring(0, 50)}...`);
  if (Buffer.isBuffer(JWT_SECRET)) {
    console.log(`   JWT_SECRET used (buffer base64 preview): ${JWT_SECRET.toString('base64').substring(0, 20)}... (buffer length: ${JWT_SECRET.length})`);
  } else {
    console.log(`   JWT_SECRET used: ${JWT_SECRET.substring(0, 20)}... (length: ${JWT_SECRET.length})`);
  }

  try {
    // First, decode without verifying to see what we're dealing with
    const unverified = jwt.decode(token) as any;
    console.log(`   Token payload - sub: ${unverified?.sub}, aud: ${unverified?.aud}`);

    // Detect Privy DID tokens early to avoid cryptic "invalid signature" errors
    if (typeof unverified?.sub === 'string' && unverified.sub.startsWith('did:privy:')) {
      console.error('❌ Received Privy DID token where Supabase JWT expected');
      return res.status(401).json({ error: 'Invalid token', details: 'expected Supabase JWT, received Privy DID token' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as any;

    if (!decoded || !decoded.sub) {
      console.error('❌ Invalid token or no user ID');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach user to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      wallet: decoded.user_metadata?.wallet_address,
    };

    console.log(`✅ User authenticated: ${req.user.id}`);
    next();
  } catch (error: any) {
    console.error('❌ Auth error:', error.message);
    console.error(`   Error type: ${error.name}`);
    return res.status(401).json({ error: 'Invalid token', details: error.message });
  }
}
