import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme_preference";

interface ThemeContextType {
  themePreference: ThemePreference;
  colorScheme: ColorScheme;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
          setThemePreferenceState(saved as ThemePreference);
        }
      } catch (error) {
        console.error("[Theme] Failed to load preference:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreference();
  }, []);

  // Calculate effective color scheme
  const colorScheme: ColorScheme = 
    themePreference === "system" 
      ? (systemColorScheme ?? "light") 
      : themePreference;

  // Save preference
  const setThemePreference = useCallback(async (preference: ThemePreference) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
      setThemePreferenceState(preference);
    } catch (error) {
      console.error("[Theme] Failed to save preference:", error);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        colorScheme,
        setThemePreference,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Hook for components that just need the color scheme (backward compatible)
export function useColorScheme(): ColorScheme {
  const context = useContext(ThemeContext);
  // If not within provider, fall back to system
  if (context === undefined) {
    const systemScheme = useSystemColorScheme();
    return systemScheme ?? "light";
  }
  return context.colorScheme;
}
