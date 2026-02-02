/**
 * Firebase Admin SDK initialization
 * For sending push notifications via FCM
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as admin from 'firebase-admin';

let initialized = false;

/**
 * Initialize Firebase Admin SDK
 */
export async function initializeFirebase() {
  if (initialized) {
    console.log('🔥 Firebase Admin SDK already initialized');
    return;
  }

  try {

    // Try to get credentials from environment variable (JSON string)
    const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;

    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      admin.initializeApp({
        credential: admin.credential.cert(credentials as any),
      });
      console.log('✅ Firebase Admin SDK initialized with FIREBASE_ADMIN_CREDENTIALS env var');
    } else if (process.env.FIREBASE_ADMIN_KEY_PATH) {
      // Try to load from file path
      const keyPath = resolve(process.env.FIREBASE_ADMIN_KEY_PATH);

      // Guard: if file does not exist, log a concise warning and skip initialization
      try {
        if (!require('fs').existsSync(keyPath)) {
          console.warn(`⚠️  Firebase key file not found at ${keyPath}. Push notifications disabled.`);
          console.warn('   Set FIREBASE_ADMIN_CREDENTIALS or ensure FIREBASE_ADMIN_KEY_PATH points to a valid file');
          return;
        }
      } catch (err) {
        console.warn('⚠️  Could not access Firebase key path:', err?.message || err);
        return;
      }

      const credentials = JSON.parse(readFileSync(keyPath, 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(credentials as any),
      });
      console.log('✅ Firebase Admin SDK initialized with key file');
    } else {
      console.warn('⚠️  Firebase Admin credentials not found. Push notifications disabled.');
      console.warn('   Set FIREBASE_ADMIN_CREDENTIALS or FIREBASE_ADMIN_KEY_PATH env var');
      return;
    }

    initialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    console.warn('   Push notifications via Firebase will not work');
  }
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: {
    requireInteraction?: boolean;
    priority?: 'high' | 'normal';
  }
) {
    try {
      if (!admin || !admin.apps || admin.apps.length === 0) {
        console.warn('⚠️  Firebase Admin SDK not initialized');
        return false;
      }

      const message: any = {
       token: fcmToken,
       notification: {
         title,
         body,
       },
       data: {
         ...data,
         timestamp: new Date().toISOString(),
       },
       android: {
         priority: options?.priority === 'high' ? 'high' : 'normal',
         notification: {
           sound: 'default',
           clickAction: 'FLUTTER_NOTIFICATION_CLICK',
           channelId: 'default_channel',
         },
       },
       webpush: {
         notification: {
           title,
           body,
           icon: '/assets/bantahblue.svg',
           badge: '/assets/bantahblue.svg',
           requireInteraction: options?.requireInteraction || false,
           tag: data?.challengeId || data?.eventId || 'notification',
         },
       },
     };

      const response = await admin.messaging().send(message);
      console.log(`✅ Push notification sent to FCM token: ${response}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      
      // Handle specific error cases
      try {
        if (admin && admin.messaging && error instanceof admin.messaging.MessagingError) {
          if (error.code === 'messaging/invalid-registration-token' || 
              error.code === 'messaging/registration-token-not-registered') {
            console.warn('⚠️  FCM token is invalid or expired, should be refreshed by client');
          }
        }
      } catch {}
      
      return false;
    }
}

/**
 * Send multicast push notification (to multiple FCM tokens)
 */
export async function sendMulticastPushNotification(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
    try {
      if (!admin || !admin.apps || admin.apps.length === 0) {
        console.warn('⚠️  Firebase Admin SDK not initialized');
        return { successCount: 0, failureCount: fcmTokens.length };
      }

      const message: any = {
       tokens: fcmTokens,
       notification: {
         title,
         body,
       },
       data: {
         ...data,
         timestamp: new Date().toISOString(),
       },
       webpush: {
         notification: {
           title,
           body,
           icon: '/assets/bantahblue.svg',
         },
       },
     };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`✅ Multicast notification sent: ${response.successCount} successful, ${response.failureCount} failed`);
      return response;
    } catch (error) {
      console.error('❌ Error sending multicast notification:', error);
      return { successCount: 0, failureCount: fcmTokens.length };
    }
}

export default admin;
