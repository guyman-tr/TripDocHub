# TripHub - Project TODO

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

## UI Improvements
- [x] Add trash icon to inbox document items for easy deletion of duplicates
- [x] Add Clear All button to inbox header to delete all documents at once
