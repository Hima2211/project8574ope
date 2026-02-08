/**
 * User Account Routes
 * Handles FCM token storage and user settings
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, transactions, dailyLogins, challenges } from '../../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth';
import { PrivyAuthMiddleware } from '../privyAuth';
import { storage } from '../storage';
import { notificationService, NotificationEvent, NotificationChannel, NotificationPriority } from '../notificationService';

const router = Router();

/**
 * POST /api/user/fcm-token
 * Save FCM token for current user (for push notifications)
 */
router.post('/fcm-token', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid FCM token' });
    }

    // Update user's FCM token
    const updated = await db
      .update(users)
      .set({
        fcmToken: token,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    console.log(`✅ FCM token saved for user ${userId}`);

    res.json({
      success: true,
      message: 'FCM token saved',
      user: {
        id: updated[0].id,
        fcmTokenSet: !!updated[0].fcmToken,
      },
    });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord || userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRecord[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        level: user.level,
        xp: user.xp,
        points: user.points,
        balance: user.balance,
        followerCount: user.followerCount || 0,
        followingCount: user.followingCount || 0,
        fcmTokenSet: !!user.fcmToken,
        isTelegramUser: user.isTelegramUser,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/users/:userId/profile
 * Get public profile for a specific user
 */
router.get('/users/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord || userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRecord[0];

    // Get basic stats
    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      email: user.email,
      profileImageUrl: user.profileImageUrl,
      points: user.points || 0,
      level: user.level || 1,
      xp: user.xp || 0,
      streak: user.streak || 0,
      createdAt: user.createdAt,
      followerCount: user.followerCount || 0,
      followingCount: user.followingCount || 0,
      stats: {
        wins: user.wins || 0,
        activeChallenges: 0, // Could be calculated if needed
        totalEarnings: Number(user.balance || 0),
        coins: user.coins || 0,
      }
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/transactions
 * Get current user's transaction history (deposits, withdrawals, challenge earnings, etc.)
 */
router.get('/transactions', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      console.error('❌ No userId in request for transactions');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`📋 Fetching transactions for user: ${userId}`);

    const limitNum = Math.min(parseInt(limit as string) || 50, 200);
    const offsetNum = parseInt(offset as string) || 0;

    // Fetch user's transactions ordered by most recent
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    console.log(`   Found ${userTransactions.length} transactions for user ${userId}`);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: () => null })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const total = totalResult.length || 0;

    console.log(`   Total transactions: ${total}`);

    // Format response
    const formattedTransactions = userTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      status: tx.status,
      createdAt: tx.createdAt,
      relatedId: tx.relatedId,
    }));

    const response = {
      transactions: formattedTransactions,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total,
      },
    };

    console.log(`   Returning response:`, JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message,
    });
  }
});

/**
 * GET /api/debug/transactions
 * Debug endpoint to check transaction data in database
 */
