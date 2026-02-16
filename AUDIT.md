# TripDocHub Code Audit

**Date:** 2026-02-16
**Auditor:** Cursor (claude-4.6-opus)
**Branch with fixes:** `audit/fixes-2026-02`
**Commit:** `d8f1db7`

---

## Stack Overview

Expo 54 + React Native 0.81, Express + tRPC backend, Drizzle ORM + MySQL, Gemini 2.5 Flash via Manus Forge API, Mailgun for inbound email, Expo Push for notifications.

---

## PART 1: Authentication & "Login Limbo" Bug

### Architecture Issue: No Shared Auth State

This is the root cause of the login limbo bug. Every screen that calls `useAuth()` gets its **own independent copy** of user/loading state:

```typescript
// hooks/use-auth.ts
export function useAuth(options?: UseAuthOptions) {
  const [user, setUser] = useState<Auth.User | null>(null);   // independent per component
  const [loading, setLoading] = useState(true);                // independent per component
```

There is no `AuthProvider` / `AuthContext`. When the Home screen mounts, it runs its own `useAuth()`, starting fresh with `user = null`, `loading = true`. If the API call fails, is slow, or the session/cookie isn't available yet, the screen shows the login UI while other tabs may independently resolve auth fine.

### The "Login Limbo" Scenario (Most Likely Path)

1. User signs up via OAuth, gets redirected back, `oauth/callback.tsx` stores token + user in SecureStore.
2. App navigates to `/(tabs)` -- Home screen mounts, its `useAuth()` runs.
3. On **native**, the fast path reads cached user from SecureStore:

```typescript
// hooks/use-auth.ts, useEffect
Auth.getUserInfo().then((cachedUser) => {
  if (cachedUser) {
    setUser(cachedUser);
    setLoading(false);
  } else {
    fetchUser();   // falls through to API call
  }
});
```

**Problem**: If `getUserInfo()` returns `null` (because SecureStore write from OAuth callback hasn't flushed yet, or it's web with a cookie issue), it falls through to `fetchUser()`. If `fetchUser()` also fails (network, CORS, cookie not set), `user` stays `null` and the login UI is shown permanently.

4. On **web** specifically, the OAuth callback only sets a cookie -- no token/user in the redirect URL:

```typescript
// server/_core/oauth.ts
const frontendUrl =
  process.env.EXPO_WEB_PREVIEW_URL ||
  process.env.EXPO_PACKAGER_PROXY_URL ||
  "http://localhost:8081";
res.redirect(302, frontendUrl);
```

If the cookie domain doesn't match (server on port 3000, frontend on 8081), or SameSite/ITP blocks it, `/api/auth/me` returns 401 and the user is stuck on login forever.

5. Any `getMe()` failure clears the cached user too, making this **permanent**:

```typescript
// hooks/use-auth.ts
} else {
  console.log("[useAuth] Web: No authenticated user from API");
  setUser(null);
  await Auth.clearUserInfo();   // nukes the cached user
}
```

### Additional Auth Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | No `AuthProvider` context -- each screen/component gets independent auth state | **Critical** |
| 2 | Web OAuth relies solely on cookies; no fallback token in redirect URL | **High** |
| 3 | `getMe()` failure clears cached user -- transient network error = forced logout | **High** |
| 4 | Cached user on native is never revalidated against the server | **Medium** |
| 5 | No refresh token mechanism; 1-year JWT with no rotation | **Medium** |

### Fix Applied (branch `audit/fixes-2026-02`)

- Created `contexts/auth-context.tsx` with a centralized `AuthProvider` that holds a single source of truth.
- `hooks/use-auth.ts` now re-exports from the provider (preserves all existing import paths).
- `app/_layout.tsx` wraps the app in `AuthProvider` inside tRPC/QueryClient providers.
- On network errors, the provider does NOT clear the cached user (only on explicit 401).

### Still Recommended (not implemented)

- Web OAuth: append `?session_token=xxx&user=base64(...)` to the redirect URL as a fallback when cookies fail.
- Add a refresh token mechanism with silent refresh.
- Periodically revalidate the cached user against the server on native.

---

## PART 2: Push Notification Token (Old Android Failure)

### Bug 1: Channel Not Awaited Before Token Request

This is the smoking gun for the old Android failure:

```typescript
// hooks/use-push-token.ts (BEFORE fix)
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("email_processing", { ... });
  // ^^^ NOT AWAITED
}
registerToken();   // runs immediately, calls getExpoPushTokenAsync()
```

