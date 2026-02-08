import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, registerSchema, loginSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { nanoid } from "nanoid";
import { notifyReferralBonus } from "./utils/bantahPointsNotifications";

declare global {
  namespace Express {
    interface User extends SelectUser {
      wallet?: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'emailOrUsername' }, async (emailOrUsername, password, done) => {
      try {
        // Try to find user by email first, then by username
        let user = await storage.getUserByEmail(emailOrUsername);
        if (!user) {
          user = await storage.getUserByUsername(emailOrUsername);
        }
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: 'Invalid username/email or password' });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Check if username is taken (if provided)
      if (validatedData.username) {
        const existingUsername = await storage.getUserByUsername(validatedData.username);
        if (existingUsername) {
          return res.status(400).json({ message: "Username is already taken" });
        }
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(validatedData.password);
      const userId = nanoid();

      // Fetch referrer if referral code provided
      let referrerUser = null;
      if (validatedData.referralCode) {
        referrerUser = await storage.getUserByReferralCode(validatedData.referralCode);
      }

      // Calculate signup bonus: 20 points (or 30 if referred)
      const signupBonus = referrerUser ? 30 : 20;

      const user = await storage.upsertUser({
        id: userId,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        username: validatedData.username || `user_${userId.slice(0, 8)}`,
        level: 1,
        xp: 0,
        points: signupBonus, // ✅ 20 points base, 30 if referred
        balance: "0.00",
        streak: 0,
        status: "active",
        isAdmin: false,
        isTelegramUser: false,
        coins: 0,
        referralCode: validatedData.username || `user_${userId.slice(0, 8)}`,
        referredBy: referrerUser?.id || null,
      });

      // Create welcome notification with points info
      const welcomeMessage = referrerUser 
        ? `🎁 Welcome to Bantah! You received ${signupBonus} Bantah Points for signing up via referral. Start creating and joining challenges to earn more.`
        : `🎉 Welcome to Bantah! You received ${signupBonus} Bantah Points. Start creating and joining challenges to earn more.`;

      await storage.createNotification({
        userId: user.id,
        type: 'welcome_bonus',
        title: '🎉 Welcome to Bantah!',
        message: welcomeMessage,
        data: { type: 'welcome_message' },
      });

      // Process referral rewards if applicable
      if (referrerUser) {
        // Give referrer bonus - 30 Bantah Points (calculated via calculateReferralPoints)
        const referrerBonus = 30; // ✅ Standard referral bonus - capped at 500 hard limit

        await storage.updateUserPoints(referrerUser.id, referrerBonus);

        // Create referral record
        await storage.createReferral({
          referrerId: referrerUser.id,
          referredId: user.id,
          code: validatedData.referralCode,
          status: 'active',
        });

        // Notify referrer via push notification
        await notifyReferralBonus(
          referrerUser.id,
          user.firstName || 'New User',
          referrerBonus
        ).catch(err => console.error('Failed to send referral notification:', err));

        // Also create in-app notification (for backup)
        await storage.createNotification({
          userId: referrerUser.id,
          type: 'referral_success',
          title: '🎉 Referral Success!',
          message: `${user.firstName} joined using your referral code! You earned ${referrerBonus} Bantah Points.`,
          data: { points: referrerBonus, referredUser: user.firstName },
        });

        // Create transaction records for referrer
        await storage.createTransaction({
          userId: referrerUser.id,
          type: 'referral_reward',
          amount: referrerBonus.toFixed(2),
          description: `Referral bonus - ${referrerBonus} Bantah Points for ${user.firstName} joining`,
          status: 'completed',
        });
      }

      // Create initial daily login record for new user
      await storage.checkDailyLogin(user.id);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          level: user.level,
          xp: user.xp,
          points: user.points,
          balance: user.balance,
          streak: user.streak,
          status: user.status,
          isAdmin: user.isAdmin,
        });
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    try {
      const validatedData = loginSchema.parse(req.body);

      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) {
          return res.status(401).json({ message: info?.message || "Authentication failed" });
        }

        req.login(user, async (err) => {
          if (err) return next(err);
          
          // Create daily login record for existing user
          await storage.checkDailyLogin(user.id);
          
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            level: user.level,
            xp: user.xp,
            points: user.points,
            balance: user.balance,
            streak: user.streak,
            status: user.status,
            isAdmin: user.isAdmin,
          });
        });
      })(req, res, next);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = req.user;
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      level: user.level,
      xp: user.xp,
      points: user.points,
      balance: user.balance,
      streak: user.streak,
      status: user.status,
      isAdmin: user.isAdmin,
    });
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated = (req: any, res: any, next: any) => {
  const userId = req.user?.id || req.user?.sub || (req.user?.claims?.sub);
  console.log(`[Auth Middleware] Authenticated: ${req.isAuthenticated()}, User: ${!!req.user}, ID: ${userId}`);
  
  if ((req.isAuthenticated() && req.user) || userId) {
    // Ensure user object has the expected structure for routes
    if (req.user && !req.user.id && userId) {
      req.user.id = userId;
    }
    
    if (req.user && !req.user.claims) {
      req.user.claims = { 
        sub: userId,
        email: req.user.email,
        first_name: req.user.firstName,
        last_name: req.user.lastName
      };
    }
    return next();
  }
  console.log(`[Auth Middleware] Rejecting request: ${req.method} ${req.originalUrl}`);
  res.status(401).json({ message: "Authentication required" });
};

// Middleware to check if user is admin
export const isAdmin = async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};