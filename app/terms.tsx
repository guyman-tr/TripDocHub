import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Terms of Service",
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
            Terms of Service
          </ThemedText>
          <ThemedText style={styles.lastUpdated}>
            Last updated: December 20, 2024
          </ThemedText>

          <ThemedText style={styles.paragraph}>
            Welcome to TripHub. By using our mobile application, you agree to these Terms of Service. Please read them carefully.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            1. Acceptance of Terms
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            By accessing or using TripHub, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the app.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            2. Description of Service
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            TripHub is a travel document organizer that allows you to upload, store, and organize travel-related documents such as flight confirmations, hotel bookings, and car rentals. The app uses AI technology to extract and parse information from your documents.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            3. User Accounts
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            To use TripHub, you must create an account using one of our supported authentication providers (Google, Microsoft, Apple, or email). You are responsible for maintaining the security of your account and for all activities that occur under your account.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            4. Acceptable Use
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            You agree to use TripHub only for lawful purposes and in accordance with these Terms. You agree not to:
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Upload content that is illegal, harmful, or violates the rights of others
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Attempt to gain unauthorized access to our systems or other users' accounts
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Use the service to distribute spam, malware, or other harmful content
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>
            • Interfere with or disrupt the service or servers
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            5. User Content
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            You retain ownership of all documents and content you upload to TripHub. By uploading content, you grant us a limited license to store, process, and display your content solely for the purpose of providing the service to you.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            6. AI Processing
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            TripHub uses artificial intelligence to analyze and extract information from your documents. While we strive for accuracy, AI-extracted information may contain errors. You should always verify important details against your original documents.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            7. Email Forwarding
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            TripHub provides you with a unique email address for forwarding booking confirmations. By using this feature, you acknowledge that emails sent to this address will be processed by our systems to extract attachments and document information.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            8. Disclaimer of Warranties
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            TripHub is provided "as is" without warranties of any kind, either express or implied. We do not guarantee that the service will be uninterrupted, secure, or error-free. We are not responsible for any travel disruptions, missed flights, or other issues arising from reliance on information displayed in the app.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            9. Limitation of Liability
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            To the maximum extent permitted by law, TripDocHub App shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            10. Changes to Terms
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            We may update these Terms of Service from time to time. We will notify you of any material changes by posting the new terms in the app. Your continued use of TripHub after changes are posted constitutes your acceptance of the modified terms.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            11. Termination
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            We reserve the right to suspend or terminate your access to TripHub at any time for violation of these Terms or for any other reason at our discretion. You may also delete your account at any time by contacting us.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            12. Governing Law
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            13. Contact Us
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            If you have any questions about these Terms of Service, please contact us at:
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
