import { useRouter, Redirect } from "expo-router";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  Platform,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { FontScaling } from "@/constants/accessibility";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/constants/oauth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.md * 2 - 40; // Leave space for peek
const CARD_SPACING = Spacing.sm;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { hasSeenOnboarding, loading: onboardingLoading } = useOnboarding();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleLogin = useCallback(async () => {
    try {
      console.log("[Auth] Login button clicked");
      setIsLoggingIn(true);
      const loginUrl = getLoginUrl();
      console.log("[Auth] Generated login URL:", loginUrl);

      if (Platform.OS === "web") {
        console.log("[Auth] Web platform: redirecting to OAuth...");
        window.location.href = loginUrl;
        return;
      }

      console.log("[Auth] Opening OAuth URL in browser...");
      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        undefined,
        {
          preferEphemeralSession: false,
          showInRecents: true,
        }
      );

      console.log("[Auth] WebBrowser result:", result);
      if (result.type === "success" && result.url) {
        try {
          const url = new URL(result.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");

          if (code && state) {
            router.push({
              pathname: "/oauth/callback" as any,
              params: { code, state },
            });
          }
        } catch (err) {
          console.error("[Auth] Failed to parse callback URL:", err);
        }
      }
    } catch (error) {
      console.error("[Auth] Login error:", error);
    } finally {
      setIsLoggingIn(false);
    }
  }, [router]);

  const { data: trips, isLoading: tripsLoading, refetch: refetchTrips } = trpc.trips.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  const { data: inboxData, refetch: refetchInbox } = trpc.documents.inboxCount.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  const { data: forwardingData } = trpc.user.getForwardingEmail.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Sort trips: upcoming first, then by start date
  const sortedTrips = useMemo(() => {
    if (!trips || trips.length === 0) return [];
    const now = new Date();
    return [...trips].sort((a, b) => {
      const aStart = new Date(a.startDate);
      const bStart = new Date(b.startDate);
      const aIsUpcoming = aStart >= now;
      const bIsUpcoming = bStart >= now;
      
      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;
      return aStart.getTime() - bStart.getTime();
    });
  }, [trips]);

  const getDaysUntilTrip = useCallback((startDate: string | Date) => {
    const now = new Date();
    const tripDate = new Date(startDate);
    const diffTime = tripDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  const handleCopyEmail = useCallback(async () => {
    if (forwardingData?.email) {
      await Clipboard.setStringAsync(forwardingData.email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [forwardingData?.email]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchTrips(), refetchInbox()]);
  }, [refetchTrips, refetchInbox]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
    setActiveIndex(index);
  }, []);

  const archiveMutation = trpc.trips.archive.useMutation({
    onSuccess: () => {
      refetchTrips();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteTripMutation = trpc.trips.delete.useMutation({
    onSuccess: () => {
      refetchTrips();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleTripLongPress = useCallback((trip: typeof sortedTrips[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      trip.name,
      "What would you like to do with this trip?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => archiveMutation.mutate({ id: trip.id }),
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
                  onPress: () => deleteTripMutation.mutate({ id: trip.id }),
                },
              ]
            );
          },
        },
      ]
    );
  }, [archiveMutation, deleteTripMutation]);

  const renderTripCard = useCallback(({ item: trip, index }: { item: typeof sortedTrips[0]; index: number }) => {
    const daysUntil = getDaysUntilTrip(trip.startDate);
    const isUpcoming = daysUntil > 0;
    const tripDuration = Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const isActive = daysUntil <= 0 && daysUntil > -tripDuration;
    
    return (
      <Pressable
        style={[
          styles.carouselCard,
          { 
            backgroundColor: colors.tint,
            width: CARD_WIDTH,
            marginLeft: index === 0 ? Spacing.md : CARD_SPACING / 2,
            marginRight: index === sortedTrips.length - 1 ? Spacing.md : CARD_SPACING / 2,
          }
        ]}
        onPress={() => router.push(`/trip/${trip.id}`)}
        onLongPress={() => handleTripLongPress(trip)}
        delayLongPress={500}
      >
        <View style={styles.tripCardHeader}>
          <ThemedText style={styles.tripCardLabel}>
            {isActive ? "ACTIVE TRIP" : isUpcoming ? "UPCOMING TRIP" : "PAST TRIP"}
          </ThemedText>
          {isUpcoming && daysUntil > 0 && (
            <View style={styles.countdownBadge}>
              <ThemedText style={styles.countdownText}>
                {daysUntil} day{daysUntil !== 1 ? "s" : ""} away
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText style={styles.tripName} maxFontSizeMultiplier={FontScaling.label}>{trip.name}</ThemedText>
        <ThemedText style={styles.tripDates} maxFontSizeMultiplier={FontScaling.badge}>
          {new Date(trip.startDate).toLocaleDateString()} -{" "}
          {new Date(trip.endDate).toLocaleDateString()}
        </ThemedText>
        <View style={styles.tripCardFooter}>
          <ThemedText style={styles.docCount} maxFontSizeMultiplier={FontScaling.badge}>
            {trip.documentCount} document{trip.documentCount !== 1 ? "s" : ""}
          </ThemedText>
          <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.8)" />
        </View>
      </Pressable>
    );
  }, [colors.tint, getDaysUntilTrip, router, sortedTrips.length]);

  // Show loading while checking auth and onboarding status
  if (authLoading || onboardingLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  // Redirect to onboarding for first-time users (before login)
  if (!isAuthenticated && hasSeenOnboarding === false) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.welcomeContainer}>
          <IconSymbol name="suitcase.fill" size={80} color={colors.tint} />
          <ThemedText type="title" style={styles.welcomeTitle}>
            Welcome to TripDocHub
          </ThemedText>
          <ThemedText style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            Organize all your travel documents in one place
          </ThemedText>
          <Pressable
            style={[styles.loginButton, { backgroundColor: colors.tint }, isLoggingIn && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.loginButtonText} maxFontSizeMultiplier={FontScaling.button}>Sign In to Get Started</ThemedText>
            )}
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20), paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl refreshing={tripsLoading} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title">
            Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your travel documents, organized
          </ThemedText>
        </View>

        {/* Forwarding Email Card */}
        {forwardingData?.email && (
          <Pressable
            style={[styles.emailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleCopyEmail}
          >
            <View style={styles.emailCardContent}>
              <IconSymbol name="envelope.fill" size={24} color={colors.tint} />
              <View style={styles.emailTextContainer}>
                <ThemedText style={[styles.emailLabel, { color: colors.textSecondary }]}>
                  Forward bookings to:
                </ThemedText>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.emailAddress}>
                  {forwardingData.email}
                </ThemedText>
              </View>
              <IconSymbol name="doc.on.clipboard" size={20} color={colors.textSecondary} />
            </View>
          </Pressable>
        )}

        {/* Trips Carousel */}
        {sortedTrips.length > 0 ? (
          <View style={styles.carouselContainer}>
            <View style={styles.carouselHeader}>
              <ThemedText type="subtitle">Your Trips</ThemedText>
              <ThemedText style={[styles.tripCount, { color: colors.textSecondary }]}>
                {activeIndex + 1} / {sortedTrips.length}
              </ThemedText>
            </View>
            <FlatList
              ref={flatListRef}
              data={sortedTrips}
              renderItem={renderTripCard}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              snapToAlignment="start"
              decelerationRate="fast"
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.carouselContent}
            />
            {/* Pagination Dots */}
            {sortedTrips.length > 1 && (
              <View style={styles.pagination}>
                {sortedTrips.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      {
                        backgroundColor: index === activeIndex ? colors.tint : colors.border,
                        width: index === activeIndex ? 20 : 8,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.emptyTripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="suitcase.fill" size={48} color={colors.textSecondary} />
            <ThemedText type="subtitle" style={{ marginTop: Spacing.md }}>
              No trips yet
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              Create your first trip to get started
            </ThemedText>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Quick Actions
          </ThemedText>
          <View style={styles.actionsGrid}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/add-trip")}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.tint + "15" }]}>
                <IconSymbol name="plus.circle.fill" size={28} color={colors.tint} />
              </View>
              <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.button}>New Trip</ThemedText>
            </Pressable>
            
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/upload")}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + "15" }]}>
                <IconSymbol name="doc.viewfinder" size={28} color={colors.success} />
              </View>
              <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.button}>Upload Doc</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Inbox Preview */}
        {inboxData && inboxData.count > 0 && (
          <Pressable
            style={[styles.inboxPreview, { backgroundColor: colors.warning + "15", borderColor: colors.warning }]}
            onPress={() => router.push("/(tabs)/inbox")}
          >
            <View style={styles.inboxContent}>
              <IconSymbol name="tray.fill" size={24} color={colors.warning} />
              <View style={styles.inboxTextContainer}>
                <ThemedText type="defaultSemiBold">
                  {inboxData.count} document{inboxData.count !== 1 ? "s" : ""} in inbox
                </ThemedText>
                <ThemedText style={[styles.inboxSubtext, { color: colors.textSecondary }]}>
                  Tap to assign to trips
                </ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.warning} />
          </Pressable>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: 16,
    lineHeight: 22,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  welcomeTitle: {
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  welcomeSubtitle: {
    marginTop: Spacing.sm,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  loginButton: {
    marginTop: Spacing.xl,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.md,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  emailCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  emailCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  emailTextContainer: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  emailAddress: {
    fontSize: 14,
    lineHeight: 20,
  },
  carouselContainer: {
    marginBottom: Spacing.lg,
  },
  carouselHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tripCount: {
    fontSize: 14,
    lineHeight: 20,
  },
  carouselContent: {
    paddingVertical: Spacing.xs,
  },
  carouselCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 140,
  },
  tripCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  tripCardLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  countdownBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countdownText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  tripName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 30,
  },
  tripDates: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
  },
  tripCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  docCount: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 18,
  },
  emptyTripCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.md,
  },
  emptyText: {
    marginTop: Spacing.xs,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
  actionsSection: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  inboxPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  inboxContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  inboxTextContainer: {
    gap: 2,
  },
  inboxSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
});
