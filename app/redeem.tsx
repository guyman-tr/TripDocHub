import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { trpc } from "@/lib/trpc";

export default function RedeemScreen() {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const utils = trpc.useUtils();
  const redeemMutation = trpc.billing.redeemPromoCode.useMutation({
    onSuccess: (data) => {
      setIsRedeeming(false);
      if (data.success && 'creditsAdded' in data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Success!",
          `${data.creditsAdded} credits have been added to your account. New balance: ${data.newBalance} credits.`,
          [
            {
              text: "OK",
              onPress: () => {
                utils.user.getCredits.invalidate();
                router.back();
              },
            },
          ]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", ('error' in data ? data.error : undefined) || "Failed to redeem promo code");
      }
    },
    onError: (error) => {
      setIsRedeeming(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to redeem promo code");
    },
  });

  const handleRedeem = () => {
    if (!code.trim()) {
      Alert.alert("Error", "Please enter a promo code");
      return;
    }

    setIsRedeeming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    redeemMutation.mutate({ code: code.trim() });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ThemedText style={styles.backText}>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="title" style={styles.title}>
              Redeem Code
            </ThemedText>
            <View style={styles.backButton} />
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <ThemedText style={styles.label}>Enter your promo code</ThemedText>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="PROMO123"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRedeem}
            />
            <ThemedText style={styles.hint}>
              Promo codes are case-insensitive
            </ThemedText>
          </View>

          {/* Redeem Button */}
          <Pressable
            style={[
              styles.redeemButton,
              (!code.trim() || isRedeeming) && styles.redeemButtonDisabled,
            ]}
            onPress={handleRedeem}
            disabled={!code.trim() || isRedeeming}
          >
            {isRedeeming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.redeemButtonText}>
                Redeem Code
              </ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: "#007AFF",
    fontSize: 17,
  },
  title: {
    fontSize: 20,
    textAlign: "center",
  },
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    marginBottom: 12,
    opacity: 0.8,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 2,
    color: "#000",
  },
  hint: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: "center",
    marginTop: 8,
  },
  redeemButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  redeemButtonDisabled: {
    opacity: 0.5,
  },
  redeemButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
