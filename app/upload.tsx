import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  Platform,
  Modal,
  FlatList,
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
import * as Auth from "@/lib/auth";
import { getApiBaseUrl } from "@/constants/oauth";
import { FontScaling } from "@/constants/accessibility";

export default function UploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = params.tripId ? parseInt(params.tripId, 10) : null;
  
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
    file?: File;
  } | null>(null);
  
  // Background processing state
  const [isBackgroundProcessing, setIsBackgroundProcessing] = useState(false);
  
  // Manual assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [pendingDocumentIds, setPendingDocumentIds] = useState<number[]>([]);

  // Ref for web file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  
  // Get trips for manual assignment
  const { data: trips } = trpc.trips.list.useQuery();
  
  // Assign document mutation
  const assignMutation = trpc.documents.assign.useMutation({
    onSuccess: () => {
      utils.documents.inbox.invalidate();
      utils.documents.inboxCount.invalidate();
      utils.trips.list.invalidate();
    },
  });

  const parseAndCreateMutation = trpc.documents.parseAndCreate.useMutation({
    onSuccess: (data) => {
      utils.documents.inbox.invalidate();
      utils.documents.inboxCount.invalidate();
      utils.user.getCredits.invalidate();
      if (tripId || data.autoAssignedTripId) {
        utils.documents.byTrip.invalidate({ tripId: tripId || data.autoAssignedTripId! });
        utils.trips.list.invalidate();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // If processing in background, just show a subtle notification
      if (isBackgroundProcessing) {
        // User already navigated away, no alert needed
        return;
      }
      
      // Check if we need manual assignment
      if (data.needsManualAssignment && !tripId) {
        setIsProcessing(false);
        setPendingDocumentIds(data.documentIds);
        setShowAssignModal(true);
      } else if (data.autoAssignedTripId && data.autoAssignedTripName) {
        const message = data.count === 1 
          ? `Document automatically assigned to "${data.autoAssignedTripName}".`
          : `${data.count} documents automatically assigned to "${data.autoAssignedTripName}".`;
        
        Alert.alert(
          "Document Processed",
          message,
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        const message = data.count === 1 
          ? "Your document has been processed and saved."
          : `${data.count} documents were extracted and saved.`;
        
        Alert.alert(
          "Document Processed",
          message,
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    },
    onError: (error) => {
      if (isBackgroundProcessing) {
        // User already navigated away, error will be visible in inbox
        return;
      }
      console.error("Parse error:", error);
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Processing Failed", error.message || "Please try again.");
    },
  });

  const handleAssignToTrip = async (selectedTripId: number | null) => {
    setShowAssignModal(false);
    
    for (const docId of pendingDocumentIds) {
      await assignMutation.mutateAsync({ documentId: docId, tripId: selectedTripId });
    }
    
    if (selectedTripId) {
      utils.documents.byTrip.invalidate({ tripId: selectedTripId });
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const tripName = selectedTripId 
      ? trips?.find(t => t.id === selectedTripId)?.name 
      : "Inbox";
    
    Alert.alert(
      "Document Assigned",
      `Document has been assigned to ${tripName}.`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  // Auto-start processing when file is selected
  const processFile = useCallback(async (file: {
    uri: string;
    name: string;
    type: string;
    file?: File;
  }) => {
    setIsProcessing(true);
    setProcessingStatus("Uploading file...");
    
    try {
      const formData = new FormData();
      
      if (Platform.OS === "web") {
        if (file.file) {
          formData.append("file", file.file, file.name);
        } else {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          formData.append("file", blob, file.name);
        }
      } else {
        formData.append("file", {
          uri: file.uri,
          type: file.type,
          name: file.name,
        } as any);
      }

      const apiBaseUrl = getApiBaseUrl();
      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      setProcessingStatus("Uploading to server...");
      const uploadResponse = await fetch(`${apiBaseUrl}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.url;

      setProcessingStatus("Analyzing document with AI...");
      await parseAndCreateMutation.mutateAsync({
        fileUrl,
        mimeType: file.type,
        tripId: tripId,
      });
      
    } catch (error: any) {
      if (!isBackgroundProcessing) {
        console.error("Upload error:", error);
        setIsProcessing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Upload Failed", error.message || "Please try again.");
      }
    }
  }, [tripId, parseAndCreateMutation, isBackgroundProcessing]);

  // Start processing when file is selected
  useEffect(() => {
    if (selectedFile && !isProcessing) {
      processFile(selectedFile);
    }
  }, [selectedFile]);

  const handleContinueInBackground = useCallback(() => {
    setIsBackgroundProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

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

  const handleWebFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const uri = URL.createObjectURL(file);
      setSelectedFile({
        uri,
        name: file.name,
        type: file.type,
        file,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (event.target) {
      event.target.value = "";
    }
  }, []);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Processing overlay
  if (isProcessing) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.closeButton} />
          <ThemedText type="subtitle" maxFontSizeMultiplier={FontScaling.title}>Processing</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.processingContainer}>
          <View style={[styles.processingCard, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.tint} />
            <ThemedText 
              type="subtitle" 
              style={styles.processingTitle}
              maxFontSizeMultiplier={FontScaling.title}
            >
              Analyzing Document
            </ThemedText>
            <ThemedText 
              style={[styles.processingStatus, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.body}
            >
              {processingStatus || "Please wait..."}
            </ThemedText>
            
            {selectedFile && (
              <View style={[styles.processingFile, { backgroundColor: colors.background }]}>
                <IconSymbol 
                  name={selectedFile.type.includes("pdf") ? "doc.fill" : "photo.fill"} 
                  size={20} 
                  color={colors.tint} 
                />
                <ThemedText 
                  numberOfLines={1} 
                  style={[styles.processingFileName, { color: colors.text }]}
                  maxFontSizeMultiplier={FontScaling.body}
                >
                  {selectedFile.name}
                </ThemedText>
              </View>
            )}
          </View>
          
          <Pressable
            style={[styles.backgroundButton, { borderColor: colors.border }]}
            onPress={handleContinueInBackground}
          >
            <IconSymbol name="arrow.left" size={18} color={colors.tint} />
            <ThemedText 
              style={[styles.backgroundButtonText, { color: colors.tint }]}
              maxFontSizeMultiplier={FontScaling.button}
            >
              Continue in Background
            </ThemedText>
          </Pressable>
          
          <ThemedText 
            style={[styles.backgroundHint, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={FontScaling.label}
          >
            You can navigate away and the document will appear in your inbox when ready.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

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

      {/* Manual Assignment Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <ThemedText type="subtitle" maxFontSizeMultiplier={FontScaling.title}>Assign to Trip</ThemedText>
            <Pressable onPress={() => {
              setShowAssignModal(false);
              router.back();
            }} style={styles.modalCloseButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.modalContent}>
            <View style={[styles.noMatchBanner, { backgroundColor: colors.warning + "15" }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={24} color={colors.warning} />
              <ThemedText 
                style={[styles.noMatchText, { color: colors.text }]}
                maxFontSizeMultiplier={FontScaling.body}
              >
                No matching trip found for this document's dates. Please select a trip manually or keep it in your inbox.
              </ThemedText>
            </View>
            
            <FlatList
              data={trips || []}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.tripList}
              ListHeaderComponent={
                <Pressable
                  style={[styles.tripOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleAssignToTrip(null)}
                >
                  <View style={[styles.tripIcon, { backgroundColor: colors.textSecondary + "15" }]}>
                    <IconSymbol name="tray.fill" size={24} color={colors.textSecondary} />
                  </View>
                  <View style={styles.tripInfo}>
                    <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.body}>Keep in Inbox</ThemedText>
                    <ThemedText 
                      style={[styles.tripDates, { color: colors.textSecondary }]}
                      maxFontSizeMultiplier={FontScaling.label}
                    >
                      Assign to a trip later
                    </ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.tripOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleAssignToTrip(item.id)}
                >
                  <View style={[styles.tripIcon, { backgroundColor: colors.tint + "15" }]}>
                    <IconSymbol name="suitcase.fill" size={24} color={colors.tint} />
                  </View>
                  <View style={styles.tripInfo}>
                    <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.body}>{item.name}</ThemedText>
                    <ThemedText 
                      style={[styles.tripDates, { color: colors.textSecondary }]}
                      maxFontSizeMultiplier={FontScaling.label}
                    >
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyTrips}>
                  <ThemedText 
                    style={{ color: colors.textSecondary }}
                    maxFontSizeMultiplier={FontScaling.body}
                  >
                    No trips created yet. The document will be kept in your inbox.
                  </ThemedText>
                </View>
              }
            />
          </View>
        </ThemedView>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <IconSymbol name="xmark" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="subtitle" maxFontSizeMultiplier={FontScaling.title}>Upload Document</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Instructions */}
        <View style={styles.instructions}>
          <ThemedText 
            style={[styles.instructionText, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={FontScaling.body}
          >
            Upload a booking confirmation, e-ticket, or any travel document. Our AI will automatically extract the important details.
          </ThemedText>
        </View>

        {/* Upload Options */}
        <View style={styles.optionsContainer}>
          <Pressable
            style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleTakePhoto}
            disabled={isProcessing}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.tint + "15" }]}>
              <IconSymbol name="camera.fill" size={32} color={colors.tint} />
            </View>
            <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.body}>Take Photo</ThemedText>
            <ThemedText 
              style={[styles.optionDescription, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.label}
            >
              Capture a document with your camera
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleChooseFromLibrary}
            disabled={isProcessing}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.success + "15" }]}>
              <IconSymbol name="photo.fill" size={32} color={colors.success} />
            </View>
            <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.body}>Photo Library</ThemedText>
            <ThemedText 
              style={[styles.optionDescription, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.label}
            >
              Choose an image from your photos
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.optionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleChooseDocument}
            disabled={isProcessing}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.warning + "15" }]}>
              <IconSymbol name="doc.fill" size={32} color={colors.warning} />
            </View>
            <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.body}>Choose File</ThemedText>
            <ThemedText 
              style={[styles.optionDescription, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={FontScaling.label}
            >
              Select a PDF or image file
            </ThemedText>
          </Pressable>
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
  // Processing overlay styles
  processingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  processingCard: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  processingTitle: {
    marginTop: Spacing.md,
  },
  processingStatus: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  processingFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    maxWidth: "100%",
  },
  processingFileName: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  backgroundButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  backgroundButtonText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  backgroundHint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    right: Spacing.md,
    top: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  noMatchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  noMatchText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tripList: {
    gap: Spacing.sm,
  },
  tripOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  tripIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tripInfo: {
    flex: 1,
    gap: 2,
  },
  tripDates: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTrips: {
    padding: Spacing.lg,
    alignItems: "center",
  },
});
