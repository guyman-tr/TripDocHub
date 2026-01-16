import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { FontScaling } from "@/constants/accessibility";

// Simple inline calendar component
function Calendar({
  selectedDate,
  onSelectDate,
  minimumDate,
  colors,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  minimumDate?: Date;
  colors: any;
}) {
  const [viewDate, setViewDate] = useState(selectedDate);

  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();
  const firstDayOfMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      viewDate.getMonth() === selectedDate.getMonth() &&
      viewDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isDisabled = (day: number) => {
    if (!minimumDate) return false;
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return date < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate());
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  return (
    <View style={[calendarStyles.container, { backgroundColor: colors.surface }]}>
      <View style={calendarStyles.header}>
        <Pressable onPress={prevMonth} style={calendarStyles.navButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.tint} />
        </Pressable>
        <ThemedText type="defaultSemiBold" maxFontSizeMultiplier={FontScaling.label}>
          {viewDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </ThemedText>
        <Pressable onPress={nextMonth} style={calendarStyles.navButton}>
          <IconSymbol name="chevron.right" size={20} color={colors.tint} />
        </Pressable>
      </View>

      <View style={calendarStyles.weekDays}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <ThemedText
            key={day}
            style={[calendarStyles.weekDay, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={FontScaling.label}
          >
            {day}
          </ThemedText>
        ))}
      </View>

      <View style={calendarStyles.daysGrid}>
        {days.map((day, index) => (
          <Pressable
            key={index}
            style={[
              calendarStyles.dayCell,
              day !== null && isSelected(day) ? { backgroundColor: colors.tint } : null,
              day !== null && isDisabled(day) ? calendarStyles.disabledDay : null,
            ]}
            onPress={() => {
              if (day && !isDisabled(day)) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
                );
              }
            }}
            disabled={!day || isDisabled(day)}
          >
            {day && (
              <ThemedText
                style={[
                  calendarStyles.dayText,
                  isSelected(day) && calendarStyles.selectedDayText,
                  isDisabled(day) && { color: colors.textSecondary, opacity: 0.4 },
                ]}
                maxFontSizeMultiplier={FontScaling.button}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {day}
              </ThemedText>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const calendarStyles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  navButton: {
    padding: Spacing.sm,
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.full,
  },
  dayText: {
    fontSize: 16,
  },
  selectedDayText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  disabledDay: {
    opacity: 0.3,
  },
});

export default function EditTripScreen() {
  const { id, name: initialName, startDate: initialStart, endDate: initialEnd } = useLocalSearchParams<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated } = useAuth();

  const tripId = parseInt(id || "0", 10);

  const [name, setName] = useState(initialName || "");
  const [startDate, setStartDate] = useState(
    initialStart ? new Date(initialStart) : new Date()
  );
  const [endDate, setEndDate] = useState(
    initialEnd ? new Date(initialEnd) : new Date()
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const utils = trpc.useUtils();

  const updateMutation = trpc.trips.update.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      utils.trips.list.invalidate();
      utils.trips.get.invalidate({ id: tripId });
      router.back();
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a trip name");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(0, 0, 0, 0);

    // Check if trip dates are in the past
    if (endDateNormalized < today) {
      Alert.alert(
        "Past Trip Dates",
        "This trip's dates are in the past. Are you sure you want to save?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save Anyway",
            onPress: () => {
              updateMutation.mutate({
                id: tripId,
                name: name.trim(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
              });
            },
          },
        ]
      );
    } else {
      updateMutation.mutate({
        id: tripId,
        name: name.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    }
  }, [name, startDate, endDate, tripId, updateMutation]);

  // Adjust end date if start date is changed to be after end date
  useEffect(() => {
    if (startDate > endDate) {
      setEndDate(startDate);
    }
  }, [startDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 20), backgroundColor: colors.tint },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <ThemedText style={styles.headerButtonText} maxFontSizeMultiplier={FontScaling.button}>
            Cancel
          </ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle} maxFontSizeMultiplier={FontScaling.title}>
          Edit Trip
        </ThemedText>
        <Pressable
          onPress={handleSave}
          style={styles.headerButton}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.headerButtonText} maxFontSizeMultiplier={FontScaling.button}>
              Save
            </ThemedText>
          )}
        </Pressable>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Trip Name */}
        <View style={styles.field}>
          <ThemedText style={styles.label} maxFontSizeMultiplier={FontScaling.label}>
            Trip Name
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Summer Vacation 2026"
            placeholderTextColor={colors.textSecondary}
            maxFontSizeMultiplier={FontScaling.body}
          />
        </View>

        {/* Start Date */}
        <View style={styles.field}>
          <ThemedText style={styles.label} maxFontSizeMultiplier={FontScaling.label}>
            Start Date
          </ThemedText>
          <Pressable
            style={[
              styles.dateButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowStartPicker(true)}
          >
            <IconSymbol name="calendar" size={20} color={colors.tint} />
            <ThemedText style={styles.dateText} maxFontSizeMultiplier={FontScaling.body}>
              {formatDate(startDate)}
            </ThemedText>
          </Pressable>
        </View>

        {/* End Date */}
        <View style={styles.field}>
          <ThemedText style={styles.label} maxFontSizeMultiplier={FontScaling.label}>
            End Date
          </ThemedText>
          <Pressable
            style={[
              styles.dateButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowEndPicker(true)}
          >
            <IconSymbol name="calendar" size={20} color={colors.tint} />
            <ThemedText style={styles.dateText} maxFontSizeMultiplier={FontScaling.body}>
              {formatDate(endDate)}
            </ThemedText>
          </Pressable>
        </View>
      </View>

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
          <View style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle} maxFontSizeMultiplier={FontScaling.title}>
              Start Date
            </ThemedText>
            <Calendar
              selectedDate={startDate}
              onSelectDate={(date) => {
                setStartDate(date);
                setShowStartPicker(false);
              }}
              colors={colors}
            />
            <Pressable
              style={[styles.modalButton, { borderColor: colors.border }]}
              onPress={() => setShowStartPicker(false)}
            >
              <ThemedText maxFontSizeMultiplier={FontScaling.button}>Cancel</ThemedText>
            </Pressable>
          </View>
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
          <View style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle} maxFontSizeMultiplier={FontScaling.title}>
              End Date
            </ThemedText>
            <Calendar
              selectedDate={endDate}
              onSelectDate={(date) => {
                setEndDate(date);
                setShowEndPicker(false);
              }}
              minimumDate={startDate}
              colors={colors}
            />
            <Pressable
              style={[styles.modalButton, { borderColor: colors.border }]}
              onPress={() => setShowEndPicker(false)}
            >
              <ThemedText maxFontSizeMultiplier={FontScaling.button}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  headerButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minWidth: 60,
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  form: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  dateText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalButton: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
});
