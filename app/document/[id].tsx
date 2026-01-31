import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Modal,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius, CategoryColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import type { DocumentDetails } from "@/drizzle/schema";
import { FontScaling } from "@/constants/accessibility";

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  flight: { icon: "airplane", color: CategoryColors.flight, label: "Flight" },
  carRental: { icon: "car.fill", color: CategoryColors.carRental, label: "Car Rental" },
  accommodation: { icon: "bed.double.fill", color: CategoryColors.accommodation, label: "Accommodation" },
  medical: { icon: "cross.case.fill", color: CategoryColors.medical, label: "Medical Insurance" },
  event: { icon: "ticket.fill", color: CategoryColors.event, label: "Event" },
  other: { icon: "doc.fill", color: CategoryColors.other, label: "Document" },
};

// Action icon colors
const ACTION_COLORS = {
  navigate: "#34C759", // Green
  call: "#007AFF", // Blue
  email: "#AF52DE", // Purple
  disabled: "#C7C7CC", // Grey
};

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <ThemedText 
        style={[styles.detailLabel, { color: colors.textSecondary }]}
        maxFontSizeMultiplier={FontScaling.label}
      >
        {label}
      </ThemedText>
      <ThemedText 
        style={styles.detailValue}
        maxFontSizeMultiplier={FontScaling.body}
        numberOfLines={2}
      >
        {value}
      </ThemedText>
    </View>
  );
}

interface ActionIconProps {
  icon: any;
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}

