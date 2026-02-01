# TripDocHub - Project TODO

## Core Setup
- [x] Generate custom app logo
- [x] Configure app branding (name, colors, theme)
- [x] Set up database schema for trips and documents

## User Authentication
- [x] OAuth login integration (already scaffolded)
- [x] Unique email forwarding address per user

## Trip Management
- [x] Create trip (with name, date from, date to)
- [x] View list of trips
- [x] Delete trip
- [x] Toggle between trips
- [x] Trip detail view with categorized documents

## Document Categories (Expandable/Collapsible)
- [x] Flights info container
- [x] Car rental info container
- [x] Accommodation info container
- [x] Medical insurance info container
- [x] Event booking info container
- [x] Other documents container

## Document Processing
- [x] Upload document (PDF, image)
- [x] Photograph document (camera capture)
- [x] AI parsing with LLM vision model
- [x] Structured JSON output extraction
- [x] Document categorization (Flight, Accommodation, Car Rental, etc.)
- [x] Document type identification (eTicket, Boarding Pass, Confirmation, etc.)

## Inbox System
- [x] Central inbox for unassigned documents
- [x] Auto-assign documents to trips based on dates
- [x] Manual assignment modal for uncertain documents
- [x] Reassign document to different trip

## Email Forwarding
- [x] Unique forwarding email per user (trip-inbox-xxx@triphub.dev)
- [x] Mailgun webhook integration
- [x] Parse email attachments

## Document Management
- [x] View parsed document details
- [x] Open original document
- [x] Delete document
- [x] Duplication checker (compare to previous versions)

## UI/UX
- [x] iOS-style native look and feel
- [x] Dark/light mode support
- [x] Expandable/collapsible containers
- [x] Sub-containers for document hierarchy
- [x] Bottom tab navigation
- [x] Modal interfaces for document assignment

## State Persistence
- [x] AsyncStorage for local data persistence
- [x] Cloud sync via database


## Bugs
- [x] Authentication fails when clicking Sign In button
- [x] Date fields in Add Trip screen are not clickable - need calendar picker
- [x] Document upload works on mobile (photo capture, AI parsing, appears in inbox)

## New Features
- [x] Auto-assign documents to trips based on dates, with manual fallback prompt when no match found
- [x] View original document button in document detail view
- [x] Horizontal carousel for trips on home screen (swipeable cards)
- [x] Show document type (eTicket) as main title in trip detail cards, with route/title as secondary
- [x] Location pin button on documents with addresses - opens native maps app for navigation
- [x] Configure Mailgun email forwarding with in.mytripdochub.com domain

## Pre-Launch Requirements
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Onboarding flow for new users (animated SVG illustrations)
- [x] Replay Tutorial button in Profile settings
- [ ] Onboarding adjustments: bigger illustrations, remove booking screen, add upload screen, annotate icons, rename last screen

## Payment System (Google Play Billing - pending verification)
- [x] Stripe setup guide for user (shelved - Israel not supported)
- [x] Add credits field to database (default 20 free credits)
- [x] Credits API endpoints
- [x] Credits UI in Profile screen
- [x] Credit check before document processing
- [x] Credit deduction on document processing
- [x] Placeholder purchase buttons (connect to Google Play later)
- [x] Onboarding adjustments: bigger illustrations, remove booking screen, add upload screen, annotate icons, rename last screen

## Store Listing
- [x] Add public privacy policy web endpoint
- [x] Add public terms of service web endpoint
- [x] Update app logo with new design

## Bugs
- [x] Fix Unauthorized error on document upload in production APK (added Bearer token auth)

## Landing Page (mytripdochub.com)
- [x] Create landing page with app description and features
- [x] Add app screenshots/mockups
- [x] Include Google Play Store download link
- [x] Add Privacy Policy and Terms of Service sections
- [x] Package for deployment to free hosting (Netlify/Vercel)
- [x] Provide GoDaddy DNS configuration instructions


## Google Play Billing & Payments
- [x] Implement Google Play Billing for credit purchases
- [ ] Create in-app products in Google Play Console
- [x] Add coupon/promo code system for free credits (testing bypass)
- [x] Handle purchase verification on backend
- [x] Update credits after successful purchase

## Production Backend URL
- [ ] Discover/confirm production backend URL for Mailgun webhook

## Bugs (Active)
- [x] Fix credit consumption - credits UI not refreshing after document processing (added invalidation)
- [x] Fix trash buttons not responding in inbox
- [x] Fix duplicate document creation from Mailgun webhook retries

