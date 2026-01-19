# Expo Push Notification Requirements

## Key Finding
The `projectId` is required for `getExpoPushTokenAsync()` to work. This is the **EAS Project ID** (UUID), NOT the Firebase project ID.

## How projectId is obtained
```javascript
const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
```

## The Problem
- We're building APKs outside of EAS Build
- The APK doesn't have an EAS projectId embedded
- Without projectId, `getExpoPushTokenAsync()` fails
- The code falls back to Manus notifications

## Solutions

### Option 1: Use EAS Build (Recommended)
- Create an EAS project on expo.dev
- Run `eas build` to build the APK
- The projectId will be automatically embedded

### Option 2: Hardcode a projectId
- Create an EAS project on expo.dev
- Get the projectId (UUID) from the project settings
- Hardcode it in app.config.ts extra.eas.projectId

### Option 3: Use FCM directly (bypass Expo Push)
- Use `getDevicePushTokenAsync()` instead of `getExpoPushTokenAsync()`
- Send notifications directly via FCM API
- Requires server-side FCM integration

## Current Status
- google-services.json is configured correctly
- FCM is set up in Firebase
- But we need an EAS projectId for Expo Push tokens to work
