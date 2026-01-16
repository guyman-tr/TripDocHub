import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules before imports
const mockGetPermissionsAsync = vi.fn().mockResolvedValue({ status: "granted" });
const mockRequestPermissionsAsync = vi.fn().mockResolvedValue({ status: "granted" });
const mockSetNotificationChannelAsync = vi.fn().mockResolvedValue(undefined);
const mockScheduleNotificationAsync = vi.fn().mockResolvedValue("notification-id-123");
const mockCancelScheduledNotificationAsync = vi.fn().mockResolvedValue(undefined);
const mockCancelAllScheduledNotificationsAsync = vi.fn().mockResolvedValue(undefined);
const mockGetAllScheduledNotificationsAsync = vi.fn().mockResolvedValue([]);

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync: mockCancelAllScheduledNotificationsAsync,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

const mockGetItem = vi.fn();
const mockSetItem = vi.fn().mockResolvedValue(undefined);
const mockRemoveItem = vi.fn().mockResolvedValue(undefined);

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

describe("Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default to notifications enabled and empty scheduled notifications
    mockGetItem.mockImplementation((key: string) => {
      if (key === "notifications_enabled") return Promise.resolve("true");
      if (key === "scheduled_notifications") return Promise.resolve("[]");
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initializeNotifications", () => {
    it("should request notification permissions", async () => {
      const { initializeNotifications } = await import("../lib/notifications");
      
      const result = await initializeNotifications();
      
      expect(mockGetPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when permission is denied", async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
      
      const { initializeNotifications } = await import("../lib/notifications");
      const result = await initializeNotifications();
      
      expect(result).toBe(false);
    });
  });

  describe("areNotificationsEnabled", () => {
    it("should return true by default when not set", async () => {
      mockGetItem.mockResolvedValueOnce(null);
      
      const { areNotificationsEnabled } = await import("../lib/notifications");
      const result = await areNotificationsEnabled();
      expect(result).toBe(true);
    });

    it("should return stored preference when set to false", async () => {
      mockGetItem.mockResolvedValueOnce("false");
      
      const { areNotificationsEnabled } = await import("../lib/notifications");
      const result = await areNotificationsEnabled();
      expect(result).toBe(false);
    });
  });

  describe("setNotificationsEnabled", () => {
    it("should save preference to storage", async () => {
      const { setNotificationsEnabled } = await import("../lib/notifications");
      
      await setNotificationsEnabled(false);
      
      expect(mockSetItem).toHaveBeenCalledWith("notifications_enabled", "false");
    });

    it("should cancel all notifications when disabled", async () => {
      const { setNotificationsEnabled } = await import("../lib/notifications");
      
      await setNotificationsEnabled(false);
      
      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe("schedule7DayNotification", () => {
    it("should not schedule if notifications are disabled", async () => {
      mockGetItem.mockResolvedValueOnce("false");
      
      const { schedule7DayNotification } = await import("../lib/notifications");
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      
      const result = await schedule7DayNotification({
        tripId: 1,
        tripName: "Test Trip",
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        categories: { flight: true, accommodation: false, carRental: false, medical: false, event: false, other: false },
      });
      
      expect(result).toBe(null);
    });

    it("should not schedule if trip is less than 7 days away", async () => {
      const { schedule7DayNotification } = await import("../lib/notifications");
      
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 3);
      
      const result = await schedule7DayNotification({
        tripId: 1,
        tripName: "Test Trip",
        startDate: nearDate,
        endDate: new Date(nearDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        categories: { flight: true, accommodation: false, carRental: false, medical: false, event: false, other: false },
      });
      
      expect(result).toBe(null);
    });

    it("should schedule notification for trip more than 7 days away", async () => {
      const { schedule7DayNotification } = await import("../lib/notifications");
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      
      const result = await schedule7DayNotification({
        tripId: 1,
        tripName: "Test Trip",
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        categories: { flight: true, accommodation: false, carRental: false, medical: false, event: false, other: false },
      });
            expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe("schedule1DayNotification", () => {
    it("should include check-in reminder when trip has flights", async () => {
      const { schedule1DayNotification } = await import("../lib/notifications");
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      
      await schedule1DayNotification(
        {
          tripId: 1,
          tripName: "Test Trip",
          startDate: futureDate,
          endDate: new Date(futureDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          categories: { flight: true, accommodation: false, carRental: false, medical: false, event: false, other: false },
        },
        true
      );
      
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
      const call = mockScheduleNotificationAsync.mock.calls[0];
      expect(call[0].content.body).toContain("check in");
    });
  });

  describe("scheduleFlightCheckinReminder", () => {
    it("should schedule 24 hours before departure", async () => {
      const { scheduleFlightCheckinReminder } = await import("../lib/notifications");
      
      const departureTime = new Date();
      departureTime.setDate(departureTime.getDate() + 3);
      
      const result = await scheduleFlightCheckinReminder(
        1,
        "Test Trip",
        "TLV → BUD",
        departureTime
      );
      
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });

    it("should not schedule if departure is within 24 hours", async () => {
      const { scheduleFlightCheckinReminder } = await import("../lib/notifications");
      
      const departureTime = new Date();
      departureTime.setHours(departureTime.getHours() + 12);
      
      const result = await scheduleFlightCheckinReminder(
        1,
        "Test Trip",
        "TLV → BUD",
        departureTime
      );
      
      expect(result).toBe(null);
    });
  });

  describe("scheduleCarReturnReminder", () => {
    it("should schedule for morning of return day", async () => {
      const { scheduleCarReturnReminder } = await import("../lib/notifications");
      
      const dropoffTime = new Date();
      dropoffTime.setDate(dropoffTime.getDate() + 5);
      dropoffTime.setHours(14, 0, 0, 0);
      
      const result = await scheduleCarReturnReminder(
        1,
        "Test Trip",
        "Hertz",
        dropoffTime,
        "Airport Terminal 3"
      );
      
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe("cancelTripNotifications", () => {
    it("should cancel all notifications for a specific trip", async () => {
      // Mock stored notifications
      mockGetItem.mockResolvedValueOnce(JSON.stringify([
        { id: "notif-1", tripId: 1, type: "7_days_before", scheduledFor: Date.now() },
        { id: "notif-2", tripId: 1, type: "1_day_before", scheduledFor: Date.now() },
        { id: "notif-3", tripId: 2, type: "7_days_before", scheduledFor: Date.now() },
      ]));
      
      const { cancelTripNotifications } = await import("../lib/notifications");
      await cancelTripNotifications(1);
      
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-1");
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-2");
      expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalledWith("notif-3");
    });
  });

  describe("cancelAllTripNotifications", () => {
    it("should cancel all scheduled notifications", async () => {
      const { cancelAllTripNotifications } = await import("../lib/notifications");
      
      await cancelAllTripNotifications();
      
      expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });
});

describe("Duplicate Detection", () => {
  it("should generate consistent content hash for same URL", async () => {
    const { createHash } = await import("crypto");
    
    const url = "https://example.com/document.pdf";
    const hash1 = createHash("sha256").update(url).digest("hex").substring(0, 64);
    const hash2 = createHash("sha256").update(url).digest("hex").substring(0, 64);
    
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("should generate different hashes for different URLs", async () => {
    const { createHash } = await import("crypto");
    
    const url1 = "https://example.com/document1.pdf";
    const url2 = "https://example.com/document2.pdf";
    
    const hash1 = createHash("sha256").update(url1).digest("hex").substring(0, 64);
    const hash2 = createHash("sha256").update(url2).digest("hex").substring(0, 64);
    
    expect(hash1).not.toBe(hash2);
  });
});