## UI Improvements
- [x] Add trash icon to inbox document items for easy deletion of duplicates
- [x] Add Clear All button to inbox header to delete all documents at once
- [x] Add confirmation dialog for delete actions (individual and Clear All)
- [x] Add archive functionality for trips (archive vs delete option)
- [x] Add long-press on Home screen trip cards
- [x] Add archived trips section in Trips screen
- [x] Create archived trips list screen
- [x] Delete trip should also delete associated documents
- [x] Make archived trips button more prominent/visible
- [x] Add swipe-left gesture for archive/delete on trip cards
- [x] Make archived trips button more prominent and easier to find
- [x] Rename app from TripHub to TripDocHub throughout codebase
- [x] Fix calendar and buttons for large font accessibility (capped scaling + flexible layouts)
- [x] App-wide audit and fix for large font accessibility issues
- [x] Allow past dates for trip creation with warning popup
- [x] Grey out end dates before selected start date in calendar
- [x] Add swipe-to-restore/delete in archived trips list
- [x] Add restore button in trip detail view for archived trips
- [x] Implement offline-first caching to preserve app state between sessions
- [x] Auto-process documents after upload (remove manual Process button)
- [x] Add "Continue in Background" option during processing
- [x] Add trip editing (modify name and dates after creation)
- [x] Add duplicate document detection on upload
- [x] Implement smart trip notifications (7 days and 1 day before)
- [x] Add during-trip notifications (flight check-in, car return)
- [x] Add notification settings screen with toggle
- [x] Fix duplicate detection to hash actual file content instead of URL
- [x] Add theme selector (dark/light/system) to Settings
- [x] Fix Mailgun webhook timeout (async processing to respond within 10s limit)
- [x] Fix inbox showing empty when Home shows documents waiting (added refetchOnMount)
- [x] Parse email body when no attachments (extract booking details from HTML/text)
- [x] Add push notifications for email processing (received, completed, errors)
- [x] Fix push notifications to come from TripDocHub app (not Manus platform)
- [x] Debug push notifications not being received on device (FCM required for native, added fallback to Manus notifications)
- [x] Configure Firebase Cloud Messaging for native push notifications
- [x] Debug push token not being registered despite FCM configuration (added EAS projectId)
- [x] Connect Google Play one-time products to credit packages (10_credits, 50_credits, 100_credits)
- [x] Fix 'Missing purchase request configuration' error (updated to v14 API format)

## Critical Platform Issues
- [ ] CRITICAL: Signing key mismatch - AAB rejected by Google Play (platform issue)
- [ ] Expo Go connection failure - investigate environment reset
- [ ] Fix Google Play purchase "version not configured" error

## Active Bugs
- [x] Inbox screen showing empty while Home shows "2 documents in inbox" (added useFocusEffect, gcTime: 0, pull-to-refresh on empty state)
- [x] Production server hibernation causing email processing delays (scheduled keep-warm ping every 5 minutes)

## Infrastructure
- [x] Set up server keep-warm mechanism to prevent hibernation (scheduled task pings /api/health every 5 min)

## Critical Issues (Jan 24, 2026)
- [ ] In-app purchase billing not configured - "This version of the application is not configured for billing through Google Play"
- [x] Native push notifications not working (uploaded FCM credentials to Expo, push works from sandbox - needs production deploy)
- [x] Inbox count not syncing between home screen, tab badge, and inbox screen after clearing inbox (added inboxCount.invalidate to all mutations)

## Production Polish (Jan 30, 2026)
- [ ] Create GitHub repository for TripDocHub
- [x] Comprehensive QA audit of codebase (see QA_AUDIT_REPORT.md)
- [x] Document QA findings (error handling, edge cases, security, accessibility, performance)
- [ ] Polish graphic assets for Google Play listing
- [x] BUG: Dark theme prices nearly invisible (white on white) in store screen
- [x] Center app icon graphic on canvas (icon appears off-center on home and splash screens)

## Onboarding Redesign (Jan 31, 2026)
- [ ] Redesign onboarding illustrations: bigger size (93%), no explanatory text, no overflow
- [ ] Screen 1: "Create A Trip" - same visual, no subtitle
- [ ] Screen 2: "Forward All Confirmation Emails" - shorter email (123ad@triphub.com), add subject line
- [ ] Screen 3: "Take Photo / Upload File" - remove small descriptive text
- [ ] Screen 4: "All Details At A Glance" - keep parsed document visual
- [ ] Screen 5: "One Click to Call, Email, Navigate" - add 3 action icons

## Document Details Action Icons (Jan 31)
- [x] Extract phone number from document processing
- [x] Extract email address from document processing
- [x] Add 4 action icons to document details: Navigate, Call, Email, Original
- [x] Grey out icons when no data found, color when data exists
- [x] Make colored icons clickable (open maps, dial phone, compose email, view original)
- [x] Write unit tests with mock data to verify extraction and icon states

## Action Icons Improvements (Jan 31)
- [x] Move "View Original" back to prominent button at bottom (not icon)
- [x] Show original email text when no PDF/image exists (formatted nicely via WebView)
- [x] Keep only 3 icons: Navigate, Call, Email
- [x] Store original email body in database for display
- [ ] Add re-process option for existing documents to extract phone/email

## Bug Fix: Action Icons Not Showing (Jan 31)
- [x] Fix address extraction to check pickupLocation/dropoffLocation fields (not just pickupAddress/dropoffAddress)
- [x] Always show icons row (don't hide when no data - just grey out all icons)
- [x] Always show View Original button (greyed out with "No Original Available" text when no file/email)

## View Original Always Enabled (Jan 31)
- [x] Never grey out View Original button
- [x] Show email text when no PDF/image file exists
- [x] Generate markdown summary from details as fallback if no email body

## Document Parsing Prompt Improvements (Jan 31)
- [x] Update prompts with schema-first, details-second approach
- [x] Add mandatory vs optional field categorization
- [x] Improve date parsing for Hebrew/multilingual emails
- [x] Navigation: only show if explicit address OR airport code (infer airport name from code)
- [x] Phone numbers: add + prefix for international numbers (in prompt + post-processing)
- [x] Add speed instruction - don't invent/guess, use null for missing fields
- [x] Add airport code to address mapping for flights

## View Original Button Sizing Fix (Jan 31)
- [x] Make View Original button smaller and not floating
- [x] Position within scroll content (at top, outline style)

## App Icon Centering Fix (Feb 1)
- [x] Regenerate app icon with graphic perfectly centered on 1024x1024 canvas
- [x] Update all icon files: icon.png, splash-icon.png, favicon.png, android-icon-foreground.png
