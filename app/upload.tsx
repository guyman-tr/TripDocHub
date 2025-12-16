import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);

  const handleTakePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Camera access is needed to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || "photo.jpg",
          type: asset.mimeType || "image/jpeg",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }, []);

  const handleChooseFromLibrary = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Photo library access is needed.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || "image.jpg",
          type: asset.mimeType || "image/jpeg",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Library error:", error);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  }, []);

  const handleChooseDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/pdf",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Document picker error:", error);
      Alert.alert("Error", "Failed to select document. Please try again.");
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // TODO: Implement actual upload and AI parsing
      // For now, simulate upload
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Document Uploaded",
        "Your document has been uploaded and is being processed. It will appear in your inbox shortly.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", "Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, router]);

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <IconSymbol name="xmark" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="subtitle">Upload Document</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* Instructions */}
        <View style={styles.instructions}>
          <ThemedText style={[styles.instructionText, { color: colors.textSecondary }]}>
            Upload a booking confirmation, e-ticket, or any travel document. Our AI will automatically extract the important details.
          </ThemedText>
        </View>

        {/* Upload Options */}
        <View style={styles.optionsContainer}>
          <Pressable
            style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleTakePhoto}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.tint + "15" }]}>
              <IconSymbol name="camera.fill" size={32} color={colors.tint} />
            </View>
            <ThemedText type="defaultSemiBold">Take Photo</ThemedText>
            <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Capture a document with your camera
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleChooseFromLibrary}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.success + "15" }]}>
              <IconSymbol name="photo.fill" size={32} color={colors.success} />
            </View>
            <ThemedText type="defaultSemiBold">Photo Library</ThemedText>
            <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Choose an image from your photos
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleChooseDocument}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.warning + "15" }]}>
              <IconSymbol name="doc.fill" size={32} color={colors.warning} />
            </View>
            <ThemedText type="defaultSemiBold">Choose File</ThemedText>
            <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Select a PDF or image file
            </ThemedText>
          </Pressable>
        </View>

        {/* Selected File Preview */}
        {selectedFile && (
          <View style={[styles.selectedFile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.selectedFileInfo}>
              <IconSymbol 
                name={selectedFile.type.includes("pdf") ? "doc.fill" : "photo.fill"} 
                size={24} 
                color={colors.tint} 
              />
              <View style={styles.selectedFileText}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {selectedFile.name}
                </ThemedText>
                <ThemedText style={[styles.fileType, { color: colors.textSecondary }]}>
                  {selectedFile.type}
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={() => setSelectedFile(null)}
              style={styles.removeButton}
            >
              <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Upload Button */}
      {selectedFile && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={[styles.uploadButton, { backgroundColor: colors.tint }]}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={styles.uploadingContent}>
                <ActivityIndicator color="#FFFFFF" />
                <ThemedText style={styles.uploadButtonText}>Processing...</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.uploadButtonText}>Upload & Parse Document</ThemedText>
            )}
          </Pressable>
        </View>
      )}
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
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  instructions: {
    marginBottom: Spacing.lg,
  },
  instructionText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  selectedFile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  selectedFileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  selectedFileText: {
    flex: 1,
    gap: 2,
  },
  fileType: {
    fontSize: 12,
    lineHeight: 16,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  uploadButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  uploadingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
});