`setNotificationChannelAsync` is **not awaited**. `registerToken()` runs immediately and calls `getExpoPushTokenAsync()`. On Android 13+, the notification channel **must exist before** requesting the push token (per Expo docs). On older/slower Android devices, the channel creation is still in-flight when the token request fires, causing it to fail silently.

### Bug 2: No Retry Logic

```typescript
if (!isAuthenticated || !user || hasRegistered.current) {
  return;   // early exit, never retried
}
```

If registration fails once (channel not ready, network issue, FCM failure on old device), `hasRegistered` stays `false` but the effect never re-fires because `isAuthenticated` and `user` haven't changed. There is **zero retry** within the session.

### Bug 3: Stale Auth State After OAuth

`PushTokenRegistration` in `_layout.tsx` uses its own `useAuth()`:

```typescript
function PushTokenRegistration() {
  const { usePushTokenRegistration } = require("@/hooks/use-push-token");
  usePushTokenRegistration();   // calls useAuth() internally -- independent state!
  return null;
}
```

After OAuth, the `useAuth()` inside `PushTokenRegistration` may still have `user = null` because it was an independent state. Registration is skipped entirely for the first session after signup. The token only gets registered on the **next app cold start** when cached user is available.

### Push Notification Issues Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | `setNotificationChannelAsync` not awaited before `registerToken()` | **Critical** |
| 2 | No retry logic after failure | **Critical** |
| 3 | Auth state not shared -- registration may skip entirely after OAuth | **High** |
| 4 | No `Device.isDevice` guard (token request on emulators will fail) | **Low** |
| 5 | Older Android devices may return empty FCM tokens -- no handling | **Medium** |

### Fix Applied (branch `audit/fixes-2026-02`)

- `setNotificationChannelAsync` is now **awaited** inside `registerToken()` before calling `getExpoPushTokenAsync()`.
- Added retry logic: 3 attempts with exponential backoff (2s, 5s, 10s).
- Added `AppState` listener to re-attempt registration when app returns to foreground.
- Auth state is now shared via `AuthProvider` (fixes Bug 3).

---

## PART 3: LLM Prompt & SKIDEAL Image Parsing Failure

### Why the SKIDEAL Itinerary Failed

The image contained: flight (ISRAIR 6H301, TLV -> BGY), hotel (Miramonti, Passo Tonale, 7 nights), transfers, and skipass. Several issues compound:

#### 1. BGY (Orio al Serio) missing from `AIRPORT_CODES`

```typescript
// server/documentParser.ts
const AIRPORT_CODES: Record<string, string> = {
  // ... many airports listed ...
  VRN: "Verona Villafranca Airport, Italy",
  VCE: "Venice Marco Polo Airport",
  BLQ: "Bologna Guglielmo Marconi Airport",
  // BGY is NOT here
};
```

The LLM may correctly extract BGY as the arrival airport, but post-processing can't resolve its address.

#### 2. No concept of "transfers" or "skipass" in the prompt

The `DOCUMENT_PARSING_PROMPT` lists these categories:
- flight, carRental, accommodation, medical, event, other

Transfers and skipasses aren't mentioned in the mandatory fields or examples. The prompt says to use "other" for anything that doesn't fit, but there's no guidance on what fields to extract for "other" documents.

#### 3. No composite document example

The prompt says "Return JSON with 'documents' array" but never shows an example of a single image containing multiple booking types. The LLM may not know to split this into 4 separate documents (flight + hotel + transfer + skipass).

#### 4. Thinking budget of only 128 tokens

```typescript
// server/_core/llm.ts
payload.thinking = {
  budget_tokens: 128,   // far too low for complex documents
};
```

128 thinking tokens is **extremely low** for parsing a complex multi-section travel itinerary with Hebrew text, multiple booking types, and visual layout. The model barely has room to reason before generating output.

#### 5. Image URL accessibility

The image is uploaded to Forge storage and the URL is passed to Gemini. If Gemini cannot fetch the URL (presigned URL expired, auth required, region restrictions), parsing fails silently.

#### 6. Error fallback masks failures

```typescript
} catch (error) {
  return {
    documents: [{
      category: "other",
      documentType: "Document",
      title: "Uploaded Document",   // phantom card that hides the real error
      subtitle: null,
      details: {},
      documentDate: null,
    }],
    contentHash,
  };
}
```

On any error, a useless "Uploaded Document" card is created instead of signaling failure.

#### 7. 8-second timeout race

```typescript
const timeoutMs = 8000;
const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
await Promise.race([processingPromise, timeoutPromise]);
```

A complex image upload + LLM parsing can easily exceed 8 seconds. If the timeout wins the race, the response is sent but the processing promise may be killed in serverless environments.

