/**
 * Referral Notification Helpers
 * Sends notifications for referral updates
 */

import { notificationService, NotificationEvent, NotificationChannel, NotificationPriority } from '../notificationService';

/**
 * Notify user when their referral is successful
 */
export async function notifyReferralUpdate(
  userId: string,
  referredUserName: string,
  points: number = 200
): Promise<boolean> {
  return notificationService.send({
    userId,
    challengeId: '0',
    event: NotificationEvent.REFERRAL_BONUS,
    title: '🎉 Referral Success!',
    body: `${referredUserName} joined using your referral! You earned ${points} Bantah Points`,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    priority: NotificationPriority.HIGH,
    data: {
      pointsType: 'referral_update',
      points,
      referredUser: referredUserName,
      actionUrl: '/wallet',
    },
  });
}
