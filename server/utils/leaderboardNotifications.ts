/**
 * Leaderboard Notification Helpers
 * Sends notifications for leaderboard rank changes and trending users
 */

import { notificationService, NotificationEvent, NotificationChannel, NotificationPriority } from '../notificationService';

/**
 * Notify user when their leaderboard rank changes
 */
export async function notifyLeaderboardRankChange(
  userId: string,
  oldRank: number,
  newRank: number
): Promise<boolean> {
  return notificationService.send({
    userId,
    challengeId: '0',
    event: NotificationEvent.LEADERBOARD_RANK_CHANGE,
    title: '🏅 Leaderboard Rank Updated!',
    body: `Your leaderboard rank changed from #${oldRank} to #${newRank}`,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    priority: NotificationPriority.MEDIUM,
    data: {
      oldRank,
      newRank,
      actionUrl: '/wallet/leaderboard',
    },
  });
}

/**
 * Notify user when they are trending (win streak)
 */
export async function notifyTrendingWinStreak(
  userId: string,
  streakCount: number
): Promise<boolean> {
  return notificationService.send({
    userId,
    challengeId: '0',
    event: NotificationEvent.ACHIEVEMENT_UNLOCKED,
    title: '🔥 You are Trending!',
    body: `You are on a ${streakCount}-win streak! Keep it up and climb the leaderboard.`,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    priority: NotificationPriority.HIGH,
    data: {
      streakCount,
      actionUrl: '/wallet/leaderboard',
    },
  });
}
