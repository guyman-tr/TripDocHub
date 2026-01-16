import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Privacy Policy",
          headerShown: true,
        }}
      />
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 20,
            },
          ]}
        >
          <ThemedText type="title" style={styles.title}>
            Privacy Policy
          </ThemedText>
          <ThemedText style={styles.lastUpdated}>
            Last updated: December 20, 2024
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            TripDocHub App ("we", "our", or "us") operates the TripDocHub mobile application. This Privacy Policy explains how we collect, use, and protect your information when you use our app.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            1. Information We Collect
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText type="defaultSemiBold">Account Information:</ThemedText> When you sign in, we collect your name and email address from your authentication provider (Google, Microsoft, Apple, or email).
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText type="defaultSemiBold">Travel Documents:</ThemedText> Documents you upload or forward to your unique inbox email, including flight confirmations, hotel bookings, car rentals, and other travel-related files.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText type="defaultSemiBold">Trip Information:</ThemedText> Trip names and dates you create to organize your documents.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText type="defaultSemiBold">Forwarded Emails:</ThemedText> Emails sent to your unique @in.mytripdochub.com address, including attachments.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            2. How We Use Your Information
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            We use your information to provide and improve our services:
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Process and parse your travel documents using AI to extract booking details (flight numbers, confirmation codes, dates, addresses)
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Store your documents securely so you can access them anytime
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Automatically organize documents into trips based on travel dates
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Provide navigation to addresses found in your documents
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            3. Third-Party Services
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            We use the following third-party services to operate TripDocHub:
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Authentication Providers</ThemedText> (Google, Microsoft, Apple): To securely sign you in without storing passwords
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Mailgun</ThemedText>: To receive emails forwarded to your unique inbox address
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Cloud Storage</ThemedText>: To securely store your uploaded documents
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">OpenAI</ThemedText>: To analyze and extract information from your travel documents using AI
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            These services have their own privacy policies governing their use of your data.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            4. Data Storage and Security
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            Your data is stored securely using industry-standard encryption. All connections to our servers use HTTPS encryption. We do not sell, trade, or share your personal information with third parties for marketing purposes.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            5. Your Rights
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            You have the right to:
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Access</ThemedText> your data at any time through the app
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Delete</ThemedText> individual documents or trips
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Delete your account</ThemedText> and all associated data by contacting us
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • <ThemedText type="defaultSemiBold">Stop using email forwarding</ThemedText> at any time by simply not forwarding emails
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            6. Data Retention
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            We retain your data for as long as your account is active. If you delete your account, we will delete all your personal data within 30 days, except where we are required to retain it for legal purposes.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            7. Children's Privacy
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            TripDocHub is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            8. Changes to This Policy
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy in the app and updating the "Last updated" date.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            9. Contact Us
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at:
          </ThemedText>
          <ThemedText style={styles.contactInfo}>
            privacy@in.mytripdochub.com
          </ThemedText>
        </ScrollView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 24,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 12,
    lineHeight: 24,
  },
  bulletPoint: {
    marginBottom: 8,
    marginLeft: 8,
    lineHeight: 24,
  },
  contactInfo: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
});
