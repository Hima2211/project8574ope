import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    console.log(`🔐 Admin login attempt for username: ${username}`);

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Get user by username
    const user = await storage.getUserByUsername(username);

    console.log(`🔍 User lookup result:`, user ? `Found user ${user.id}` : 'User not found');

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Access denied: Not an administrator' });
    }

    // Simple password check (in production, this should use bcrypt or similar)
    // For now, checking against a seeded admin password
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (password !== adminPassword) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token for admin (with longer expiry than regular users - 7 days)
    const token = jwt.sign(
      {
        aud: 'admin',
        sub: user.id,
        isAdmin: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        email: user.email,
        username: user.username,
      },
      JWT_SECRET,
      {
        algorithm: 'HS256',
      }
    );

    console.log(`✅ Admin login successful for: ${username}`);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        isAdmin: user.isAdmin || false,
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Login failed: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
});

/**
 * GET /api/admin/verify
 * Verify admin token and return admin user info
 */
router.get('/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log(`🔐 Admin verify request`);
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

      if (decoded.aud !== 'admin') {
        console.error('❌ Token is not an admin token');
        return res.status(403).json({ error: 'Not an admin token' });
      }

      console.log(`✅ Admin token verified for: ${decoded.username}`);
      
      return res.json({
        id: decoded.sub,
        username: decoded.username,
        email: decoded.email,
        isAdmin: decoded.isAdmin,
      });
    } catch (tokenError: any) {
      console.error('❌ Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Admin verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
