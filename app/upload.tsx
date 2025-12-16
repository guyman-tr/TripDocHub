import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useState, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  Platform,
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
import { trpc } from "@/lib/trpc";

export default function UploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = params.tripId ? parseInt(params.tripId, 10) : null;
  
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
    file?: File; // Store the actual File object for web
  } | null>(null);

  // Ref for web file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const parseAndCreateMutation = trpc.documents.parseAndCreate.useMutation({
    onSuccess: (data) => {
      utils.documents.inbox.invalidate();
      utils.documents.inboxCount.invalidate();
      if (tripId) {
        utils.documents.byTrip.invalidate({ tripId });
        utils.trips.list.invalidate();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const message = data.count === 1 
        ? "Your document has been processed and saved."
        : `${data.count} documents were extracted and saved.`;
      
      Alert.alert(
        "Document Processed",
        message,
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (error) => {
      console.error("Parse error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Processing Failed", error.message || "Please try again.");
    },
  });

  const handleTakePhoto = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Camera is not available in web browser. Please use 'Choose File' instead.");
      return;
    }
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
    if (Platform.OS === "web") {
      // On web, trigger the file input for images
      if (fileInputRef.current) {
        fileInputRef.current.accept = "image/*";
        fileInputRef.current.click();
      }
      return;
    }
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
    if (Platform.OS === "web") {
      // On web, trigger the file input for PDFs and images
      if (fileInputRef.current) {
        fileInputRef.current.accept = "application/pdf,image/*";
        fileInputRef.current.click();
      }
      return;
    }
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

  // Handle web file input change
  const handleWebFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const uri = URL.createObjectURL(file);
      setSelectedFile({
        uri,
        name: file.name,
        type: file.type,
        file, // Store the actual File object
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Reset the input so the same file can be selected again
    if (event.target) {
      event.target.value = "";
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus("Uploading file...");
    
    try {
      // Step 1: Upload file to S3 via our API
      const formData = new FormData();
      
      // Handle file differently based on platform
      if (Platform.OS === "web") {
        if (selectedFile.file) {
          // Use the actual File object if available
          formData.append("file", selectedFile.file, selectedFile.name);
        } else {
          // Fallback: fetch the blob URL
          const response = await fetch(selectedFile.uri);
          const blob = await response.blob();
          formData.append("file", blob, selectedFile.name);
        }
      } else {
        // On native, use the URI directly
        formData.append("file", {
          uri: selectedFile.uri,
          type: selectedFile.type,
          name: selectedFile.name,
        } as any);
      }

      // Get the API base URL
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
      
      setUploadStatus("Uploading to server...");
      const uploadResponse = await fetch(`${apiBaseUrl}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.url;

      // Step 2: Parse the document with AI
      setUploadStatus("Analyzing document with AI...");
      await parseAndCreateMutation.mutateAsync({
        fileUrl,
        mimeType: selectedFile.type,
        tripId: tripId,
      });
      
    } catch (error: any) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", error.message || "Please try again.");
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  }, [selectedFile, tripId, parseAndCreateMutation]);

  return (
    <ThemedView style={styles.container}>
      {/* Hidden file input for web */}
      {Platform.OS === "web" && (
        <input
          ref={fileInputRef as any}
          type="file"
          style={{ display: "none" }}
          onChange={handleWebFileChange as any}
          accept="application/pdf,image/*"
        />
      )}

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
            disabled={isUploading}
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
            disabled={isUploading}
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
            disabled={isUploading}
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
            {!isUploading && (
              <Pressable
                onPress={() => setSelectedFile(null)}
                style={styles.removeButton}
              >
                <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
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
                <ThemedText style={styles.uploadButtonText}>{uploadStatus || "Processing..."}</ThemedText>
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
  },
  fileType: {
    fontSize: 12,
    lineHeight: 16,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: "transparent",
  },
  uploadButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  uploadingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
