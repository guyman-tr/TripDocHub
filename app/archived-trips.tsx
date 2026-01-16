import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { FontScaling } from "@/constants/accessibility";
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

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 160;

function SwipeableArchivedTripCard({ 
  trip, 
  onPress, 
  onRestore,
  onDelete,
}: { 
  trip: TripWithCount; 
  onPress: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const translateX = useSharedValue(0);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  const resetSwipe = () => {
    translateX.value = withSpring(0);
    setIsSwipeOpen(false);
  };

  const openSwipe = () => {
    translateX.value = withSpring(-ACTION_WIDTH);
    setIsSwipeOpen(true);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      const newValue = isSwipeOpen 
        ? Math.max(-ACTION_WIDTH, Math.min(0, event.translationX - ACTION_WIDTH))
        : Math.max(-ACTION_WIDTH, Math.min(0, event.translationX));
      translateX.value = newValue;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD && !isSwipeOpen) {
        runOnJS(openSwipe)();
      } else if (event.translationX > SWIPE_THRESHOLD && isSwipeOpen) {
        runOnJS(resetSwipe)();
      } else if (isSwipeOpen) {
        translateX.value = withSpring(-ACTION_WIDTH);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleRestore = () => {
    resetSwipe();
    onRestore();
  };

  const handleDelete = () => {
    resetSwipe();
    onDelete();
  };

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
      style={styles.swipeContainer}
    >
      {/* Action buttons behind the card */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.restoreButton]}
          onPress={handleRestore}
          activeOpacity={0.8}
        >
          <IconSymbol name="arrow.uturn.backward" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionText} maxFontSizeMultiplier={FontScaling.button}>
            Restore
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <IconSymbol name="trash.fill" size={20} color="#FFFFFF" />
          <ThemedText style={styles.actionText} maxFontSizeMultiplier={FontScaling.button}>
            Delete
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <Pressable
            style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={isSwipeOpen ? resetSwipe : onPress}
          >
            <View style={styles.tripCardContent}>
              <View style={styles.tripInfo}>
                <View style={styles.tripHeader}>
                  <ThemedText type="subtitle" numberOfLines={1} style={styles.tripName} maxFontSizeMultiplier={FontScaling.label}>
                    {trip.name}
                  </ThemedText>
                  <View style={[styles.statusBadge, { backgroundColor: colors.textSecondary + "20" }]}>
                    <ThemedText style={[styles.statusText, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.badge}>
                      Archived
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.tripMeta}>
                  <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.tripDates, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.badge}>
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </ThemedText>
                </View>
                <View style={styles.tripMeta}>
                  <IconSymbol name="doc.fill" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.docCount, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.badge}>
                    {trip.documentCount} document{trip.documentCount !== 1 ? "s" : ""}
                  </ThemedText>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default function ArchivedTripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { 
    data: archivedTrips, 
    isLoading, 
    refetch 
  } = trpc.trips.listArchived.useQuery(undefined, { enabled: isAuthenticated });

  const unarchiveMutation = trpc.trips.unarchive.useMutation({
    onSuccess: () => {
      refetch();
      utils.trips.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = trpc.trips.delete.useMutation({
    onSuccess: () => {
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleTripPress = useCallback((tripId: number) => {
    router.push(`/trip/${tripId}` as any);
  }, [router]);

  const handleRestore = useCallback((trip: TripWithCount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    unarchiveMutation.mutate({ id: trip.id });
  }, [unarchiveMutation]);

  const handleDelete = useCallback((trip: TripWithCount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Trip Forever",
      `Are you sure you want to permanently delete "${trip.name}"? This will also delete all ${trip.documentCount} associated document${trip.documentCount !== 1 ? "s" : ""}. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: trip.id }),
        },
      ]
    );
  }, [deleteMutation]);

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
          Please sign in to view archived trips
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.tint} />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText type="title">Archived Trips</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            Swipe left to restore or delete
          </ThemedText>
        </View>
      </View>

      {archivedTrips && archivedTrips.length > 0 ? (
        <FlatList
          data={archivedTrips}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <SwipeableArchivedTripCard
              trip={item}
              onPress={() => handleTripPress(item.id)}
              onRestore={() => handleRestore(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <IconSymbol name="archivebox.fill" size={64} color={colors.textSecondary} />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No archived trips
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            Trips you archive will appear here
          </ThemedText>
        </View>
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
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
    marginTop: 4,
  },
  headerContent: {
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
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
    width: ACTION_WIDTH,
  },
  actionButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  restoreButton: {
    backgroundColor: "#34C759", // Green for restore
  },
  deleteButton: {
    backgroundColor: "#FF3B30", // Red for delete
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
});
