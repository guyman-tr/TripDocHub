import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  SectionList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius, CategoryColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import type { Document } from "@/drizzle/schema";
import { useState } from "react";

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  flight: { icon: "airplane", color: CategoryColors.flight, label: "Flights" },
  carRental: { icon: "car.fill", color: CategoryColors.carRental, label: "Car Rentals" },
  accommodation: { icon: "bed.double.fill", color: CategoryColors.accommodation, label: "Accommodations" },
  medical: { icon: "cross.case.fill", color: CategoryColors.medical, label: "Medical Insurance" },
  event: { icon: "ticket.fill", color: CategoryColors.event, label: "Events" },
  other: { icon: "doc.fill", color: CategoryColors.other, label: "Other" },
};

function CollapsibleSection({
  title,
  icon,
  color,
  documents,
  onDocumentPress,
}: {
  title: string;
  icon: any;
  color: string;
  documents: Document[];
  onDocumentPress: (doc: Document) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [expanded, setExpanded] = useState(true);
  const rotation = useSharedValue(expanded ? 1 : 0);

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rotation.value = withTiming(expanded ? 0 : 1, { duration: 200 });
    setExpanded(!expanded);
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  return (
    <View style={styles.section}>
      <Pressable
        style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
        onPress={toggleExpanded}
      >
        <View style={[styles.sectionIcon, { backgroundColor: color + "20" }]}>
          <IconSymbol name={icon} size={20} color={color} />
        </View>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <View style={styles.sectionBadge}>
          <ThemedText style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {documents.length}
          </ThemedText>
        </View>
        <Animated.View style={chevronStyle}>
          <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)}>
          {documents.map((doc) => (
            <Pressable
              key={doc.id}
              style={[styles.documentItem, { borderColor: colors.border }]}
              onPress={() => onDocumentPress(doc)}
            >
              <View style={styles.documentInfo}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {doc.title}
                </ThemedText>
                {doc.subtitle && (
                  <ThemedText
                    style={[styles.documentSubtitle, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {doc.subtitle}
                  </ThemedText>
                )}
                <ThemedText style={[styles.documentType, { color: colors.textSecondary }]}>
                  {doc.documentType}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <View style={styles.emptyContainer}>
      <IconSymbol name="folder.fill" size={64} color={colors.textSecondary} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        No documents yet
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
        Upload documents or forward booking confirmations to add them to this trip
      </ThemedText>
      <Pressable
        style={[styles.uploadButton, { backgroundColor: colors.tint }]}
        onPress={onUpload}
      >
        <IconSymbol name="plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.uploadButtonText}>Add Document</ThemedText>
      </Pressable>
    </View>
  );
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated } = useAuth();

  const tripId = parseInt(id || "0", 10);

  const { data: trip, isLoading: tripLoading } = trpc.trips.get.useQuery(
    { id: tripId },
    { enabled: isAuthenticated && tripId > 0 }
  );

  const {
    data: documents,
    isLoading: docsLoading,
    refetch,
  } = trpc.documents.byTrip.useQuery(
    { tripId },
    { enabled: isAuthenticated && tripId > 0 }
  );

  const groupedDocuments = useMemo(() => {
    if (!documents) return [];

    const groups: Record<string, Document[]> = {};
    for (const doc of documents) {
      const category = doc.category || "other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(doc);
    }

    // Sort by category order
    const categoryOrder = ["flight", "accommodation", "carRental", "medical", "event", "other"];
    return categoryOrder
      .filter((cat) => groups[cat] && groups[cat].length > 0)
      .map((cat) => ({
        category: cat,
        ...categoryConfig[cat],
        documents: groups[cat],
      }));
  }, [documents]);

  const handleDocumentPress = useCallback(
    (doc: Document) => {
      router.push(`/document/${doc.id}` as any);
    },
    [router]
  );

  const handleUpload = useCallback(() => {
    router.push("/upload" as any);
  }, [router]);

  if (tripLoading || docsLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!trip) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText style={{ color: colors.textSecondary }}>Trip not found</ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 20), backgroundColor: colors.tint },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {trip.name}
          </ThemedText>
          <ThemedText style={styles.headerDates}>
            {new Date(trip.startDate).toLocaleDateString()} -{" "}
            {new Date(trip.endDate).toLocaleDateString()}
          </ThemedText>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {groupedDocuments.length > 0 ? (
        <FlatList
          data={groupedDocuments}
          keyExtractor={(item) => item.category}
          renderItem={({ item }) => (
            <CollapsibleSection
              title={item.label}
              icon={item.icon}
              color={item.color}
              documents={item.documents}
              onDocumentPress={handleDocumentPress}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          refreshControl={
            <RefreshControl refreshing={docsLoading} onRefresh={refetch} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState onUpload={handleUpload} />
      )}

      {/* FAB */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: colors.tint,
            bottom: insets.bottom + 16,
          },
        ]}
        onPress={handleUpload}
      >
        <IconSymbol name="plus" size={28} color="#FFFFFF" />
      </Pressable>
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
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
  headerDates: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 18,
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    flex: 1,
  },
  sectionBadge: {
    marginRight: Spacing.xs,
  },
  sectionCount: {
    fontSize: 14,
    lineHeight: 18,
  },
  documentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginLeft: Spacing.xl + Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  documentInfo: {
    flex: 1,
    gap: 2,
  },
  documentSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  documentType: {
    fontSize: 12,
    lineHeight: 16,
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
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  backButton: {
    marginTop: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
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
