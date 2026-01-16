import { useEffect, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  initializeNotifications,
  areNotificationsEnabled,
  setNotificationsEnabled,
  schedule7DayNotification,
  schedule1DayNotification,
  scheduleFlightCheckinReminder,
  scheduleCarReturnReminder,
  cancelTripNotifications,
  cancelAllTripNotifications,
  TripDocumentStatus,
} from "@/lib/notifications";
import type { DocumentDetails } from "@/drizzle/schema";

/**
 * Hook for managing trip notifications
 */
export function useNotifications() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [initialized, setInitialized] = useState(false);

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      const isEnabled = await areNotificationsEnabled();
      setEnabled(isEnabled);
      setInitialized(true);
    };
    loadState();
  }, []);

  // Toggle notifications
  const toggleNotifications = useCallback(async (value: boolean) => {
    await setNotificationsEnabled(value);
    setEnabled(value);
    
    if (value) {
      // Re-initialize when enabling
      await initializeNotifications();
    }
  }, []);

  return {
    enabled,
    initialized,
    toggleNotifications,
  };
}

/**
 * Hook for scheduling notifications when trips/documents change
 */
export function useScheduleTripNotifications() {
  const { data: trips } = trpc.trips.list.useQuery();

  // Schedule notifications for all upcoming trips
  const scheduleAllNotifications = useCallback(async () => {
    const isEnabled = await areNotificationsEnabled();
    if (!isEnabled || !trips) return;

    // Initialize notifications first
    const hasPermission = await initializeNotifications();
    if (!hasPermission) return;

    const now = new Date();

    for (const trip of trips) {
      // Skip archived trips
      if (trip.isArchived) continue;

      const startDate = new Date(trip.startDate);
      const endDate = new Date(trip.endDate);

      // Skip past trips
      if (endDate < now) continue;

      // Build document status for this trip
      const categories: Record<string, boolean> = {
        flight: false,
        accommodation: false,
        carRental: false,
        medical: false,
        event: false,
        other: false,
      };

      // Check if trip has documents in each category
      // This is a simplified check - in production you'd query documents
      if (trip.documentCount > 0) {
        // Mark at least one category as having documents
        // The actual implementation would check each category
        categories.other = true;
      }

      const status: TripDocumentStatus = {
        tripId: trip.id,
        tripName: trip.name,
        startDate,
        endDate,
        categories,
      };

      // Schedule pre-trip notifications
      await schedule7DayNotification(status);
      await schedule1DayNotification(status, categories.flight);
    }
  }, [trips]);

  // Schedule notifications when trips change
  useEffect(() => {
    scheduleAllNotifications();
  }, [scheduleAllNotifications]);

  return { scheduleAllNotifications };
}

/**
 * Schedule notifications for a specific trip with its documents
 */
export async function scheduleTripNotificationsWithDocuments(
  tripId: number,
  tripName: string,
  startDate: Date,
  endDate: Date,
  documents: Array<{
    category: string;
    documentType: string;
    details: DocumentDetails | null;
    documentDate: Date | null;
  }>
): Promise<void> {
  const isEnabled = await areNotificationsEnabled();
  if (!isEnabled) return;

  const hasPermission = await initializeNotifications();
  if (!hasPermission) return;

  // Cancel existing notifications for this trip first
  await cancelTripNotifications(tripId);

  // Build category status
  const categories: Record<string, boolean> = {
    flight: false,
    accommodation: false,
    carRental: false,
    medical: false,
    event: false,
    other: false,
  };

  for (const doc of documents) {
    if (doc.category in categories) {
      categories[doc.category] = true;
    }
  }

  const status: TripDocumentStatus = {
    tripId,
    tripName,
    startDate,
    endDate,
    categories,
  };

  // Schedule pre-trip notifications
  await schedule7DayNotification(status);
  await schedule1DayNotification(status, categories.flight);

  // Schedule flight check-in reminders
  const flights = documents.filter((d) => d.category === "flight");
  for (const flight of flights) {
    if (flight.details?.departureTime) {
      const departureTime = new Date(flight.details.departureTime);
      const flightTitle = flight.documentType || "your flight";
      await scheduleFlightCheckinReminder(tripId, tripName, flightTitle, departureTime);
    }
  }

  // Schedule car rental return reminders
  const carRentals = documents.filter((d) => d.category === "carRental");
  for (const rental of carRentals) {
    if (rental.details?.dropoffTime) {
      const dropoffTime = new Date(rental.details.dropoffTime);
      const carCompany = rental.details.carCompany || "rental car";
      const dropoffLocation = rental.details.dropoffLocation || "";
      await scheduleCarReturnReminder(tripId, tripName, carCompany, dropoffTime, dropoffLocation);
    }
  }
}
