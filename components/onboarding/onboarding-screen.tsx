import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  FlatList,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, BorderRadius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  CreateTripIllustration,
  ForwardEmailIllustration,
  UploadDocumentIllustration,
  DocumentParsedIllustration,
  ViewOriginalIllustration,
} from "./illustrations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  Illustration: React.ComponentType<{ width?: number; height?: number; animate?: boolean }>;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "1",
    title: "Create A Trip",
    description: "",
    Illustration: CreateTripIllustration,
  },
  {
    id: "2",
    title: "Forward Confirmation Emails",
    description: "",
    Illustration: ForwardEmailIllustration,
  },
  {
    id: "3",
    title: "Or Upload Documents",
    description: "",
    Illustration: UploadDocumentIllustration,
  },
  {
    id: "4",
    title: "All Details At A Glance",
    description: "",
    Illustration: DocumentParsedIllustration,
  },
  {
    id: "5",
    title: "One Click to Call, Email, Navigate",
    description: "",
    Illustration: ViewOriginalIllustration,
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderItem = ({ item, index }: { item: OnboardingStep; index: number }) => {
    const isActive = index === currentIndex;
    
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View style={styles.illustrationContainer}>
          <item.Illustration 
            width={SCREEN_WIDTH * 0.93} 
            height={340} 
            animate={isActive}
          />
        </View>
        <View style={styles.textContainer}>
          <ThemedText type="title" style={styles.title}>
            {item.title}
          </ThemedText>
          {item.description ? (
            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
              {item.description}
            </ThemedText>
          ) : null}
        </View>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.pagination}>
        {ONBOARDING_STEPS.map((_, index) => {
          const dotStyle = useAnimatedStyle(() => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];
            
            const width = interpolate(
              scrollX.value,
              inputRange,
              [8, 24, 8],
              Extrapolation.CLAMP
            );
            
            const opacity = interpolate(
              scrollX.value,
              inputRange,
              [0.3, 1, 0.3],
              Extrapolation.CLAMP
            );
            
            return {
              width,
              opacity,
            };
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: colors.tint },
                dotStyle,
              ]}
            />
          );
        })}
      </View>
    );
  };

  const isLastStep = currentIndex === ONBOARDING_STEPS.length - 1;

  return (
    <ThemedView style={styles.container}>
      {/* Skip button */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        {!isLastStep && (
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <ThemedText style={[styles.skipText, { color: colors.textSecondary }]}>
              Skip
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_STEPS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={(event) => {
          scrollX.value = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      />

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        {renderPagination()}
        
        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.tint }]}
          onPress={handleNext}
        >
          <ThemedText style={styles.nextButtonText}>
            {isLastStep ? "Get Started" : "Next"}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  skipButton: {
    padding: Spacing.sm,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    maxHeight: 460,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: 26,
    textAlign: "center",
    marginBottom: Spacing.sm,
    lineHeight: 32,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.sm,
  },
  bottomSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
});
