import { useRouter } from "expo-router";
import { useCallback, useState, useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { FontScaling } from "@/constants/accessibility";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNotifications } from "@/hooks/use-notifications";
import {
  getScheduledNotificationCount,
  cancelAllTripNotifications,
  initializeNotifications,
} from "@/lib/notifications";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  
  const { enabled: notificationsEnabled, toggleNotifications, initialized } = useNotifications();
  const [scheduledCount, setScheduledCount] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Check notification permission status
  useEffect(() => {
    const checkPermission = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === "granted");
    };
    checkPermission();
  }, []);

  // Load scheduled notification count
  useEffect(() => {
    const loadCount = async () => {
      const count = await getScheduledNotificationCount();
      setScheduledCount(count);
    };
    loadCount();
  }, [notificationsEnabled]);

  const handleToggleNotifications = useCallback(async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (value && !hasPermission) {
      // Request permission first
      const granted = await initializeNotifications();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive trip reminders.",
          [{ text: "OK" }]
        );
        return;
      }
      setHasPermission(true);
    }
    
    await toggleNotifications(value);
    
    // Update scheduled count
    const count = await getScheduledNotificationCount();
    setScheduledCount(count);
  }, [toggleNotifications, hasPermission]);

  const handleClearAllNotifications = useCallback(async () => {
    Alert.alert(
      "Clear All Reminders",
      "This will cancel all scheduled trip reminders. They will be rescheduled automatically based on your upcoming trips.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await cancelAllTripNotifications();
            setScheduledCount(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, []);

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 20), backgroundColor: colors.tint },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </Pressable>
        <ThemedText style={styles.headerTitle} maxFontSizeMultiplier={FontScaling.title}>
          Settings
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Notifications Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle} maxFontSizeMultiplier={FontScaling.title}>
            Notifications
          </ThemedText>
          <ThemedText 
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={FontScaling.body}
          >
            Receive helpful reminders about your upcoming trips.
          </ThemedText>

          {/* Main Toggle */}
          <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: colors.tint + "15" }]}>
                <IconSymbol name="bell.fill" size={20} color={colors.tint} />
              </View>
              <View style={styles.settingText}>
                <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.body}>
                  Trip Reminders
                </ThemedText>
                <ThemedText 
                  style={[styles.settingSubtext, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={FontScaling.label}
                >
                  {scheduledCount > 0 
                    ? `${scheduledCount} reminder${scheduledCount === 1 ? "" : "s"} scheduled`
                    : "No reminders scheduled"}
                </ThemedText>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.tint }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              disabled={!initialized}
            />
          </View>

          {/* Notification Types Info */}
          {notificationsEnabled && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText 
                type="defaultSemiBold" 
                style={styles.infoTitle}
                maxFontSizeMultiplier={FontScaling.body}
              >
                What you'll receive:
              </ThemedText>
              
              <View style={styles.infoItem}>
                <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
                <ThemedText 
                  style={[styles.infoText, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={FontScaling.label}
                >
                  7 days before trip: Document status overview
                </ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
                <ThemedText 
                  style={[styles.infoText, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={FontScaling.label}
                >
                  1 day before trip: Final reminder with check-in tip
                </ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <IconSymbol name="airplane" size={16} color={colors.textSecondary} />
                <ThemedText 
                  style={[styles.infoText, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={FontScaling.label}
                >
                  24h before flight: Check-in reminder
                </ThemedText>
              </View>
              
              <View style={styles.infoItem}>
                <IconSymbol name="car.fill" size={16} color={colors.textSecondary} />
                <ThemedText 
                  style={[styles.infoText, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={FontScaling.label}
                >
                  Car return day: Return reminder
                </ThemedText>
              </View>
            </View>
          )}

          {/* Clear All Button */}
          {notificationsEnabled && scheduledCount > 0 && (
            <Pressable
              style={[styles.clearButton, { borderColor: colors.border }]}
              onPress={handleClearAllNotifications}
            >
              <IconSymbol name="trash" size={18} color={colors.textSecondary} />
              <ThemedText 
                style={[styles.clearButtonText, { color: colors.textSecondary }]}
                maxFontSizeMultiplier={FontScaling.button}
              >
                Clear All Scheduled Reminders
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* Privacy Note */}
        <View style={styles.section}>
          <View style={[styles.privacyNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="lock.fill" size={16} color={colors.textSecondary} />
            <ThemedText 
              style={[styles.privacyText, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.label}
            >
              All notifications are scheduled locally on your device. No data is sent to external servers for notifications.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  settingSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  infoTitle: {
    marginBottom: Spacing.xs,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