router.get('/debug/transactions', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`\n🔍 DEBUG: Checking transactions for user: ${userId}`);

    // Check all transactions count
    const allTxCount = await db.select({ count: sql`COUNT(*)` }).from(transactions);
    console.log(`   Total transactions in DB: ${(allTxCount[0] as any)?.count || 0}`);

    // Check transactions for this user
    const userTxCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(transactions)
      .where(eq(transactions.userId, userId));
    console.log(`   User's transactions: ${(userTxCount[0] as any)?.count || 0}`);

    // Get first 10 transactions for this user
    const userTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(10);

    console.log(`   User transaction details:`, userTxs);

    // Also check if user has created any challenges
    const userChallenges = await db
      .select({ count: sql`COUNT(*)` })
      .from(challenges)
      .where(eq(challenges.challenger as any, userId));
    
    console.log(`   User's challenges created: ${(userChallenges[0] as any)?.count || 0}`);

    res.json({
      userId,
      debug: {
        totalTransactionsInDB: (allTxCount[0] as any)?.count || 0,
        userTransactionCount: (userTxCount[0] as any)?.count || 0,
        userTransactions: userTxs,
        userChallengesCreated: (userChallenges[0] as any)?.count || 0,
      }
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/debug/create-test-transaction
 * Create a test transaction for debugging
 */
router.post('/debug/create-test-transaction', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`\n✅ Creating test transaction for user: ${userId}`);

    // Create a test transaction
    const testTx = await db.insert(transactions).values({
      userId,
      type: 'test_transaction',
      amount: '100.00',
      description: 'Test transaction for debugging',
      status: 'completed',
      createdAt: new Date(),
    }).returning();

    console.log(`   Created test transaction:`, testTx);

    res.json({
      success: true,
      message: 'Test transaction created',
      transaction: testTx[0],
    });
  } catch (error: any) {
    console.error('Error creating test transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/user/profile
 * Update current user profile
 */
router.patch('/profile', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, username, profileImageUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Update user record
    const updated = await db
      .update(users)
      .set({
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        username: username !== undefined ? username : undefined,
        profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Profile updated for user ${userId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updated[0],
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      message: error.message 
    });
  }
});

/**
 * GET /api/user/stats
 * Get user statistics (wins, friends, challenges created, etc.)
 */
router.get('/stats', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user profile for points and streak
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord || userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRecord[0];

    // Return user stats
    res.json({
      wins: user.wins || 0,
      friendsCount: user.friendsCount || 0,
      eventWins: user.eventWins || 0,
      challengesCreated: user.challengesCreated || 0,
      streak: user.streak || 0,
      points: user.points || 0,
      coins: user.coins || 0,
    });
  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/user/achievements
 * Get user achievements/badges
 */
router.get('/achievements', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user profile
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord || userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRecord[0];

    // Define achievements based on user stats
    const achievements = [
      {
        id: 'first_challenge',
        name: 'First Win',
        description: 'Win your first challenge',
        unlocked: (user.wins || 0) >= 1,
        unlockedAt: user.createdAt,
        pointsReward: 100,
      },
      {
        id: 'streak_master',
        name: 'Streak Master',
        description: 'Login 7 days in a row',
        unlocked: (user.streak || 0) >= 7,
        pointsReward: 250,
      },
      {
        id: 'social_butterfly',
        name: 'Social Butterfly',
        description: 'Make 10 friends',
        unlocked: (user.friendsCount || 0) >= 10,
        pointsReward: 500,
      },
      {
        id: 'big_better',
        name: 'Big Better',
        description: 'Win 5 events',
        unlocked: (user.eventWins || 0) >= 5,
        pointsReward: 300,
      },
      {
        id: 'challenger',
        name: 'Challenger',
        description: 'Create 20 challenges',
        unlocked: (user.challengesCreated || 0) >= 20,
        pointsReward: 350,
      },
    ];

    res.json(achievements);
  } catch (error: any) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({
      error: 'Failed to fetch achievements',
      message: error.message,
    });
  }
});

/**
 * GET /api/daily-signin/history
 * Get user's daily login history
 */
router.get('/daily-signin/history', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 30 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limitNum = Math.min(parseInt(limit as string) || 30, 365);

    // Fetch daily logins
    const logins = await db
      .select()
      .from(dailyLogins)
      .where(eq(dailyLogins.userId, userId))
      .orderBy(desc(dailyLogins.createdAt))
      .limit(limitNum);

    // Format response
    const formattedLogins = logins.map((login) => ({
      id: login.id,
      streak: login.streak || 0,
      pointsEarned: login.pointsEarned || 0,
      claimed: login.claimed || false,
      createdAt: login.createdAt,
    }));

    res.json(formattedLogins);
  } catch (error: any) {
    console.error('Error fetching daily signin history:', error);
    res.status(500).json({
      error: 'Failed to fetch daily signin history',
      message: error.message,
    });
  }
});

/**
 * GET /api/daily-signin/status
 * Returns whether user has signed in today and can claim
 */
router.get('/daily-signin/status', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const status = await storage.checkDailyLogin(userId);
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching daily signin status:', error);
    res.status(500).json({ error: 'Failed to fetch daily signin status', message: error.message });
  }
});

/**
 * POST /api/daily-signin/claim
 * Claim today's daily login reward
 */
router.post('/daily-signin/claim', PrivyAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const result = await storage.claimDailyLogin(userId);

    // Send notification about points earned
    try {
      await notificationService.send({
        userId,
        challengeId: '0',
        event: NotificationEvent.POINTS_EARNED,
        title: '🎉 Daily Login Bonus!',
        body: `You received ${result.points} Bantah Points for logging in today!`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        priority: NotificationPriority.MEDIUM,
        data: { points: result.points, streak: result.streak, actionUrl: '/wallet' },
      });
    } catch (notifErr) {
      console.warn('Failed to send daily-login notification:', notifErr);
    }

    res.json({ success: true, points: result.points, streak: result.streak });
  } catch (error: any) {
    console.error('Error claiming daily signin reward:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/users/public
 * Get list of all public users (for opponent search, leaderboard, etc.)
 * No authentication required
 */
router.get('/public', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || '';

    let query = db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        level: users.level,
        points: users.points,
        followerCount: users.followerCount,
        status: users.status,
      })
      .from(users)
      .where(eq(users.status, 'active'));

    if (search) {
      // Search by username or name
      query = query.where(
        db.raw(
          `(username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)`,
          [`%${search}%`]
        )
      );
    }

    const allUsers = await query
      .limit(limit)
      .offset(offset);

    console.log(`📋 GET /api/users/public: ${allUsers.length} users found (search: "${search}")`);

    res.json(allUsers);
  } catch (error: any) {
    console.error('Error fetching public users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message,
    });
  }
});

export default router;
