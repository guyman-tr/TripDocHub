import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

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
    // Only register once per session and only when authenticated
    if (!isAuthenticated || !user || hasRegistered.current) {
      return;
    }

    const registerToken = async () => {
      try {
        // Check if we have notification permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permission if not already granted
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("[PushToken] Permission not granted, skipping registration");
          return;
        }

        // Get the Expo push token
        // For EAS builds, we need to provide the projectId explicitly
        // For Expo Go, it uses the experienceId from Constants
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        
        console.log("[PushToken] Getting token with projectId:", projectId);
        console.log("[PushToken] Constants.expoConfig:", JSON.stringify(Constants.expoConfig?.extra));
        console.log("[PushToken] Constants.easConfig:", JSON.stringify(Constants.easConfig));
        
        let token: string;
        
        try {
          // Try to get Expo push token first
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
          token = tokenData.data;
          console.log("[PushToken] Got Expo token:", token.substring(0, 30) + "...");
        } catch (expoPushError) {
          console.log("[PushToken] Failed to get Expo token, trying device token:", expoPushError);
          
          // Fallback to device push token (FCM for Android, APNs for iOS)
          // This won't work with Expo Push API but at least we can log the issue
          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            console.log("[PushToken] Got device token type:", deviceToken.type);
            console.log("[PushToken] Device token:", String(deviceToken.data).substring(0, 30) + "...");
            
            // We can't use device tokens with Expo Push API
            // Log this for debugging
            console.error("[PushToken] Cannot use device token with Expo Push API. Need EAS projectId.");
            return;
          } catch (deviceError) {
            console.error("[PushToken] Failed to get any push token:", deviceError);
            return;
          }
        }

        // Register with server
        await registerMutation.mutateAsync({ token });
        hasRegistered.current = true;
        console.log("[PushToken] Registered with server");
      } catch (error) {
        console.error("[PushToken] Failed to register:", error);
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
