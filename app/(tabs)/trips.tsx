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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius, CategoryColors } from "@/constants/theme";
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

function TripCard({ trip, onPress, onDelete }: { 
  trip: TripWithCount; 
  onPress: () => void;
  onDelete: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  const now = new Date();
  
  const isUpcoming = startDate > now;
  const isOngoing = startDate <= now && endDate >= now;
  const isPast = endDate < now;

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Trip",
      `Are you sure you want to delete "${trip.name}"? Documents will be moved to your inbox.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]
    );
  };

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
    >
      <Pressable
        style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        onLongPress={handleLongPress}
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
      </Pressable>
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

  const handleDeleteTrip = useCallback((tripId: number) => {
    deleteMutation.mutate({ id: tripId });
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
          Please sign in to view your trips
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">Trips</ThemedText>
      </View>

      {trips && trips.length > 0 ? (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={() => handleTripPress(item.id)}
              onDelete={() => handleDeleteTrip(item.id)}
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
        <EmptyState onCreateTrip={handleCreateTrip} />
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
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
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
