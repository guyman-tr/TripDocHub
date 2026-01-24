import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

// Hardcoded EAS Project ID as fallback for production builds
// This must match the projectId in app.config.ts
const EAS_PROJECT_ID = "8ecc7ee6-7a8f-42c7-9aa4-4bea41063f33";

/**
 * Get the EAS project ID from various sources
 * Priority: easConfig > expoConfig.extra > hardcoded fallback
 */
function getProjectId(): string {
  // Try easConfig first (available in EAS builds)
  if (Constants.easConfig?.projectId) {
    console.log("[PushToken] Using easConfig.projectId");
    return Constants.easConfig.projectId;
  }
  
  // Try expoConfig.extra (available in development)
  if (Constants.expoConfig?.extra?.eas?.projectId) {
    console.log("[PushToken] Using expoConfig.extra.eas.projectId");
    return Constants.expoConfig.extra.eas.projectId;
  }
  
  // Fallback to hardcoded value for production builds
  console.log("[PushToken] Using hardcoded EAS_PROJECT_ID fallback");
  return EAS_PROJECT_ID;
}

/**
 * Hook to register push token with the server for receiving notifications
 * 
 * This enables server-side push notifications (e.g., email processing status)
 * to be sent directly to the user's device via Expo Push Notification Service.
 */
export function usePushTokenRegistration() {
  const { isAuthenticated, user } = useAuth();
  const registerMutation = trpc.user.registerPushToken.useMutation();
  const hasRegistered = useRef(false);

  useEffect(() => {
    // Skip on web platform
    if (Platform.OS === "web") {
      console.log("[PushToken] Skipping on web platform");
      return;
    }

    // Only register once per session and only when authenticated
    if (!isAuthenticated || !user || hasRegistered.current) {
      return;
    }

    const registerToken = async () => {
      try {
        console.log("[PushToken] Starting registration for user:", user.id);
        
        // Check if we have notification permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log("[PushToken] Existing permission status:", existingStatus);
        
        let finalStatus = existingStatus;

        // Request permission if not already granted
        if (existingStatus !== "granted") {
          console.log("[PushToken] Requesting permission...");
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log("[PushToken] New permission status:", finalStatus);
        }

        if (finalStatus !== "granted") {
          console.log("[PushToken] Permission not granted, skipping registration");
          return;
        }

        // Get the project ID
        const projectId = getProjectId();
        console.log("[PushToken] Using projectId:", projectId);
        
        // Log all available Constants for debugging
        console.log("[PushToken] Constants.easConfig:", JSON.stringify(Constants.easConfig));
        console.log("[PushToken] Constants.expoConfig?.extra:", JSON.stringify(Constants.expoConfig?.extra));
        
        let token: string;
        
        try {
          // Get Expo push token
          console.log("[PushToken] Calling getExpoPushTokenAsync...");
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
          token = tokenData.data;
          console.log("[PushToken] Got Expo token:", token);
        } catch (expoPushError: any) {
          console.error("[PushToken] Failed to get Expo token:", expoPushError?.message || expoPushError);
          
          // Try device token as diagnostic (won't work with Expo Push API)
          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            console.log("[PushToken] Got device token type:", deviceToken.type);
            console.log("[PushToken] Device token (first 50 chars):", String(deviceToken.data).substring(0, 50));
            console.error("[PushToken] Device token obtained but cannot use with Expo Push API");
          } catch (deviceError: any) {
            console.error("[PushToken] Failed to get device token too:", deviceError?.message || deviceError);
          }
          return;
        }

        // Register with server
        console.log("[PushToken] Registering token with server...");
        await registerMutation.mutateAsync({ token });
        hasRegistered.current = true;
        console.log("[PushToken] Successfully registered with server!");
      } catch (error: any) {
        console.error("[PushToken] Registration failed:", error?.message || error);
      }
    };

    // Create Android notification channel for email processing
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("email_processing", {
        name: "Email Processing",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#007AFF",
        description: "Notifications about email forwarding and document processing",
      });
    }

    registerToken();
  }, [isAuthenticated, user]);
}
