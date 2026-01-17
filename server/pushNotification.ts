/**
 * Push Notification Service
 * 
 * Sends push notifications to user devices via Expo Push Notification Service.
 * This is used for server-side notifications (e.g., email processing status).
 */

import { getUserPushToken } from "./db";
import { notifyOwner } from "./_core/notification";

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
      console.log(`[PushNotification] No push token for user ${userId}, falling back to platform notification`);
      // Fallback to platform-level notification (Manus notification service)
      return await sendFallbackNotification(payload);
    }

    // Validate Expo push token format
    if (!pushToken.startsWith("ExponentPushToken[") && !pushToken.startsWith("ExpoPushToken[")) {
      console.log(`[PushNotification] Invalid push token format for user ${userId}, falling back to platform notification`);
      return await sendFallbackNotification(payload);
    }

    console.log(`[PushNotification] Sending to user ${userId}: "${payload.title}"`);

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
    console.error("[PushNotification] Error sending notification:", error);
    // Fallback to platform notification on error
    return await sendFallbackNotification(payload);
  }
}

/**
 * Fallback to platform-level notification when push token is not available
 * This sends to the Manus notification service which shows in the Manus app
 */
async function sendFallbackNotification(
  payload: PushNotificationPayload
): Promise<PushNotificationResult> {
  try {
    const success = await notifyOwner({
      title: payload.title,
      content: payload.body,
    });
    
    if (success) {
      console.log(`[PushNotification] Sent fallback notification via Manus`);
      return { success: true };
    } else {
      return { success: false, error: "Fallback notification failed" };
    }
  } catch (error) {
    console.error("[PushNotification] Fallback notification error:", error);
    return { success: false, error: String(error) };
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
