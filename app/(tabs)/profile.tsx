import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Platform,
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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: forwardingData } = trpc.user.getForwardingEmail.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const handleCopyEmail = useCallback(async () => {
    if (forwardingData?.email) {
      await Clipboard.setStringAsync(forwardingData.email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [forwardingData?.email]);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const loginUrl = getLoginUrl();

      if (Platform.OS === "web") {
        window.location.href = loginUrl;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        loginUrl,
        undefined,
        {
          preferEphemeralSession: false,
          showInRecents: true,
        }
      );

      if (result.type === "success" && result.url) {
        let url: URL;
        if (result.url.startsWith("exp://") || result.url.startsWith("exps://")) {
          const urlStr = result.url.replace(/^exp(s)?:\/\//, "http://");
          url = new URL(urlStr);
        } else {
          url = new URL(result.url);
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (code && state) {
          router.push({
            pathname: "/oauth/callback" as any,
            params: { code, state },
          });
        }
      }
    } catch (error) {
      console.error("[Auth] Login error:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive", 
          onPress: () => {
            logout();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      ]
    );
  }, [logout]);

  if (authLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, 20), paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.header}>
            <ThemedText type="title">Profile</ThemedText>
          </View>

          <View style={styles.signInContainer}>
            <IconSymbol name="person.fill" size={64} color={colors.textSecondary} />
            <ThemedText type="subtitle" style={styles.signInTitle}>
              Sign in to TripHub
            </ThemedText>
            <ThemedText style={[styles.signInText, { color: colors.textSecondary }]}>
              Access your trips and documents across all your devices
            </ThemedText>
            <Pressable
              style={[styles.signInButton, { backgroundColor: colors.tint }]}
              onPress={handleLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.signInButtonText}>Sign In</ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
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
      >
        <View style={styles.header}>
          <ThemedText type="title">Profile</ThemedText>
        </View>

        {/* User Info Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
            <ThemedText style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
            </ThemedText>
          </View>
          <View style={styles.userInfo}>
            <ThemedText type="subtitle">
              {user?.name || "TripHub User"}
            </ThemedText>
            {user?.email && (
              <ThemedText style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user.email}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Forwarding Email Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Email Forwarding
          </ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Forward your booking confirmations to this email address to automatically add them to TripHub.
          </ThemedText>
          
          {forwardingData?.email ? (
            <Pressable
              style={[styles.emailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleCopyEmail}
            >
              <View style={styles.emailContent}>
                <IconSymbol name="envelope.fill" size={24} color={colors.tint} />
                <ThemedText style={styles.emailText} numberOfLines={1}>
                  {forwardingData.email}
                </ThemedText>
              </View>
              <View style={[styles.copyButton, { backgroundColor: copied ? colors.success : colors.tint }]}>
                <IconSymbol 
                  name={copied ? "checkmark" : "doc.on.clipboard"} 
                  size={18} 
                  color="#FFFFFF" 
                />
              </View>
            </Pressable>
          ) : (
            <View style={[styles.emailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.tint} />
            </View>
          )}
        </View>

        {/* How It Works Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            How It Works
          </ThemedText>
          
          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.tint }]}>
                <ThemedText style={styles.stepNumberText}>1</ThemedText>
              </View>
              <View style={styles.stepContent}>
                <ThemedText type="defaultSemiBold">Receive a booking confirmation</ThemedText>
                <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  Flight, hotel, car rental, or any travel booking
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.tint }]}>
                <ThemedText style={styles.stepNumberText}>2</ThemedText>
              </View>
              <View style={styles.stepContent}>
                <ThemedText type="defaultSemiBold">Forward to your TripHub email</ThemedText>
                <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  Just forward the email with attachments
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.tint }]}>
                <ThemedText style={styles.stepNumberText}>3</ThemedText>
              </View>
              <View style={styles.stepContent}>
                <ThemedText type="defaultSemiBold">Documents are parsed automatically</ThemedText>
                <ThemedText style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  AI extracts key details and organizes them
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Legal
          </ThemedText>
          
          <Pressable
            style={[styles.legalButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/privacy")}
          >
            <IconSymbol name="doc.text.fill" size={20} color={colors.textSecondary} />
            <ThemedText style={styles.legalButtonText}>Privacy Policy</ThemedText>
            <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
          </Pressable>
          
          <Pressable
            style={[styles.legalButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/terms")}
          >
            <IconSymbol name="doc.text.fill" size={20} color={colors.textSecondary} />
            <ThemedText style={styles.legalButtonText}>Terms of Service</ThemedText>
            <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable
          style={[styles.signOutButton, { borderColor: colors.destructive }]}
          onPress={handleLogout}
        >
          <ThemedText style={[styles.signOutText, { color: colors.destructive }]}>
            Sign Out
          </ThemedText>
        </Pressable>
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
  signInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  signInTitle: {
    marginTop: Spacing.md,
  },
  signInText: {
    marginTop: Spacing.xs,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  signInButton: {
    marginTop: Spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.md,
    minWidth: 120,
    alignItems: "center",
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 30,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userEmail: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  emailCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  emailContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  emailText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  stepsList: {
    gap: Spacing.md,
  },
  step: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  legalButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  legalButtonText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
});
