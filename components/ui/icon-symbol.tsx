// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols to Material Icons mappings for TripDocHub
 */
const MAPPING = {
  // Tab bar icons
  "house.fill": "home",
  "suitcase.fill": "luggage",
  "tray.fill": "inbox",
  "person.fill": "person",
  
  // Navigation
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  "xmark": "close",
  
  // Actions
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "trash.fill": "delete",
  "archivebox.fill": "archive",
  "pencil": "edit",
  "square.and.arrow.up": "share",
  "doc.viewfinder": "document-scanner",
  "camera.fill": "photo-camera",
  "photo.fill": "photo-library",
  "arrow.right.arrow.left": "swap-horiz",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  
  // Document categories
  "airplane": "flight",
  "car.fill": "directions-car",
  "bed.double.fill": "hotel",
  "cross.case.fill": "local-hospital",
  "ticket.fill": "confirmation-number",
  "doc.fill": "description",
  "folder.fill": "folder",
  
  // Status & info
  "envelope.fill": "email",
  "doc.on.clipboard": "content-paste",
  "calendar": "event",
  "clock.fill": "schedule",
  "location.fill": "location-on",
  "phone.fill": "phone",
  "info.circle.fill": "info",
  "exclamationmark.triangle.fill": "warning",
  
  // Legal
  "doc.text.fill": "article",
  
  // Support
  "play.fill": "play-arrow",
  
  // Misc
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "gearshape.fill": "settings",
  "arrow.clockwise": "refresh",
  "magnifyingglass": "search",
  
  // Theme & Settings
  "sun.max.fill": "light-mode",
  "moon.fill": "dark-mode",
  "gear": "settings",
  "lock.fill": "lock",
  "bell.fill": "notifications",
  "trash": "delete-outline",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

export type { IconSymbolName };
