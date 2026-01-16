import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Storage keys
const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";
const SCHEDULED_NOTIFICATIONS_KEY = "scheduled_notifications";

// Notification channel for Android
const CHANNEL_ID = "trip_reminders";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Document category labels for status display
const CATEGORY_LABELS: Record<string, string> = {
  flight: "Flights",
  accommodation: "Hotels",
  carRental: "Car Rental",
  medical: "Insurance",
  event: "Activities",
  other: "Other",
};

// All categories to check
const ALL_CATEGORIES = ["flight", "accommodation", "carRental", "medical", "event", "other"];

export interface TripDocumentStatus {
  tripId: number;
  tripName: string;
  startDate: Date;
  endDate: Date;
  categories: Record<string, boolean>; // category -> hasDocuments
}

export interface ScheduledNotification {
  id: string;
  tripId: number;
  type: "7_days_before" | "1_day_before" | "flight_checkin" | "car_return";
  scheduledFor: number; // timestamp
}

/**
 * Initialize notification permissions and channel
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission not granted");
      return false;
    }

    // Create Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Trip Reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#007AFF",
      });
    }

    return true;
  } catch (error) {
    console.error("[Notifications] Failed to initialize:", error);
    return false;
  }
}

/**
 * Check if notifications are enabled by user preference
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    // Default to true if not set
    return value === null || value === "true";
  } catch {
    return true;
  }
}

/**
 * Set user notification preference
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? "true" : "false");
    
    if (!enabled) {
      // Cancel all scheduled notifications when disabled
      await cancelAllTripNotifications();
    }
  } catch (error) {
    console.error("[Notifications] Failed to save preference:", error);
  }
}

/**
 * Get stored scheduled notifications
 */
async function getScheduledNotifications(): Promise<ScheduledNotification[]> {
  try {
    const value = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

/**
 * Save scheduled notifications
 */
async function saveScheduledNotifications(notifications: ScheduledNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("[Notifications] Failed to save scheduled notifications:", error);
  }
}

/**
 * Build status overview message for trip
 */
function buildStatusOverview(status: TripDocumentStatus): string {
  const lines: string[] = [];
  
  for (const category of ALL_CATEGORIES) {
    const hasDoc = status.categories[category] || false;
    const icon = hasDoc ? "✅" : "⚪";
    const label = CATEGORY_LABELS[category] || category;
    lines.push(`${icon} ${label}`);
  }
  
  return lines.join("\n");
}

/**
 * Schedule 7-day before trip notification
 */
export async function schedule7DayNotification(status: TripDocumentStatus): Promise<string | null> {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return null;

  const now = new Date();
  const tripStart = new Date(status.startDate);
  const sevenDaysBefore = new Date(tripStart);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  sevenDaysBefore.setHours(10, 0, 0, 0); // 10 AM

  // Don't schedule if already past
  if (sevenDaysBefore <= now) return null;

  const statusOverview = buildStatusOverview(status);
  const title = `${status.tripName} - 7 Days Away`;
  const body = `Your trip starts in 7 days. Here's your document status:\n\n${statusOverview}`;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { tripId: status.tripId, type: "7_days_before" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: sevenDaysBefore,
      },
    });

    // Save to storage
    const scheduled = await getScheduledNotifications();
    scheduled.push({
      id,
      tripId: status.tripId,
      type: "7_days_before",
      scheduledFor: sevenDaysBefore.getTime(),
    });
    await saveScheduledNotifications(scheduled);

    return id;
  } catch (error) {
    console.error("[Notifications] Failed to schedule 7-day notification:", error);
    return null;
  }
}

/**
 * Schedule 1-day before trip notification
 */
