import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/constants/oauth";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, isAuthenticated, loading: authLoading, refresh: refreshAuth } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = useCallback(async () => {
    try {
      console.log("[Auth] Login button clicked");
      setIsLoggingIn(true);
      const loginUrl = getLoginUrl();
      console.log("[Auth] Generated login URL:", loginUrl);

      if (Platform.OS === "web") {
        // On web, redirect in same tab
        console.log("[Auth] Web platform: redirecting to OAuth...");
        window.location.href = loginUrl;
        return;
      }

      // Mobile: Open OAuth URL in browser
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
        // Extract code and state from the URL
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

  const upcomingTrip = useMemo(() => {
    if (!trips || trips.length === 0) return null;
    const now = new Date();
    return trips.find((trip) => new Date(trip.startDate) >= now) || trips[0];
  }, [trips]);

  const daysUntilTrip = useMemo(() => {
    if (!upcomingTrip) return null;
    const now = new Date();
    const tripDate = new Date(upcomingTrip.startDate);
    const diffTime = tripDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [upcomingTrip]);

  const handleCopyEmail = useCallback(async () => {
    if (forwardingData?.email) {
      await Clipboard.setStringAsync(forwardingData.email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [forwardingData?.email]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchTrips(), refetchInbox()]);
  }, [refetchTrips, refetchInbox]);

  if (authLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.welcomeContainer}>
          <IconSymbol name="suitcase.fill" size={80} color={colors.tint} />
          <ThemedText type="title" style={styles.welcomeTitle}>
            Welcome to TripHub
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
              <ThemedText style={styles.loginButtonText}>Sign In to Get Started</ThemedText>
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

        {/* Upcoming Trip Card */}
        {upcomingTrip ? (
          <Pressable
            style={[styles.tripCard, { backgroundColor: colors.tint }]}
            onPress={() => router.push(`/trip/${upcomingTrip.id}`)}
          >
            <View style={styles.tripCardHeader}>
              <ThemedText style={styles.tripCardLabel}>UPCOMING TRIP</ThemedText>
              {daysUntilTrip !== null && daysUntilTrip > 0 && (
                <View style={styles.countdownBadge}>
                  <ThemedText style={styles.countdownText}>
                    {daysUntilTrip} day{daysUntilTrip !== 1 ? "s" : ""} away
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={styles.tripName}>{upcomingTrip.name}</ThemedText>
            <ThemedText style={styles.tripDates}>
              {new Date(upcomingTrip.startDate).toLocaleDateString()} -{" "}
              {new Date(upcomingTrip.endDate).toLocaleDateString()}
            </ThemedText>
            <View style={styles.tripCardFooter}>
              <ThemedText style={styles.docCount}>
                {upcomingTrip.documentCount} document{upcomingTrip.documentCount !== 1 ? "s" : ""}
              </ThemedText>
              <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.8)" />
            </View>
          </Pressable>
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
              <ThemedText type="defaultSemiBold">New Trip</ThemedText>
            </Pressable>
            
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/upload")}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + "15" }]}>
                <IconSymbol name="doc.viewfinder" size={28} color={colors.success} />
              </View>
              <ThemedText type="defaultSemiBold">Upload Doc</ThemedText>
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
    paddingHorizontal: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
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
  tripCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
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
  },
  emptyText: {
    marginTop: Spacing.xs,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  actionsSection: {
    marginBottom: Spacing.lg,
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