function ActionIcon({ icon, label, color, disabled, onPress }: ActionIconProps) {
  const actualColor = disabled ? ACTION_COLORS.disabled : color;
  
  return (
    <Pressable 
      style={styles.actionIconContainer}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <View style={[styles.actionIconCircle, { borderColor: actualColor }]}>
        <IconSymbol name={icon} size={24} color={actualColor} />
      </View>
      <ThemedText 
        style={[styles.actionIconLabel, { color: actualColor }]}
        maxFontSizeMultiplier={FontScaling.label}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [originalModalVisible, setOriginalModalVisible] = useState(false);

  const documentId = parseInt(id || "0", 10);

  const { data: document, isLoading } = trpc.documents.get.useQuery(
    { id: documentId },
    { enabled: isAuthenticated && documentId > 0 }
  );

  const { data: trips } = trpc.trips.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const utils = trpc.useUtils();

  const assignMutation = trpc.documents.assign.useMutation({
    onSuccess: () => {
      utils.documents.get.invalidate({ id: documentId });
      utils.documents.inbox.invalidate();
      utils.documents.inboxCount.invalidate();
      utils.trips.list.invalidate();
      setReassignModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.inbox.invalidate();
      utils.documents.inboxCount.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  // Extract contact info from document details
  const contactInfo = useMemo(() => {
    if (!document) return { address: null, phone: null, email: null };
    
    const details = (document.details as DocumentDetails) || {};
    const category = document.category;
    
    // Get address based on category - check both *Address and *Location fields
    let address: string | null = null;
    if (category === "accommodation") {
      address = details.address || null;
    } else if (category === "carRental") {
      // Check both pickupAddress/dropoffAddress AND pickupLocation/dropoffLocation
      address = details.pickupAddress || details.dropoffAddress || 
                details.pickupLocation || details.dropoffLocation || null;
    } else if (category === "event") {
      address = details.venueAddress || details.venue || null;
    } else if (category === "flight") {
      address = details.arrivalAddress || details.departureAddress || 
                details.arrivalAirport || details.departureAirport || null;
    }
    
    // Get phone and email from details
    const phone = details.phoneNumber || null;
    const email = details.emailAddress || null;
    
    return { address, phone, email };
  }, [document]);

  // Check what original content is available
  const originalContent = useMemo(() => {
    if (!document) return { hasFile: false, hasEmailBody: false, type: 'none' as const };
    
    const hasFile = !!document.originalFileUrl;
    const hasEmailBody = !!(document as any).originalEmailBody;
    
    if (hasFile) return { hasFile: true, hasEmailBody, type: 'file' as const };
    if (hasEmailBody) return { hasFile: false, hasEmailBody: true, type: 'email' as const };
    return { hasFile: false, hasEmailBody: false, type: 'none' as const };
  }, [document]);

  const handleViewOriginal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (originalContent.type === 'file' && document?.originalFileUrl) {
      // Open file URL directly
      Linking.openURL(document.originalFileUrl);
    } else if (originalContent.type === 'email') {
      // Show email body in modal
      setOriginalModalVisible(true);
    }
  }, [document, originalContent]);

  const handleReassign = useCallback((tripId: number | null) => {
    assignMutation.mutate({ documentId, tripId });
  }, [documentId, assignMutation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Document",
      "Are you sure you want to delete this document? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: documentId }),
        },
      ]
    );
  }, [documentId, deleteMutation]);

  const handleOpenMaps = useCallback(() => {
    if (contactInfo.address) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const encodedAddress = encodeURIComponent(contactInfo.address);
      const url = `https://maps.google.com/?q=${encodedAddress}`;
      Linking.openURL(url);
    }
  }, [contactInfo.address]);

  const handleCall = useCallback(() => {
    if (contactInfo.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Clean phone number - remove spaces, dashes, etc.
      const cleanPhone = contactInfo.phone.replace(/[^\d+]/g, '');
      Linking.openURL(`tel:${cleanPhone}`);
    }
  }, [contactInfo.phone]);

  const handleEmail = useCallback(() => {
    if (contactInfo.email) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(`mailto:${contactInfo.email}`);
    }
  }, [contactInfo.email]);

  // Generate HTML for email body display
  const emailBodyHtml = useMemo(() => {
    if (!document || !(document as any).originalEmailBody) return '';
    
    const body = (document as any).originalEmailBody as string;
    const isDark = colorScheme === 'dark';
    
    // Check if it's already HTML
    const isHtml = body.trim().startsWith('<') || body.includes('<html') || body.includes('<body') || body.includes('<div');
    
    if (isHtml) {
      // Wrap existing HTML with responsive styling
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.5;
              padding: 16px;
              margin: 0;
              background-color: ${isDark ? '#151718' : '#ffffff'};
              color: ${isDark ? '#ECEDEE' : '#11181C'};
            }
            img { max-width: 100%; height: auto; }
            table { max-width: 100%; }
            a { color: ${isDark ? '#0a7ea4' : '#007AFF'}; }
          </style>
        </head>
        <body>
          ${body}
        </body>
        </html>
      `;
    } else {
      // Convert plain text to formatted HTML
      const escapedBody = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 16px;
              margin: 0;
              background-color: ${isDark ? '#151718' : '#ffffff'};
              color: ${isDark ? '#ECEDEE' : '#11181C'};
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          ${escapedBody}
        </body>
        </html>
      `;
    }
  }, [document, colorScheme]);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!document) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText style={{ color: colors.textSecondary }}>Document not found</ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const config = categoryConfig[document.category] || categoryConfig.other;
  const details = (document.details as DocumentDetails) || {};

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="subtitle">Document Details</ThemedText>
        <Pressable onPress={handleDelete} style={styles.headerButton}>
          <IconSymbol name="trash.fill" size={22} color={colors.destructive} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: config.color + "20" }]}>
          <IconSymbol name={config.icon} size={24} color={config.color} />
          <ThemedText 
            style={[styles.categoryLabel, { color: config.color }]}
            maxFontSizeMultiplier={FontScaling.badge}
          >
            {config.label}
          </ThemedText>
        </View>

        {/* Title Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText 
            type="title" 
            style={styles.documentTitle}
            maxFontSizeMultiplier={FontScaling.title}
          >
            {document.title}
          </ThemedText>
          {document.subtitle && (
            <ThemedText 
              style={[styles.documentSubtitle, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.body}
            >
              {document.subtitle}
            </ThemedText>
          )}
          <View style={styles.typeBadge}>
            <ThemedText 
              style={[styles.typeText, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.badge}
            >
              {document.documentType}
            </ThemedText>
          </View>
        </View>

        {/* 3 Action Icons Row - always visible, greyed out when no data */}
        <View style={[styles.actionIconsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActionIcon
            icon="location.fill"
            label="Navigate"
            color={ACTION_COLORS.navigate}
            disabled={!contactInfo.address}
            onPress={handleOpenMaps}
          />
          <ActionIcon
            icon="phone.fill"
            label="Call"
            color={ACTION_COLORS.call}
            disabled={!contactInfo.phone}
            onPress={handleCall}
          />
          <ActionIcon
            icon="envelope.fill"
            label="Email"
            color={ACTION_COLORS.email}
            disabled={!contactInfo.email}
            onPress={handleEmail}
          />
        </View>

        {/* Details Card */}
        {Object.keys(details).length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Details
            </ThemedText>
            <DetailRow label="Confirmation #" value={details.confirmationNumber} />
            <DetailRow label="Airline" value={details.airline} />
            <DetailRow label="Flight Number" value={details.flightNumber} />
            <DetailRow label="Departure" value={details.departureAirport} />
            <DetailRow label="Arrival" value={details.arrivalAirport} />
            <DetailRow label="Departure Time" value={details.departureTime} />
            <DetailRow label="Arrival Time" value={details.arrivalTime} />
            <DetailRow label="Seat" value={details.seatNumber} />
            <DetailRow label="Terminal" value={details.terminal} />
            <DetailRow label="Gate" value={details.gate} />
            <DetailRow label="Hotel" value={details.hotelName} />
            <DetailRow label="Check-in" value={details.checkInDate} />
            <DetailRow label="Check-out" value={details.checkOutDate} />
            <DetailRow label="Room Type" value={details.roomType} />
            <DetailRow label="Address" value={details.address} />
            <DetailRow label="Car Company" value={details.carCompany} />
            <DetailRow label="Pickup Location" value={details.pickupLocation} />
            <DetailRow label="Dropoff Location" value={details.dropoffLocation} />
            <DetailRow label="Pickup Time" value={details.pickupTime} />
            <DetailRow label="Dropoff Time" value={details.dropoffTime} />
            <DetailRow label="Vehicle Type" value={details.vehicleType} />
            <DetailRow label="Insurance Provider" value={details.insuranceProvider} />
            <DetailRow label="Policy Number" value={details.policyNumber} />
            <DetailRow label="Coverage Period" value={details.coveragePeriod} />
            <DetailRow label="Event" value={details.eventName} />
            <DetailRow label="Event Date" value={details.eventDate} />
            <DetailRow label="Event Time" value={details.eventTime} />
            <DetailRow label="Venue" value={details.venue} />
            <DetailRow label="Phone" value={details.phoneNumber} />
            <DetailRow label="Email" value={details.emailAddress} />
          </View>
        )}

        {/* Reassign Button */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setReassignModalVisible(true)}
          >
            <IconSymbol name="arrow.right.arrow.left" size={20} color={colors.tint} />
            <ThemedText style={[styles.actionButtonText, { color: colors.tint }]} maxFontSizeMultiplier={FontScaling.button}>
              Reassign to Trip
            </ThemedText>
          </Pressable>
        </View>

        {/* Metadata */}
        <View style={[styles.metadata, { borderColor: colors.border }]}>
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaLabel, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.label}>
              Source
            </ThemedText>
            <ThemedText style={[styles.metaValue, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.body}>
              {document.source === "email" ? "Email Forwarding" : document.source === "camera" ? "Camera" : "Upload"}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaLabel, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.label}>
              Added
            </ThemedText>
            <ThemedText style={[styles.metaValue, { color: colors.textSecondary }]} maxFontSizeMultiplier={FontScaling.body}>
              {new Date(document.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* View Original Document Button - Always visible at bottom */}
      <View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background }]}>
        <Pressable
          style={[styles.viewOriginalButton, { backgroundColor: originalContent.type !== 'none' ? colors.tint : ACTION_COLORS.disabled }]}
          onPress={originalContent.type !== 'none' ? handleViewOriginal : undefined}
          disabled={originalContent.type === 'none'}
        >
          <IconSymbol name="doc.fill" size={20} color="#FFFFFF" />
          <ThemedText style={styles.viewOriginalButtonText} maxFontSizeMultiplier={FontScaling.button}>
            {originalContent.type === 'none' ? 'No Original Available' : 'View Original Document'}
          </ThemedText>
        </Pressable>
      </View>

      {/* Reassign Modal */}
      <Modal
        visible={reassignModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReassignModalVisible(false)}
      >
        <ThemedView style={[styles.modalContainer, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">Reassign Document</ThemedText>
            <Pressable onPress={() => setReassignModalVisible(false)} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.tripsList}>
            {/* Move to Inbox option */}
            <Pressable
              style={[styles.tripOption, { borderColor: colors.border }]}
              onPress={() => handleReassign(null)}
            >
              <View style={[styles.tripIcon, { backgroundColor: colors.warning + "20" }]}>
                <IconSymbol name="tray.fill" size={20} color={colors.warning} />
              </View>
              <ThemedText type="defaultSemiBold">Move to Inbox</ThemedText>
            </Pressable>

            {trips?.map((trip) => (
              <Pressable
                key={trip.id}
                style={[styles.tripOption, { borderColor: colors.border }]}
                onPress={() => handleReassign(trip.id)}
              >
                <View style={[styles.tripIcon, { backgroundColor: colors.tint + "20" }]}>
                  <IconSymbol name="suitcase.fill" size={20} color={colors.tint} />
                </View>
                <View style={styles.tripOptionInfo}>
                  <ThemedText type="defaultSemiBold">{trip.name}</ThemedText>
                  <ThemedText style={[styles.tripOptionDates, { color: colors.textSecondary }]}>
                    {new Date(trip.startDate).toLocaleDateString()} -{" "}
                    {new Date(trip.endDate).toLocaleDateString()}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Original Email Body Modal */}
      <Modal
        visible={originalModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOriginalModalVisible(false)}
      >
        <ThemedView style={[styles.modalContainer, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">Original Email</ThemedText>
            <Pressable onPress={() => setOriginalModalVisible(false)} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </Pressable>
          </View>

          <WebView
            source={{ html: emailBodyHtml }}
            style={styles.webView}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            originWhitelist={['*']}
          />
        </ThemedView>
      </Modal>
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
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  documentTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  documentSubtitle: {
    fontSize: 16,
    marginTop: Spacing.xs,
    lineHeight: 22,
  },
  typeBadge: {
    marginTop: Spacing.sm,
  },
  typeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  detailLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "right",
    flex: 1,
    marginLeft: Spacing.md,
  },
  // 3 Action Icons Row
  actionIconsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionIconContainer: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconLabel: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  actionsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  metadata: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  metaLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaValue: {
    fontSize: 13,
    lineHeight: 18,
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
  // Bottom fixed button
  bottomButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  viewOriginalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
  },
  viewOriginalButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
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
  tripsList: {
    paddingHorizontal: Spacing.md,
  },
  tripOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  tripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tripOptionInfo: {
    flex: 1,
    gap: 2,
  },
  tripOptionDates: {
    fontSize: 13,
    lineHeight: 18,
  },
  webView: {
    flex: 1,
  },
});
