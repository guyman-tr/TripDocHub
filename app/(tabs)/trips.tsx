import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { 
  FadeIn, 
  FadeOut, 
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type TripWithCount = {
  id: number;
  userId: number;
  name: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
};

const ACTION_WIDTH = 80;
const SWIPE_THRESHOLD = 40;

function SwipeableTripCard({ 
  trip, 
  onPress, 
  onArchive,
  onDelete,
}: { 
  trip: TripWithCount; 
  onPress: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const translateX = useSharedValue(0);
  
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  const now = new Date();
  
  const isUpcoming = startDate > now;
  const isOngoing = startDate <= now && endDate >= now;
  const isPast = endDate < now;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // Only allow swiping left (negative values)
      const newValue = Math.min(0, Math.max(-ACTION_WIDTH * 2, event.translationX));
      translateX.value = newValue;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD) {
        // Snap to show actions
        translateX.value = withSpring(-ACTION_WIDTH * 2, { damping: 20 });
        runOnJS(triggerHaptic)();
      } else {
        // Snap back to closed
        translateX.value = withSpring(0, { damping: 20 });
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (translateX.value < -10) {
        // If swiped open, close it
        translateX.value = withSpring(0, { damping: 20 });
      } else {
        // Otherwise, navigate
        runOnJS(onPress)();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(triggerHaptic)();
      runOnJS(onArchive)();
    });

  const composedGesture = Gesture.Race(
    panGesture,
    Gesture.Simultaneous(tapGesture, longPressGesture)
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleArchivePress = () => {
    translateX.value = withSpring(0, { damping: 20 });
    onArchive();
  };

  const handleDeletePress = () => {
    translateX.value = withSpring(0, { damping: 20 });
    onDelete();
  };

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
      style={styles.swipeContainer}
    >
      {/* Background actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.archiveAction]}
          onPress={handleArchivePress}
          activeOpacity={0.8}
        >
          <IconSymbol name="archivebox.fill" size={22} color="#FFFFFF" />
          <ThemedText style={styles.actionText}>Archive</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteAction]}
          onPress={handleDeletePress}
          activeOpacity={0.8}
        >
          <IconSymbol name="trash.fill" size={22} color="#FFFFFF" />
          <ThemedText style={styles.actionText}>Delete</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Swipeable card */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View 
          style={[
            styles.tripCard, 
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardStyle
          ]}
        >
          <View style={styles.tripCardContent}>
            <View style={styles.tripInfo}>
              <View style={styles.tripHeader}>
                <ThemedText type="subtitle" numberOfLines={1} style={styles.tripName}>
                  {trip.name}
                </ThemedText>
                {isUpcoming && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.tint + "20" }]}>
                    <ThemedText style={[styles.statusText, { color: colors.tint }]}>
                      Upcoming
                    </ThemedText>
                  </View>
                )}
                {isOngoing && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.success + "20" }]}>
                    <ThemedText style={[styles.statusText, { color: colors.success }]}>
                      Ongoing
                    </ThemedText>
                  </View>
                )}
                {isPast && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.textSecondary + "20" }]}>
                    <ThemedText style={[styles.statusText, { color: colors.textSecondary }]}>
                      Past
                    </ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.tripMeta}>
                <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.tripDates, { color: colors.textSecondary }]}>
                  {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                </ThemedText>
              </View>
              <View style={styles.tripMeta}>
                <IconSymbol name="doc.fill" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.docCount, { color: colors.textSecondary }]}>
                  {trip.documentCount} document{trip.documentCount !== 1 ? "s" : ""}
                </ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function EmptyState({ onCreateTrip }: { onCreateTrip: () => void }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <View style={styles.emptyContainer}>
      <IconSymbol name="suitcase.fill" size={64} color={colors.textSecondary} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        No trips yet
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
        Create your first trip to start organizing your travel documents
      </ThemedText>
      <Pressable
        style={[styles.createButton, { backgroundColor: colors.tint }]}
        onPress={onCreateTrip}
      >
        <IconSymbol name="plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.createButtonText}>Create Trip</ThemedText>
      </Pressable>
    </View>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { 
    data: trips, 
    isLoading, 
    refetch 
  } = trpc.trips.list.useQuery(undefined, { enabled: isAuthenticated });

  const { data: archivedTrips } = trpc.trips.listArchived.useQuery(undefined, { 
    enabled: isAuthenticated 
  });

  const archiveMutation = trpc.trips.archive.useMutation({
    onSuccess: () => {
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = trpc.trips.delete.useMutation({
    onSuccess: () => {
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCreateTrip = useCallback(() => {
    router.push("/add-trip" as any);
  }, [router]);

  const handleTripPress = useCallback((tripId: number) => {
    router.push(`/trip/${tripId}` as any);
  }, [router]);

  const handleArchiveTrip = useCallback((trip: TripWithCount) => {
    Alert.alert(
      "Archive Trip",
      `Archive "${trip.name}"? You can restore it later from the archived trips.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => archiveMutation.mutate({ id: trip.id }),
        },
      ]
    );
  }, [archiveMutation]);

  const handleDeleteTrip = useCallback((trip: TripWithCount) => {
    Alert.alert(
      "Delete Trip",
      `Are you sure you want to delete "${trip.name}"? This will also delete all ${trip.documentCount} associated document${trip.documentCount !== 1 ? "s" : ""}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: trip.id }),
        },
      ]
    );
  }, [deleteMutation]);

  const handleViewArchive = useCallback(() => {
    router.push("/archived-trips" as any);
  }, [router]);

  if (authLoading || isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText style={{ color: colors.textSecondary }}>
          Please sign in to view your trips
        </ThemedText>
      </ThemedView>
    );
  }

  const archivedCount = archivedTrips?.length || 0;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Trips</ThemedText>
          {archivedCount > 0 && (
            <TouchableOpacity
              style={[styles.archiveHeaderButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleViewArchive}
              activeOpacity={0.7}
            >
              <IconSymbol name="archivebox.fill" size={16} color={colors.textSecondary} />
              <ThemedText style={[styles.archiveHeaderText, { color: colors.textSecondary }]}>
                {archivedCount}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Archived Trips Banner - Always visible when there are archived trips */}
      {archivedCount > 0 && (
        <TouchableOpacity
          style={[styles.archiveBanner, { backgroundColor: "#FF9500" + "15", borderColor: "#FF9500" + "40" }]}
          onPress={handleViewArchive}
          activeOpacity={0.7}
        >
          <View style={styles.archiveBannerContent}>
            <IconSymbol name="archivebox.fill" size={20} color="#FF9500" />
            <View style={styles.archiveBannerText}>
              <ThemedText style={[styles.archiveBannerTitle, { color: "#FF9500" }]}>
                {archivedCount} Archived Trip{archivedCount !== 1 ? "s" : ""}
              </ThemedText>
              <ThemedText style={[styles.archiveBannerSubtitle, { color: colors.textSecondary }]}>
                Tap to view and restore
              </ThemedText>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={20} color="#FF9500" />
        </TouchableOpacity>
      )}

      {trips && trips.length > 0 ? (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <SwipeableTripCard
              trip={item}
              onPress={() => handleTripPress(item.id)}
              onArchive={() => handleArchiveTrip(item)}
              onDelete={() => handleDeleteTrip(item)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyWrapper}>
          <EmptyState onCreateTrip={handleCreateTrip} />
          {archivedCount > 0 && (
            <TouchableOpacity
              style={[styles.archiveButton, styles.archiveButtonEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleViewArchive}
              activeOpacity={0.7}
            >
              <IconSymbol name="archivebox.fill" size={20} color={colors.textSecondary} />
              <ThemedText style={[styles.archiveButtonText, { color: colors.textSecondary }]}>
                View Archived Trips ({archivedCount})
              </ThemedText>
              <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Floating Action Button */}
      {trips && trips.length > 0 && (
        <Pressable
          style={[
            styles.fab,
            { 
              backgroundColor: colors.tint,
              bottom: insets.bottom + 16,
            },
          ]}
          onPress={handleCreateTrip}
        >
          <IconSymbol name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  archiveHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  archiveHeaderText: {
    fontSize: 14,
    fontWeight: "600",
  },
  archiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  archiveBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  archiveBannerText: {
    gap: 2,
  },
  archiveBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  archiveBannerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  swipeContainer: {
    overflow: "hidden",
    borderRadius: BorderRadius.md,
  },
  actionsContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  actionButton: {
    width: ACTION_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  archiveAction: {
    backgroundColor: "#FF9500",
  },
  deleteAction: {
    backgroundColor: "#FF3B30",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  tripCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  tripCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tripName: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  tripMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripDates: {
    fontSize: 13,
    lineHeight: 18,
  },
  docCount: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyWrapper: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptyText: {
    marginTop: Spacing.xs,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  archiveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  archiveButtonEmpty: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  archiveButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
