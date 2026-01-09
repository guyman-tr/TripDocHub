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

function ArchivedTripCard({ 
  trip, 
  onPress, 
  onLongPress,
}: { 
  trip: TripWithCount; 
  onPress: () => void;
  onLongPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
    >
      <Pressable
        style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={500}
      >
        <View style={styles.tripCardContent}>
          <View style={styles.tripInfo}>
            <View style={styles.tripHeader}>
              <ThemedText type="subtitle" numberOfLines={1} style={styles.tripName}>
                {trip.name}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: colors.textSecondary + "20" }]}>
                <ThemedText style={[styles.statusText, { color: colors.textSecondary }]}>
                  Archived
                </ThemedText>
              </View>
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

  const handleTripLongPress = useCallback((trip: TripWithCount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      trip.name,
      "What would you like to do with this trip?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unarchive",
          onPress: () => unarchiveMutation.mutate({ id: trip.id }),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
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
          },
        },
      ]
    );
  }, [unarchiveMutation, deleteMutation]);

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
            Long press to unarchive or delete
          </ThemedText>
        </View>
      </View>

      {archivedTrips && archivedTrips.length > 0 ? (
        <FlatList
          data={archivedTrips}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ArchivedTripCard
              trip={item}
              onPress={() => handleTripPress(item.id)}
              onLongPress={() => handleTripLongPress(item)}
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
