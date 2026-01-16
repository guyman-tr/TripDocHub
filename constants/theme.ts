/**
 * TripDocHub Theme Configuration
 * Colors follow iOS Human Interface Guidelines with travel-inspired accents
 */

import { Platform } from "react-native";

// Primary brand colors
const tintColorLight = "#007AFF"; // iOS Blue
const tintColorDark = "#0A84FF"; // iOS Blue (Dark)

export const Colors = {
  light: {
    text: "#000000",
    textSecondary: "#8E8E93",
    textDisabled: "#C7C7CC",
    background: "#F2F2F7",
    surface: "#FFFFFF",
    tint: tintColorLight,
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: tintColorLight,
    success: "#34C759",
    warning: "#FF9500",
    destructive: "#FF3B30",
    border: "#C6C6C8",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    textDisabled: "#48484A",
    background: "#000000",
    surface: "#1C1C1E",
    tint: tintColorDark,
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: tintColorDark,
    success: "#30D158",
    warning: "#FF9F0A",
    destructive: "#FF453A",
    border: "#38383A",
  },
};

// Document category colors
export const CategoryColors = {
  flight: "#5856D6", // Purple
  carRental: "#FF9500", // Orange
  accommodation: "#34C759", // Green
  medical: "#FF3B30", // Red
  event: "#AF52DE", // Magenta
  other: "#8E8E93", // Gray
};

// Category icons (SF Symbols names)
export const CategoryIcons = {
  flight: "airplane",
  carRental: "car.fill",
  accommodation: "bed.double.fill",
  medical: "cross.case.fill",
  event: "ticket.fill",
  other: "doc.fill",
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Spacing constants (8pt grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Border radius constants
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