export async function schedule1DayNotification(
  status: TripDocumentStatus,
  hasFlights: boolean
): Promise<string | null> {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return null;

  const now = new Date();
  const tripStart = new Date(status.startDate);
  const oneDayBefore = new Date(tripStart);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  oneDayBefore.setHours(10, 0, 0, 0); // 10 AM

  // Don't schedule if already past
  if (oneDayBefore <= now) return null;

  const statusOverview = buildStatusOverview(status);
  let body = `Your trip starts tomorrow! Here's your document status:\n\n${statusOverview}`;
  
  if (hasFlights) {
    body += "\n\n💡 Remember to check in for your flights if you haven't already.";
  }

  const title = `${status.tripName} - Tomorrow!`;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { tripId: status.tripId, type: "1_day_before" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: oneDayBefore,
      },
    });

    // Save to storage
    const scheduled = await getScheduledNotifications();
    scheduled.push({
      id,
      tripId: status.tripId,
      type: "1_day_before",
      scheduledFor: oneDayBefore.getTime(),
    });
    await saveScheduledNotifications(scheduled);

    return id;
  } catch (error) {
    console.error("[Notifications] Failed to schedule 1-day notification:", error);
    return null;
  }
}

/**
 * Schedule flight check-in reminder (24 hours before departure)
 */
export async function scheduleFlightCheckinReminder(
  tripId: number,
  tripName: string,
  flightTitle: string,
  departureTime: Date
): Promise<string | null> {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return null;

  const now = new Date();
  const checkinTime = new Date(departureTime);
  checkinTime.setHours(checkinTime.getHours() - 24);

  // Don't schedule if already past
  if (checkinTime <= now) return null;

  const title = `Flight Check-in Available`;
  const body = `${tripName}: Online check-in is now open for ${flightTitle}. Most airlines allow check-in 24 hours before departure.`;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { tripId, type: "flight_checkin" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: checkinTime,
      },
    });

    // Save to storage
    const scheduled = await getScheduledNotifications();
    scheduled.push({
      id,
      tripId,
      type: "flight_checkin",
      scheduledFor: checkinTime.getTime(),
    });
    await saveScheduledNotifications(scheduled);

    return id;
  } catch (error) {
    console.error("[Notifications] Failed to schedule flight check-in reminder:", error);
    return null;
  }
}

/**
 * Schedule car rental return reminder (morning of return day)
 */
export async function scheduleCarReturnReminder(
  tripId: number,
  tripName: string,
  carCompany: string,
  dropoffTime: Date,
  dropoffLocation: string
): Promise<string | null> {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return null;

  const now = new Date();
  const reminderTime = new Date(dropoffTime);
  reminderTime.setHours(8, 0, 0, 0); // 8 AM on return day

  // Don't schedule if already past
  if (reminderTime <= now) return null;

  const title = `Car Return Today`;
  const body = `${tripName}: Remember to return your ${carCompany} rental${dropoffLocation ? ` at ${dropoffLocation}` : ""}.`;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { tripId, type: "car_return" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });

    // Save to storage
    const scheduled = await getScheduledNotifications();
    scheduled.push({
      id,
      tripId,
      type: "car_return",
      scheduledFor: reminderTime.getTime(),
    });
    await saveScheduledNotifications(scheduled);

    return id;
  } catch (error) {
    console.error("[Notifications] Failed to schedule car return reminder:", error);
    return null;
  }
}

/**
 * Cancel all notifications for a specific trip
 */
export async function cancelTripNotifications(tripId: number): Promise<void> {
  try {
    const scheduled = await getScheduledNotifications();
    const tripNotifications = scheduled.filter((n) => n.tripId === tripId);
    
    for (const notification of tripNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.id);
    }
    
    // Remove from storage
    const remaining = scheduled.filter((n) => n.tripId !== tripId);
    await saveScheduledNotifications(remaining);
  } catch (error) {
    console.error("[Notifications] Failed to cancel trip notifications:", error);
  }
}

/**
 * Cancel all scheduled trip notifications
 */
export async function cancelAllTripNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await saveScheduledNotifications([]);
  } catch (error) {
    console.error("[Notifications] Failed to cancel all notifications:", error);
  }
}

/**
 * Get count of scheduled notifications
 */
export async function getScheduledNotificationCount(): Promise<number> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  } catch {
    return 0;
  }
}
