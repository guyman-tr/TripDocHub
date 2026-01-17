# Push Notification Research

## Key Finding
**FCM (Firebase Cloud Messaging) setup is REQUIRED for standalone Android APK builds to receive push notifications.**

Source: https://github.com/expo/expo/issues/9770

## The Problem
- `getExpoPushTokenAsync()` fails in standalone APK builds with error "Fetching the token failed: Given string is empty or null"
- Works fine in Expo Go but not in production APK
- The Expo Push API requires an Expo Push Token, which requires FCM to be configured for Android

## Solution Options

### Option 1: Setup FCM (Firebase Cloud Messaging)
1. Create a Firebase project
2. Download `google-services.json` 
3. Configure in app.config.ts
4. See: https://docs.expo.dev/push-notifications/using-fcm

### Option 2: Use EAS Build with projectId
- EAS Build automatically configures FCM
- Need to add `extra.eas.projectId` to app.config.ts
- The projectId is obtained when running `eas build`

## Current Status
The APK is built without FCM configuration, so:
1. `getExpoPushTokenAsync()` fails
2. No push token is registered with the server
3. Server cannot send push notifications to the device

## Recommendation
For now, since FCM setup requires Firebase credentials, we should:
1. Fall back to using the platform-level `notifyOwner` for email processing notifications
2. Document that native push notifications require FCM setup
3. Add local notifications for in-app feedback when the user is using the app
