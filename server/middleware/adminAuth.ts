import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

/**
 * Middleware to verify admin JWT token
 */
export function AdminAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const url = req.originalUrl || req.url;
  
  console.log(`\n🔐 AdminAuthMiddleware for ${req.method} ${url}`);
  console.log(`   Authorization header: ${authHeader ? 'Present' : 'MISSING'}`);

  if (!authHeader) {
    console.error('❌ No Authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  console.log(`🔑 Token received (${token.length} chars)`);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as any;

    if (decoded.aud !== 'admin' || !decoded.isAdmin) {
      console.error('❌ Token is not an admin token');
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Attach user to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
      isAdmin: true,
    };

    console.log(`✅ Admin authenticated: ${req.user.id}`);
    next();
  } catch (error: any) {
    console.error('❌ Admin auth error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
