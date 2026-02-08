/**
 * API Routes for On-Chain Challenge Management
 * Integrates blockchain signing with admin panel
 */

import { Router, Request, Response } from 'express';
import { verifyAdminToken } from '../adminAuth';
import { 
  resolveChallengeOnChain,
  batchSignChallenges,
  getSigningStats,
  verifyChallengeSignature 
} from '../blockchain/signing';
import { 
  getChallenge,
  getChallengeParticipants 
} from '../blockchain/helpers';
import {
  recordPointsTransaction,
  updateUserPointsBalance,
} from '../blockchain/db-utils';
import { db } from '../db';
import { challenges, users, transactions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { NotificationService, NotificationEvent, NotificationChannel, NotificationPriority } from '../notificationService';
import { notifyPointsEarnedWin } from '../utils/bantahPointsNotifications';
import { notifyPaymentReceived, notifyPaymentReleased } from '../utils/challengeActivityNotifications';

const router = Router();
const notificationService = new NotificationService();

/**
 * POST /api/admin/challenges/resolve-onchain
 * Resolve a challenge on-chain with admin signature
 * 
 * Body: {
 *   challengeId: number
 *   winner: string (wallet address)
 *   pointsAwarded: number
 * }
 */
router.post(
  '/resolve-onchain',
  verifyAdminToken,
  async (req: Request, res: Response) => {
    try {
      const { challengeId, winner, pointsAwarded } = req.body;

      if (!challengeId || !winner || !pointsAwarded) {
        return res.status(400).json({
          error: 'Missing required fields: challengeId, winner, pointsAwarded',
        });
      }

      if (pointsAwarded < 0) {
        return res.status(400).json({
          error: 'Points awarded must be non-negative',
        });
      }

      console.log(`\n🔍 Resolving challenge ${challengeId} on-chain...`);

      // Step 1: Verify challenge exists on-chain
      console.log(`📋 Fetching challenge details...`);
      const challenge = await getChallenge(challengeId);
      if (!challenge) {
        return res.status(404).json({
          error: `Challenge ${challengeId} not found on-chain`,
        });
      }

      // Step 2: Resolve on-chain (with admin signature)
      console.log(`⛓️  Submitting on-chain resolution...`);
      const txResult = await resolveChallengeOnChain({
        challengeId,
        winner,
        pointsAwarded,
      });

      // Step 3: Update database to track blockchain settlement
      console.log(`💾 Updating database...`);
      const dbChallenge = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, challengeId))
        .limit(1);

      const challenge = dbChallenge[0];

      await db
        .update(challenges)
        .set({
          status: 'resolved',
          resolutionTxHash: txResult.transactionHash,
          resolutionBlockNumber: txResult.blockNumber,
          onChainResolved: true,
          resolutionTimestamp: new Date(),
        })
        .where(eq(challenges.id, challengeId))
        .execute();

      // Step 4: Send notifications to winner and loser
      if (challenge) {
        const winnerAddressLower = winner.toLowerCase();
        const challengerAddressLower = challenge.challenger?.toLowerCase();
        const challengedAddressLower = challenge.challenged?.toLowerCase();

        // Determine if winner is challenger or challenged
        const isWinnerChallenger = challengerAddressLower === winnerAddressLower;

        // Get winner and loser user IDs
        const winnerId = isWinnerChallenger ? challenge.challenger : challenge.challenged;
        const loserId = isWinnerChallenger ? challenge.challenged : challenge.challenger;

        // Get winner and loser names for notifications
        const winnerUser = winnerId ? await db.select().from(users).where(eq(users.id, winnerId)).limit(1) : null;
        const loserUser = loserId ? await db.select().from(users).where(eq(users.id, loserId)).limit(1) : null;

        const winnerName = winnerUser?.[0]?.firstName || 'Winner';
        const loserName = loserUser?.[0]?.firstName || 'Loser';
        const challengeTitle = challenge.title || `Challenge #${challengeId}`;

        // Send notification to winner
        if (winnerId) {
          try {
            await notifyPointsEarnedWin(
              winnerId,
              challengeId,
              pointsAwarded,
              challengeTitle,
              challenge.amount ? `+${challenge.amount}` : undefined
            );
            console.log(`🏆 Win notification sent to ${winnerName}`);
          } catch (err) {
            console.warn(`Failed to send win notification to ${winnerName}:`, err);
          }

          // Also send a general celebration notification
          await notificationService.send({
            userId: winnerId,
            challengeId: challengeId.toString(),
            event: NotificationEvent.CHALLENGE_COMPLETED,
            title: `🏆 Challenge Won! Bantah Points Awarded`,
            body: `Congratulations! You won the challenge "${challengeTitle}" and earned ${pointsAwarded} Bantah Points!`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
            priority: NotificationPriority.HIGH,
            data: {
              challengeId,
              pointsAwarded,
              challengeTitle,
            },
          }).catch(err => console.warn('Failed to send victory notification:', err));

          // Notify winner about payment release
          const paymentAmount = challenge.amount ? `+${challenge.amount} stakes` : 'stakes';
          notifyPaymentReleased(winnerId, challengeId, paymentAmount, challengeTitle, loserName)
            .catch(err => console.warn('Failed to notify winner of payment release:', err.message));

          // Award points to winner
          try {
            // ✅ Update legacy points column for backwards compatibility
            await db.execute(
              `UPDATE users SET points = points + ${pointsAwarded} WHERE id = '${winnerId}'`
            );

            // ✅ Create transaction record for the win (legacy)
            await db.insert(transactions).values({
              userId: winnerId,
              type: 'challenge_won',
              amount: pointsAwarded.toFixed(2),
              description: `Won challenge "${challengeTitle}" against @${loserName}`,
              status: 'completed',
              createdAt: new Date(),
            });

            // ✅ NEW: Record in the new blockchain points ledger system
            const pointsInWei = BigInt(Math.floor(pointsAwarded * 1e18));
            await recordPointsTransaction({
              userId: winnerId,
              challengeId: challengeId,
              transactionType: 'earned_challenge',
              amount: pointsInWei,
              reason: `Won challenge "${challengeTitle}" against @${loserName}`,
              blockchainTxHash: txResult.transactionHash,
              createdAt: new Date(),
            });

            // ✅ NEW: Sync the userPointsLedgers table with the updated balance
            await updateUserPointsBalance(winnerId);

            console.log(`💰 Awarded ${pointsAwarded} points to winner ${winnerId}`);
          } catch (err) {
            console.warn(`Failed to award points to winner:`, err);
          }
        }

        // Send notification to loser
        if (loserId) {
          try {
            await notificationService.send({
              userId: loserId,
              challengeId: challengeId.toString(),
              event: NotificationEvent.CHALLENGE_COMPLETED,
              title: `😞 Challenge Lost`,
              body: `You lost the challenge "${challengeTitle}" against ${winnerName}. Better luck next time!`,
              channels: [NotificationChannel.IN_APP],
              priority: NotificationPriority.MEDIUM,
              data: {
                challengeId,
                challengeTitle,
                winner: winnerName,
              },
            }).catch(err => console.warn('Failed to send loss notification:', err));

            console.log(`😞 Loss notification sent to ${loserName}`);
          } catch (err) {
            console.warn(`Failed to send loss notification:`, err);
          }
        }
      }

      res.json({
        success: true,
        message: 'Challenge resolved on-chain',
        challengeId,
        winner,
        pointsAwarded,
        transactionHash: txResult.transactionHash,
        blockNumber: txResult.blockNumber,
        gasUsed: txResult.gasUsed,
      });
    } catch (error: any) {
      console.error('❌ Failed to resolve challenge on-chain:', error);
      res.status(500).json({
        error: 'Failed to resolve challenge on-chain',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/admin/challenges/batch-resolve-onchain
 * Batch resolve multiple challenges on-chain
 * 
 * Body: {
 *   challenges: [
 *     { challengeId: number, winner: string, pointsAwarded: number },
 *     ...
 *   ]
 * }
 */
router.post(
  '/batch-resolve-onchain',
  verifyAdminToken,
  async (req: Request, res: Response) => {
    try {
      const { challenges: challengesToResolve } = req.body;

      if (!Array.isArray(challengesToResolve) || challengesToResolve.length === 0) {
        return res.status(400).json({
          error: 'Must provide array of challenges to resolve',
        });
      }

      console.log(`\n📦 Batch resolving ${challengesToResolve.length} challenges...`);

      const results = [];
      const failures = [];

      for (const challenge of challengesToResolve) {
        try {
          console.log(`\n⛓️  Resolving challenge ${challenge.challengeId}...`);
          
          const txResult = await resolveChallengeOnChain({
            challengeId: challenge.challengeId,
            winner: challenge.winner,
            pointsAwarded: challenge.pointsAwarded,
          });

          // Update database
          await db
            .update(challenges)
            .set({
              status: 'resolved',
              resolutionTxHash: txResult.transactionHash,
              resolutionBlockNumber: txResult.blockNumber,
              onChainResolved: true,
              resolutionTimestamp: new Date(),
            })
            .where(eq(challenges.id, challenge.challengeId))
            .execute();

          results.push({
            challengeId: challenge.challengeId,
            success: true,
            transactionHash: txResult.transactionHash,
            blockNumber: txResult.blockNumber,
          });
        } catch (error: any) {
          failures.push({
            challengeId: challenge.challengeId,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({
        total: challengesToResolve.length,
        successful: results.length,
        failed: failures.length,
        results,
        failures: failures.length > 0 ? failures : undefined,
      });
    } catch (error: any) {
      console.error('❌ Batch resolution failed:', error);
      res.status(500).json({
        error: 'Batch resolution failed',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/admin/blockchain/signing-stats
 * Get signing infrastructure status for dashboard
 */
router.get('/blockchain/signing-stats', verifyAdminToken, async (req: Request, res: Response) => {
  try {
    const stats = await getSigningStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get signing stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/challenges/pending
 * Get all challenges awaiting admin resolution
 */
router.get('/pending', verifyAdminToken, async (req: Request, res: Response) => {
  try {
    // Fetch from database challenges that need resolution
    const pendingChallenges = await db
      .select()
      .from(challenges)
      .where(eq(challenges.status, 'pending_admin_resolution'))
      .execute();

    // Enrich with on-chain data if available
    const enriched = await Promise.all(
      pendingChallenges.map(async (challenge) => {
        try {
          const onChainData = await getChallenge(challenge.id);
          const participants = await getChallengeParticipants(challenge.id);
          return {
            ...challenge,
            onChainData,
            participants,
          };
        } catch (error) {
          return {
            ...challenge,
            onChainData: null,
            participants: null,
            error: 'Failed to fetch on-chain data',
          };
        }
      })
    );

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to fetch pending challenges:', error);
    res.status(500).json({
      error: 'Failed to fetch pending challenges',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/challenges/verify-signature
 * Verify an admin signature (for testing/validation)
 */
router.post(
  '/verify-signature',
  verifyAdminToken,
  async (req: Request, res: Response) => {
    try {
      const { challengeId, winner, pointsAwarded, signature } = req.body;

      if (!signature) {
        return res.status(400).json({
          error: 'Signature required',
        });
      }

      const verification = await verifyChallengeSignature(
        { challengeId, winner, pointsAwarded },
        signature
      );

      res.json({
        isValid: verification.isValid,
        signer: verification.signer,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Signature verification failed',
        message: error.message,
      });
    }
  }
);

export default router;
