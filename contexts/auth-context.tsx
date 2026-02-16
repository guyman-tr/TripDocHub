/**
 * AUDIT FIX: Centralized AuthProvider context.
 *
 * Previously every screen/component that called useAuth() got its own independent
 * copy of user/loading state, causing race conditions where one screen could show
 * the login UI while another was authenticated. This was the root cause of the
 * "login limbo" bug where a user who had signed up would see a login page
 * instead of the home screen.
 *
 * Now auth state is held in a single React context so all consumers share one
 * source of truth.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Api from "@/lib/api";
import * as Auth from "@/lib/auth";

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  /** Directly set user after OAuth without waiting for a re-fetch */
  setAuthUser: (user: Auth.User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    console.log("[AuthProvider] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        console.log("[AuthProvider] Web platform: fetching user from API...");
        const apiUser = await Api.getMe();

        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
          console.log("[AuthProvider] Web user set from API");
        } else {
          console.log("[AuthProvider] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform
      console.log("[AuthProvider] Native: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        console.log("[AuthProvider] No session token, user is null");
        setUser(null);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        console.log("[AuthProvider] Using cached user info");
        setUser(cachedUser);
      } else {
        console.log("[AuthProvider] Token exists but no cached user, fetching from API...");
        try {
          const apiUser = await Api.getMe();

          if (apiUser) {
            const userInfo: Auth.User = {
              id: apiUser.id,
              openId: apiUser.openId,
              name: apiUser.name,
              email: apiUser.email,
              loginMethod: apiUser.loginMethod,
              lastSignedIn: new Date(apiUser.lastSignedIn),
            };
            setUser(userInfo);
            await Auth.setUserInfo(userInfo);
            console.log("[AuthProvider] Native user fetched from API and cached");
          } else {
            // AUDIT FIX: Only clear user when server explicitly says token is invalid (non-null response with no user).
            // A null response with a valid token likely means the token expired.
            console.warn("[AuthProvider] Token exists but API returned no user – token may be invalid");
            setUser(null);
            await Auth.clearUserInfo();
          }
        } catch (apiError) {
          // AUDIT FIX: On network errors, DON'T clear the cached user.
          // A transient network failure should not log the user out.
          console.error("[AuthProvider] Failed to fetch user from API (network?):", apiError);
          // Leave user as null since we had no cached user to fall back to
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[AuthProvider] fetchUser error:", e);
      setError(e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[AuthProvider] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const setAuthUser = useCallback((u: Auth.User) => {
    setUser(u);
    setLoading(false);
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  // Initial auth check on mount
  useEffect(() => {
    console.log("[AuthProvider] Initial auth check, platform:", Platform.OS);
    if (Platform.OS === "web") {
      fetchUser();
    } else {
      // Native: fast path reads cached user from SecureStore
      Auth.getUserInfo().then((cachedUser) => {
        if (cachedUser) {
          console.log("[AuthProvider] Native: setting cached user immediately");
          setUser(cachedUser);
          setLoading(false);
        } else {
          fetchUser();
        }
      });
    }
  }, [fetchUser]);

  useEffect(() => {
    console.log("[AuthProvider] State:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

  const value = useMemo(
    () => ({ user, loading, error, isAuthenticated, refresh: fetchUser, logout, setAuthUser }),
    [user, loading, error, isAuthenticated, fetchUser, logout, setAuthUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth – now reads from the shared AuthProvider context.
 *
 * The `autoFetch` option is preserved for backward-compatibility but is effectively
 * a no-op since the provider already fetches on mount.
 */
export function useAuth(_options?: { autoFetch?: boolean }) {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
