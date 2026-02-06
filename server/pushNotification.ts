/**
 * Push Notification Service
 * 
 * Sends push notifications to user devices via Expo Push Notification Service.
 * This is used for server-side notifications (e.g., email processing status).
 */

import { getUserPushToken } from "./db";

// Expo Push API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Send a push notification to a specific user's device
 */
export async function sendPushNotification(
  userId: number,
  payload: PushNotificationPayload
): Promise<PushNotificationResult> {
  try {
    // Get user's push token from database
    const pushToken = await getUserPushToken(userId);
    
    if (!pushToken) {
      const timestamp = new Date().toISOString();
      console.warn(`[PushNotification] [${timestamp}] No push token found for user ${userId}. Possible reasons: user hasn't opened app yet, denied permissions, token registration failed, or on web platform. Notification will not be sent.`);
      return { 
        success: false, 
        error: `No push token registered for user ${userId}. User needs to open the app and enable notifications.` 
      };
    }

    // Validate Expo push token format
    if (!pushToken.startsWith("ExponentPushToken[") && !pushToken.startsWith("ExpoPushToken[")) {
      const timestamp = new Date().toISOString();
      console.warn(`[PushNotification] [${timestamp}] Invalid push token format for user ${userId}. Token preview: ${pushToken.substring(0, 50)}... (length: ${pushToken.length}). Notification will not be sent.`);
      return { 
        success: false, 
        error: `Invalid push token format for user ${userId}` 
      };
    }

    const timestamp = new Date().toISOString();
    console.log(`[PushNotification] [${timestamp}] Sending to user ${userId}: "${payload.title}"`);

    // Send to Expo Push API
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: "default",
        priority: "high",
        channelId: "email_processing", // Android notification channel
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PushNotification] Expo API error: ${response.status} - ${errorText}`);
      return { success: false, error: `Expo API error: ${response.status}` };
    }

    const result = await response.json();
    
    // Check for ticket errors
    if (result.data && result.data[0]) {
      const ticket = result.data[0];
      if (ticket.status === "error") {
        console.error(`[PushNotification] Ticket error: ${ticket.message}`);
        return { success: false, error: ticket.message };
      }
    }

    console.log(`[PushNotification] Successfully sent to user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error(`[PushNotification] Error sending notification to user ${userId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Notification types for email processing
 */
export const EmailProcessingNotifications = {
  received: (subject?: string): PushNotificationPayload => ({
    title: "📧 Email Received",
    body: subject 
      ? `Processing: "${subject.substring(0, 50)}${subject.length > 50 ? '...' : ''}"`
      : "Processing your forwarded email...",
    data: { type: "email_received" },
  }),

  completed: (documentCount: number): PushNotificationPayload => ({
    title: "✅ Documents Added",
    body: documentCount === 1
      ? "1 travel document was extracted and added to your inbox."
      : `${documentCount} travel documents were extracted and added to your inbox.`,
    data: { type: "email_completed", documentCount },
  }),

  noBookingsFound: (subject?: string): PushNotificationPayload => ({
    title: "📭 No Bookings Found",
    body: subject
      ? `No travel bookings found in "${subject.substring(0, 40)}${subject.length > 40 ? '...' : ''}"`
      : "No travel bookings were found in your email.",
    data: { type: "email_no_bookings" },
  }),

  noCredits: (): PushNotificationPayload => ({
    title: "⚠️ No Credits Remaining",
    body: "Your email was received but couldn't be processed. Please add more credits to continue.",
    data: { type: "email_no_credits" },
  }),

  error: (message?: string): PushNotificationPayload => ({
    title: "❌ Processing Failed",
    body: message || "There was an error processing your email. Please try again.",
    data: { type: "email_error" },
  }),
};
