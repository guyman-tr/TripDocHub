import { useRouter } from "expo-router";
import { useCallback, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";

// Simple calendar component that works on all platforms
function Calendar({
  selectedDate,
  onSelectDate,
  minimumDate,
  onClose,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  minimumDate?: Date;
  onClose: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const goToPrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const isDateDisabled = (day: number) => {
    if (!minimumDate) return false;
    const date = new Date(year, month, day);
    const minDateOnly = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate());
    return date < minDateOnly;
  };

  const isSelectedDate = (day: number) => {
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  const handleDayPress = (day: number) => {
    if (isDateDisabled(day)) return;
    const newDate = new Date(year, month, day);
    onSelectDate(newDate);
    onClose();
  };

  return (
    <View style={[styles.calendar, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.calendarHeader}>
        <Pressable onPress={goToPrevMonth} style={styles.calendarNavButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.tint} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.calendarTitle}>
          {monthNames[month]} {year}
        </ThemedText>
        <Pressable onPress={goToNextMonth} style={styles.calendarNavButton}>
          <IconSymbol name="chevron.right" size={20} color={colors.tint} />
        </Pressable>
      </View>

      {/* Day names */}
      <View style={styles.calendarWeekRow}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <View key={day} style={styles.calendarDayCell}>
            <ThemedText 
              style={[styles.calendarDayName, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={1.2}
            >
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Days grid */}
      <View style={styles.calendarGrid}>
        {days.map((day, index) => (
          <View key={index} style={styles.calendarDayCell}>
            {day !== null && (
              <Pressable
                onPress={() => handleDayPress(day)}
                disabled={isDateDisabled(day)}
                style={[
                  styles.calendarDay,
                  isSelectedDate(day) && { backgroundColor: colors.tint },
                  isDateDisabled(day) && styles.calendarDayDisabled,
                ]}
              >
                <ThemedText
                  style={[
                    styles.calendarDayText,
                    isSelectedDate(day) && styles.calendarDayTextSelected,
                    isDateDisabled(day) && { color: colors.textDisabled },
                  ]}
                  maxFontSizeMultiplier={1.2}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {day}
                </ThemedText>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {/* Close button */}
      <Pressable
        style={[styles.calendarCloseButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onClose}
      >
        <ThemedText maxFontSizeMultiplier={1.3}>Cancel</ThemedText>
      </Pressable>
    </View>
  );
}

export default function AddTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const utils = trpc.useUtils();
  const createMutation = trpc.trips.create.useMutation({
    onSuccess: (data) => {
      utils.trips.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error) => {
      console.error("Failed to create trip:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripEndDate = new Date(endDate);
    tripEndDate.setHours(0, 0, 0, 0);

    const createTrip = () => {
      createMutation.mutate({
        name: name.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    };

    // Check if trip is in the past
    if (tripEndDate < today) {
      Alert.alert(
        "Past Trip",
        "This trip's dates are in the past. Are you sure you want to create it?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Create Anyway", onPress: createTrip },
        ]
      );
    } else {
      createTrip();
    }
  }, [name, startDate, endDate, createMutation]);

  const handleStartDateSelect = (date: Date) => {
    setStartDate(date);
    // If end date is before start date, adjust it
    if (date > endDate) {
      setEndDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  const handleEndDateSelect = (date: Date) => {
    if (date >= startDate) {
      setEndDate(date);
    }
  };

  const isValid = name.trim().length > 0 && endDate >= startDate;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </Pressable>
          <ThemedText type="subtitle">New Trip</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Trip Name */}
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Trip Name
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g., Hungary Aug 2025"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="done"
            />
          </View>

          {/* Start Date */}
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Start Date
            </ThemedText>
            <Pressable
              style={[
                styles.dateButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowStartPicker(true);
              }}
            >
              <IconSymbol name="calendar" size={20} color={colors.tint} />
              <ThemedText>{startDate.toLocaleDateString()}</ThemedText>
              <View style={{ flex: 1 }} />
              <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* End Date */}
          <View style={styles.field}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              End Date
            </ThemedText>
            <Pressable
              style={[
                styles.dateButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowEndPicker(true);
              }}
            >
              <IconSymbol name="calendar" size={20} color={colors.tint} />
              <ThemedText>{endDate.toLocaleDateString()}</ThemedText>
              <View style={{ flex: 1 }} />
              <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </ScrollView>

        {/* Create Button */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={[
              styles.createButton,
              { backgroundColor: isValid ? colors.tint : colors.textDisabled },
            ]}
            onPress={handleCreate}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.createButtonText}>Create Trip</ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStartPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Calendar
              selectedDate={startDate}
              onSelectDate={handleStartDateSelect}
              onClose={() => setShowStartPicker(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEndPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Calendar
              selectedDate={endDate}
              onSelectDate={handleEndDateSelect}
              minimumDate={startDate}
              onClose={() => setShowEndPicker(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
    gap: Spacing.lg,
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    marginLeft: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  createButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  calendar: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 17,
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarDayName: {
    fontSize: 12,
    fontWeight: "500",
  },
  calendarDay: {
    width: "85%",
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    maxWidth: 36,
    maxHeight: 36,
  },
  calendarDayDisabled: {
    opacity: 0.4,
  },
  calendarDayText: {
    fontSize: 15,
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  calendarCloseButton: {
    marginTop: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 100,
  },
});
