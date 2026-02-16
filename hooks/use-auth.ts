/**
 * AUDIT FIX: useAuth is now a thin re-export from the centralized AuthProvider.
 *
 * Previously this file contained a standalone hook with local state, meaning
 * every component that called useAuth() had its own independent user/loading
 * state. This caused the "login limbo" bug where the Home screen could show
 * a login page while other screens were authenticated.
 *
 * All auth state is now held in AuthProvider (contexts/auth-context.tsx).
 * This re-export preserves the existing import path (@/hooks/use-auth)
 * so no other files need to change.
 */
export { useAuth } from "@/contexts/auth-context";
