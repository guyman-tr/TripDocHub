import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: undefined, // Uses the project ID from app.json/app.config.ts
        });

        const token = tokenData.data;
        console.log("[PushToken] Got token:", token.substring(0, 30) + "...");

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
