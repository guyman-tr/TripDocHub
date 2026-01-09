import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  RefreshControl,
  Modal,
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
import type { Document } from "@/drizzle/schema";

const categoryIconMap: Record<string, any> = {
  flight: "airplane",
  carRental: "car.fill",
  accommodation: "bed.double.fill",
  medical: "cross.case.fill",
  event: "ticket.fill",
  other: "doc.fill",
};

const categoryColorMap: Record<string, string> = {
  flight: CategoryColors.flight,
  carRental: CategoryColors.carRental,
  accommodation: CategoryColors.accommodation,
  medical: CategoryColors.medical,
  event: CategoryColors.event,
  other: CategoryColors.other,
};

function DocumentCard({ 
  document, 
  onPress, 
  onAssign,
  onDelete,
}: { 
  document: Document; 
  onPress: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const categoryColor = categoryColorMap[document.category] || CategoryColors.other;
  const categoryIcon = categoryIconMap[document.category] || "doc.fill";

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={Layout.springify()}
    >
      <Pressable
        style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
      >
        <View style={[styles.categoryIcon, { backgroundColor: categoryColor + "20" }]}>
          <IconSymbol name={categoryIcon} size={24} color={categoryColor} />
        </View>
        <View style={styles.docInfo}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>
            {document.title}
          </ThemedText>
          {document.subtitle && (
            <ThemedText 
              style={[styles.docSubtitle, { color: colors.textSecondary }]} 
              numberOfLines={1}
            >
              {document.subtitle}
            </ThemedText>
          )}
          <View style={styles.docMeta}>
            <ThemedText style={[styles.docType, { color: colors.textSecondary }]}>
              {document.documentType}
            </ThemedText>
            {!document.isRead && (
              <View style={[styles.unreadDot, { backgroundColor: colors.tint }]} />
            )}
          </View>
        </View>
        <Pressable
          style={[styles.assignButton, { backgroundColor: colors.tint }]}
          onPress={(e) => {
            e.stopPropagation();
            onAssign();
          }}
        >
          <ThemedText style={styles.assignButtonText}>Assign</ThemedText>
        </Pressable>
        <Pressable
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          hitSlop={8}
        >
          <IconSymbol name="trash.fill" size={20} color={colors.destructive} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function AssignModal({
  visible,
  document,
  onClose,
  onAssign,
}: {
  visible: boolean;
  document: Document | null;
  onClose: () => void;
  onAssign: (tripId: number) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: trips, isLoading } = trpc.trips.list.useQuery();

  if (!document) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.modalContainer, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.modalHeader}>
          <ThemedText type="subtitle">Assign to Trip</ThemedText>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.docPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText type="defaultSemiBold">{document.title}</ThemedText>
          {document.subtitle && (
            <ThemedText style={{ color: colors.textSecondary }}>{document.subtitle}</ThemedText>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.tint} />
        ) : trips && trips.length > 0 ? (
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.tripOption, { borderColor: colors.border }]}
                onPress={() => onAssign(item.id)}
              >
                <View style={styles.tripOptionInfo}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  <ThemedText style={[styles.tripOptionDates, { color: colors.textSecondary }]}>
                    {new Date(item.startDate).toLocaleDateString()} -{" "}
                    {new Date(item.endDate).toLocaleDateString()}
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
            contentContainerStyle={styles.tripsList}
          />
        ) : (
          <View style={styles.noTripsContainer}>
            <ThemedText style={{ color: colors.textSecondary }}>
              No trips available. Create a trip first.
            </ThemedText>
            <Pressable
              style={[styles.createTripButton, { backgroundColor: colors.tint }]}
              onPress={() => {
                onClose();
                router.push("/add-trip" as any);
              }}
            >
              <IconSymbol name="plus" size={20} color="#FFFFFF" />
              <ThemedText style={styles.createTripButtonText}>Create Trip</ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>
    </Modal>
  );
}

function EmptyState() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <View style={styles.emptyContainer}>
      <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        All caught up!
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
        No documents waiting to be assigned. Forward booking confirmations to your inbox email.
      </ThemedText>
    </View>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const { 
    data: documents, 
    isLoading, 
    refetch 
  } = trpc.documents.inbox.useQuery(undefined, { enabled: isAuthenticated });

  const assignMutation = trpc.documents.assign.useMutation({
    onSuccess: () => {
      refetch();
      setAssignModalVisible(false);
      setSelectedDocument(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleDeletePress = useCallback((document: Document) => {
    Alert.alert(
      "Delete Document",
      `Are you sure you want to delete "${document.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: document.id }),
        },
      ]
    );
  }, [deleteMutation]);

  const clearInboxMutation = trpc.documents.clearInbox.useMutation({
    onSuccess: () => {
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleClearAll = useCallback(() => {
    const count = documents?.length || 0;
    Alert.alert(
      "Clear Inbox",
      `Are you sure you want to delete all ${count} document${count !== 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => clearInboxMutation.mutate(),
        },
      ]
    );
  }, [clearInboxMutation, documents?.length]);

  const handleDocumentPress = useCallback((document: Document) => {
    router.push(`/document/${document.id}` as any);
  }, [router]);

  const handleAssignPress = useCallback((document: Document) => {
    setSelectedDocument(document);
    setAssignModalVisible(true);
  }, []);

  const handleAssign = useCallback((tripId: number) => {
    if (selectedDocument) {
      assignMutation.mutate({ documentId: selectedDocument.id, tripId });
    }
  }, [selectedDocument, assignMutation]);

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
          Please sign in to view your inbox
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Inbox</ThemedText>
          {documents && documents.length > 0 && (
            <Pressable
              style={styles.clearAllButton}
              onPress={handleClearAll}
              disabled={clearInboxMutation.isPending}
            >
              <IconSymbol name="trash.fill" size={18} color={colors.destructive} />
              <ThemedText style={[styles.clearAllText, { color: colors.destructive }]}>
                Clear All
              </ThemedText>
            </Pressable>
          )}
        </View>
        {documents && documents.length > 0 && (
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {documents.length} document{documents.length !== 1 ? "s" : ""} to assign
          </ThemedText>
        )}
      </View>

      {documents && documents.length > 0 ? (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <DocumentCard
              document={item}
              onPress={() => handleDocumentPress(item)}
              onAssign={() => handleAssignPress(item)}
              onDelete={() => handleDeletePress(item)}
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
        <EmptyState />
      )}

      <AssignModal
        visible={assignModalVisible}
        document={selectedDocument}
        onClose={() => {
          setAssignModalVisible(false);
          setSelectedDocument(null);
        }}
        onAssign={handleAssign}
      />
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
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerSubtitle: {
    marginTop: Spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  docInfo: {
    flex: 1,
    gap: 2,
  },
  docSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  docMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  docType: {
    fontSize: 12,
    lineHeight: 16,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  assignButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
  },
  assignButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  docPreview: {
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  loader: {
    marginTop: Spacing.xl,
  },
  tripsList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  tripOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  tripOptionInfo: {
    flex: 1,
    gap: 2,
  },
  tripOptionDates: {
    fontSize: 13,
    lineHeight: 18,
  },
  noTripsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  createTripButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
  },
  createTripButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
});
