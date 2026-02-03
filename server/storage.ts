import {
  users,
  events,
  dailyLogins,
  transactions,
  type User,
  type UpsertUser,
  type Event,
  type InsertEvent,
} from "@shared/schema";
import { userWalletAddresses } from "@shared/schema-blockchain";
import { db } from "./db";
import { eq, desc, gte, lte } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithWallets(): Promise<any[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserProfile(id: string, updates: Partial<User>): Promise<User>;

  // Event operations
  getEvents(limit?: number): Promise<Event[]>;
  getEventById(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;

  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  private db = db;

  constructor() {
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async getAllUsersWithWallets(): Promise<any[]> {
    // Get all users with their wallet addresses
    const allUsers = await this.db.select().from(users);
    
    // Get all wallet addresses
    const wallets = await this.db.select().from(userWalletAddresses);
    
    // Create a map of userId -> wallets array
    const walletMap = wallets.reduce((acc: any, wallet: any) => {
      if (!acc[wallet.userId]) {
        acc[wallet.userId] = [];
      }
      acc[wallet.userId].push({
        id: wallet.id,
        walletAddress: wallet.walletAddress,
        chainId: wallet.chainId,
        walletType: wallet.walletType,
        isPrimary: wallet.isPrimary,
        isVerified: wallet.isVerified,
      });
      return acc;
    }, {});
    
    // Merge users with their wallets
    return allUsers.map((user: User) => ({
      ...user,
      wallets: walletMap[user.id] || [],
      // Add primaryWalletAddress for easy searching
      primaryWalletAddress: (walletMap[user.id] || []).find((w: any) => w.isPrimary)?.walletAddress || null,
    }));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(userData as any)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserProfile(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getEvents(limit = 10): Promise<Event[]> {
    return await this.db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt))
      .limit(limit);
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await this.db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await this.db.insert(events).values(event).returning();
    return newEvent;
  }

  // Daily login helpers
  async checkDailyLogin(userId: string) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    // See if there's already an entry today
    const todayRows = await this.db
      .select()
      .from(dailyLogins)
      .where(eq(dailyLogins.userId, userId))
      .where(gte(dailyLogins.date, startOfToday))
      .where(lte(dailyLogins.date, endOfToday))
      .orderBy(desc(dailyLogins.date))
      .limit(1);

    if (todayRows && todayRows.length > 0) {
      const rec = todayRows[0];
      return {
        canClaim: !rec.claimed,
        hasSignedInToday: true,
        streak: rec.streak || 0,
        pointsEarned: rec.pointsEarned || 0,
        hasClaimedToday: !!rec.claimed,
      };
    }

    // No entry today; compute streak from yesterday
    const yesterdayStart = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(startOfToday.getTime() - 1);

    const yesterdayRows = await this.db
      .select()
      .from(dailyLogins)
      .where(eq(dailyLogins.userId, userId))
      .where(dailyLogins.date.gte(yesterdayStart) as any)
      .where(dailyLogins.date.lte(yesterdayEnd) as any)
      .orderBy(desc(dailyLogins.date))
      .limit(1);

    const yesterdayRec = (yesterdayRows && yesterdayRows.length > 0) ? yesterdayRows[0] : null;
    const newStreak = yesterdayRec ? (Number(yesterdayRec.streak || 0) + 1) : 1;

    // Calculate points using same rules as client
    const baseReward = 50;
    const streakBonus = Math.min(newStreak * 10, 200);
    const weeklyBonus = Math.floor(newStreak / 7) * 100;
    const pointsEarned = baseReward + streakBonus + weeklyBonus;

    const [inserted] = await this.db.insert(dailyLogins).values({
      userId,
      date: now,
      streak: newStreak,
      pointsEarned,
      claimed: false,
      createdAt: new Date(),
    }).returning();

    return {
      canClaim: true,
      hasSignedInToday: true,
      streak: inserted.streak || newStreak,
      pointsEarned: inserted.pointsEarned || pointsEarned,
      hasClaimedToday: false,
    };
  }

  async claimDailyLogin(userId: string) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Find today's unclaimed record
    const rows = await this.db
      .select()
      .from(dailyLogins)
      .where(eq(dailyLogins.userId, userId))
      .where(dailyLogins.date.gte(startOfToday) as any)
      .where(dailyLogins.date.lte(endOfToday) as any)
      .orderBy(desc(dailyLogins.date))
      .limit(1);

    if (!rows || rows.length === 0) {
      throw new Error('No daily login available to claim');
    }

    const rec = rows[0];
    if (rec.claimed) {
      throw new Error('Already claimed today');
    }

    // Mark claimed
    await this.db.update(dailyLogins).set({ claimed: true }).where(eq(dailyLogins.id, rec.id));

    // Update user's points balance
    await this.db.execute(sql`UPDATE users SET points = points + ${rec.pointsEarned} WHERE id = ${userId}`);

    // Create transaction record
    await this.db.insert(transactions).values({
      userId,
      type: 'daily_login',
      amount: rec.pointsEarned.toString(),
      description: `Daily login reward - streak ${rec.streak}`,
      status: 'completed',
      createdAt: new Date(),
    });

    return { points: rec.pointsEarned, streak: rec.streak };
  }
}

export const storage = new DatabaseStorage();