### LLM Prompt Quality Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Structure & organization | Good | Clear sections, mandatory fields, categories |
| Flight parsing | Good | Detailed IATA code handling, airline, times |
| Hotel parsing | Good | Address, phone, dates covered |
| Date parsing | Good | Multi-format, Hebrew support |
| Category coverage | **Weak** | No transfers, skipasses, train/bus handled as "other" with no field guidance |
| Composite documents | **Weak** | No few-shot example showing multi-document extraction from a single image |
| Multilingual | Fair | Hebrew terms listed but no Italian; the image had Hebrew + English + Italian |
| Error resilience | **Weak** | Fallback creates fake document instead of signaling failure |
| Thinking budget | **Weak** | 128 tokens is far too low for complex documents |

### Fix Applied (branch `audit/fixes-2026-02`)

- Added BGY + 8 other ski/winter destination airports (INN, SZG, TRN, GVA, LYS, GNB, TRS, LJU).
- Increased thinking budget from 128 to 2048 tokens.
- Added `TRANSFERS` and `ACTIVITIES & PASSES` sections to the prompt with mandatory fields.
- Added a full composite ski package example (flight + hotel + transfer + skipass) in the prompt.
- Added Italian terms to multilingual support.
- Changed error fallback to return `documents: []` instead of a phantom "Uploaded Document" card.
- Mailgun webhook now responds 200 immediately and processes fully in background (no more timeout race).

### Still Recommended (not implemented)

- Add base64 fallback when the image URL is inaccessible to Gemini.
- Track parse failure metrics/analytics for monitoring.
- Consider running both attachment parsing AND email body parsing when both are available (currently it's one or the other).

---

## PART 4: Security Notes

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Mailgun webhook signature verification skipped when `MAILGUN_WEBHOOK_SIGNING_KEY` is empty -- anyone can POST fake emails in production | **Critical** | **Fixed** -- now rejects in production |
| 2 | Session JWT valid for 1 year with no rotation or revocation mechanism | **Medium** | Not fixed |
| 3 | `google-services.json` is committed to the repo (not secrets per se, but best practice is to keep out of public repos) | **Low** | Not fixed |

---

## Priority Fix List

| Priority | Fix | Impact | Status |
|----------|-----|--------|--------|
| P0 | **Await** `setNotificationChannelAsync` before `registerToken()` on Android | Fixes old Android push token failure | **Done** |
| P0 | **Create `AuthProvider`** context to share auth state across all screens | Fixes login limbo bug | **Done** |
| P0 | Increase LLM **thinking budget** from 128 to 2048 tokens | Fixes complex document parsing | **Done** |
| P1 | Add **retry logic** for push token registration (3 attempts + AppState re-trigger) | Robustness for all devices | **Done** |
| P1 | Add **BGY** and other ski airports to `AIRPORT_CODES` | Fixes SKIDEAL case | **Done** |
| P1 | Add **transfer/skipass** guidance to the LLM prompt with composite example | Better composite itinerary parsing | **Done** |
| P1 | Don't clear cached user on transient `getMe()` failures | Prevents unnecessary logouts | **Done** |
| P1 | Require `MAILGUN_WEBHOOK_SIGNING_KEY` in production | Security | **Done** |
| P1 | Respond 200 to Mailgun immediately, process fully async | Avoids timeout race | **Done** |
| P2 | Return `documents: []` on parse error instead of fake "Uploaded Document" | Better error visibility | **Done** |
| P2 | Web OAuth: add token fallback in redirect URL | Fixes web cookie issues | Not done |
| P2 | Add refresh token mechanism | Session security | Not done |
| P2 | Add base64 fallback for image parsing when URL is inaccessible | Parsing robustness | Not done |
| P3 | Add `Device.isDevice` check before push token request | Dev environment robustness | Not done |
| P3 | Track parse failure metrics | Observability | Not done |

---

## Files Changed

| File | What changed |
|------|-------------|
| `contexts/auth-context.tsx` | **New** -- centralized `AuthProvider` with single source of truth for auth state |
| `hooks/use-auth.ts` | Now a thin re-export from `AuthProvider` (all existing imports keep working) |
| `app/_layout.tsx` | Wraps app in `AuthProvider` inside tRPC/QueryClient providers |
| `hooks/use-push-token.ts` | `await` channel creation before token request, retry logic (3 attempts + backoff), foreground re-attempt |
| `server/_core/llm.ts` | Thinking budget 128 -> 2048 tokens |
| `server/documentParser.ts` | Added BGY + 8 ski airports, transfers/skipass/composite doc in prompt with example, empty array on parse error |
| `server/webhooks/mailgun.ts` | Respond 200 immediately then process async, require signing key in production, log 0-document parse results |
