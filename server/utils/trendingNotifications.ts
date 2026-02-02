/**
 * Trending Notification Helpers
 * Sends notifications for trending users (challenge win streaks)
 */

import { notificationService, NotificationEvent, NotificationChannel, NotificationPriority } from '../notificationService';

/**
 * Notify user when they are trending (challenge win streak)
 */
export async function notifyTrendingUser(
  userId: string,
  winStreak: number
): Promise<boolean> {
  return notificationService.send({
    userId,
    challengeId: '0',
    event: NotificationEvent.ACHIEVEMENT_UNLOCKED,
    title: '🔥 Trending: Win Streak!',
    body: `You are trending with a ${winStreak}-win streak! Keep winning to climb the leaderboard!`,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    priority: NotificationPriority.HIGH,
    data: {
      winStreak,
      actionUrl: '/wallet/leaderboard',
    },
  });
}
