import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform, AppState, AppStateStatus } from "react-native";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

// Hardcoded EAS Project ID as fallback for production builds
// This must match the projectId in app.config.ts
const EAS_PROJECT_ID = "8ecc7ee6-7a8f-42c7-9aa4-4bea41063f33";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 10000];

/**
 * Get the EAS project ID from various sources
 * Priority: easConfig > expoConfig.extra > hardcoded fallback
 */
function getProjectId(): string {
  if (Constants.easConfig?.projectId) {
    console.log("[PushToken] Using easConfig.projectId");
    return Constants.easConfig.projectId;
  }

  if (Constants.expoConfig?.extra?.eas?.projectId) {
    console.log("[PushToken] Using expoConfig.extra.eas.projectId");
    return Constants.expoConfig.extra.eas.projectId;
  }

  console.log("[PushToken] Using hardcoded EAS_PROJECT_ID fallback");
  return EAS_PROJECT_ID;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook to register push token with the server for receiving notifications
 *
 * This enables server-side push notifications (e.g., email processing status)
 * to be sent directly to the user's device via Expo Push Notification Service.
 *
 * AUDIT FIX:
 * - Android notification channel is now awaited BEFORE requesting the push token
 *   (Expo docs require the channel to exist before getExpoPushTokenAsync on Android 13+).
 * - Added retry logic with exponential backoff (3 attempts).
 * - Re-attempts registration when app returns to foreground if previously failed.
 */
export function usePushTokenRegistration() {
  const { isAuthenticated, user } = useAuth();
  const registerMutation = trpc.user.registerPushToken.useMutation();
  const hasRegistered = useRef(false);
  const isRegistering = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      console.log("[PushToken] Skipping on web platform");
      return;
    }

    if (!isAuthenticated || !user || hasRegistered.current) {
      return;
    }

    const registerToken = async (attempt = 1): Promise<void> => {
      if (hasRegistered.current || isRegistering.current) return;
      isRegistering.current = true;

      try {
        console.log(`[PushToken] Starting registration for user ${user.id} (attempt ${attempt}/${MAX_RETRIES})`);

        // AUDIT FIX: Ensure Android notification channel exists BEFORE requesting token.
        // On Android 13+ the channel must be created before getExpoPushTokenAsync.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("email_processing", {
            name: "Email Processing",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#007AFF",
            description: "Notifications about email forwarding and document processing",
          });
          console.log("[PushToken] Android notification channel created");
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log("[PushToken] Existing permission status:", existingStatus);

        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          console.log("[PushToken] Requesting permission...");
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log("[PushToken] New permission status:", finalStatus);
        }

        if (finalStatus !== "granted") {
          console.log("[PushToken] Permission not granted, skipping registration");
          isRegistering.current = false;
          return;
        }

        const projectId = getProjectId();
        console.log("[PushToken] Using projectId:", projectId);
        console.log("[PushToken] Constants.easConfig:", JSON.stringify(Constants.easConfig));
        console.log("[PushToken] Constants.expoConfig?.extra:", JSON.stringify(Constants.expoConfig?.extra));

        let token: string;

        try {
          console.log("[PushToken] Calling getExpoPushTokenAsync...");
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
          token = tokenData.data;
          console.log("[PushToken] Got Expo token:", token);
        } catch (expoPushError: any) {
          console.error("[PushToken] Failed to get Expo token:", expoPushError?.message || expoPushError);

          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            console.log("[PushToken] Got device token type:", deviceToken.type);
            console.log("[PushToken] Device token (first 50 chars):", String(deviceToken.data).substring(0, 50));
            console.error("[PushToken] Device token obtained but cannot use with Expo Push API");
          } catch (deviceError: any) {
            console.error("[PushToken] Failed to get device token too:", deviceError?.message || deviceError);
          }

          // AUDIT FIX: Retry on failure instead of giving up
          if (attempt < MAX_RETRIES) {
            const retryDelay = RETRY_DELAYS_MS[attempt - 1] || 10000;
            console.log(`[PushToken] Will retry in ${retryDelay}ms...`);
            isRegistering.current = false;
            await delay(retryDelay);
            return registerToken(attempt + 1);
          }
          isRegistering.current = false;
          return;
        }

        console.log("[PushToken] Registering token with server...");
        await registerMutation.mutateAsync({ token });
        hasRegistered.current = true;
        console.log("[PushToken] Successfully registered with server!");
      } catch (error: any) {
        console.error("[PushToken] Registration failed:", error?.message || error);

        // AUDIT FIX: Retry on failure
        if (attempt < MAX_RETRIES) {
          const retryDelay = RETRY_DELAYS_MS[attempt - 1] || 10000;
          console.log(`[PushToken] Will retry in ${retryDelay}ms...`);
          isRegistering.current = false;
          await delay(retryDelay);
          return registerToken(attempt + 1);
        }
      } finally {
        isRegistering.current = false;
      }
    };

    registerToken();
  }, [isAuthenticated, user]);

  // AUDIT FIX: Re-attempt registration when app returns to foreground
  // (covers case where initial attempt failed or ran before auth was ready)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === "active" &&
        !hasRegistered.current &&
        !isRegistering.current &&
        isAuthenticated &&
        user
      ) {
        console.log("[PushToken] App returned to foreground, re-attempting registration");
        const retryOnForeground = async () => {
          if (hasRegistered.current || isRegistering.current) return;
          isRegistering.current = true;
          try {
            if (Platform.OS === "android") {
              await Notifications.setNotificationChannelAsync("email_processing", {
                name: "Email Processing",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#007AFF",
                description: "Notifications about email forwarding and document processing",
              });
            }

            const { status } = await Notifications.getPermissionsAsync();
            if (status !== "granted") {
              isRegistering.current = false;
              return;
            }

            const projectId = getProjectId();
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const token = tokenData.data;

            await registerMutation.mutateAsync({ token });
            hasRegistered.current = true;
            console.log("[PushToken] Foreground re-registration succeeded");
          } catch (err: any) {
            console.error("[PushToken] Foreground re-registration failed:", err?.message || err);
          } finally {
            isRegistering.current = false;
          }
        };
        retryOnForeground();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, user, registerMutation]);
}
