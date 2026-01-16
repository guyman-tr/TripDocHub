# TripDocHub - Mobile App Interface Design

## Design Philosophy

TripDocHub follows Apple Human Interface Guidelines (HIG) to deliver a native iOS experience. The app is designed for **mobile portrait orientation (9:16)** with **one-handed usage** in mind. Every interaction should feel intuitive, with primary actions accessible in the thumb zone (bottom 1/3 of screen).

---

## Screen List

| Screen | Purpose | Tab/Modal |
|--------|---------|-----------|
| **Home** | Dashboard showing upcoming trips, quick actions | Tab 1 |
| **Trips** | List of all trips with create/delete | Tab 2 |
| **Inbox** | Unassigned documents awaiting triage | Tab 3 |
| **Profile** | User settings, forwarding email address | Tab 4 |
| **Trip Detail** | Categorized documents for a specific trip | Stack screen |
| **Document Detail** | Full parsed info + original document view | Stack screen |
| **Add Trip Modal** | Create new trip with name and dates | Modal |
| **Assign Document Modal** | Assign inbox document to a trip | Modal |
| **Upload Modal** | Upload/photograph document | Modal |

---

## Primary Content and Functionality

### Home Screen (Tab 1)
- **Header**: User greeting + forwarding email address (tap to copy)
- **Upcoming Trip Card**: Next trip with countdown, tap to view details
- **Quick Actions**: Large buttons for "Upload Document" and "Create Trip"
- **Recent Activity**: Last 3 parsed documents with status

### Trips Screen (Tab 2)
- **Trip List**: FlatList of trip cards showing:
  - Trip name (e.g., "Hungary Aug 2025")
  - Date range
  - Document count badge
  - Swipe to delete
- **Floating Action Button**: Create new trip (bottom right, thumb zone)
- **Empty State**: Illustration + "Create your first trip" CTA

### Inbox Screen (Tab 3)
- **Inbox List**: Documents awaiting assignment
  - Document type icon
  - Title/subtitle from parsing
  - "Assign" button
- **Empty State**: "All caught up!" message
- **Badge**: Tab shows unread count

### Profile Screen (Tab 4)
- **User Info**: Name, email, avatar
- **Forwarding Email**: Prominent display with copy button
- **Settings**: Dark mode toggle, logout
- **Help**: How to use email forwarding

### Trip Detail Screen (Stack)
- **Header**: Trip name, date range, edit button
- **Collapsible Sections** (Accordion pattern):
  1. ✈️ Flights
  2. 🚗 Car Rentals
  3. 🏨 Accommodations
  4. 🏥 Medical Insurance
  5. 🎫 Events
  6. 📄 Other
- **Each Section Contains**:
  - Sub-items (e.g., eTicket, Boarding Pass)
  - Tap to expand/collapse
  - Tap item to view Document Detail
- **Add Document FAB**: Bottom right

### Document Detail Screen (Stack)
- **Parsed Info Card**: Category, type, title, subtitle, key details
- **Original Document**: Tap to view PDF/image in full screen
- **Actions**: Reassign to trip, Delete
- **Metadata**: Upload date, source (email/upload)

---

## Key User Flows

### Flow 1: First-Time User Setup
1. User opens app → Home screen
2. Sees empty state → "Create your first trip" button
3. Taps button → Add Trip Modal opens
4. Enters trip name, start date, end date
5. Taps "Create" → Trip created, navigates to Trip Detail
6. Sees empty trip → "Add your first document" prompt

### Flow 2: Upload Document Manually
1. User on Home or Trip Detail → Taps "Upload Document"
2. Upload Modal opens with options:
   - "Choose from Library" (file picker)
   - "Take Photo" (camera)
3. Selects file → Loading indicator
4. AI parses document → Shows preview of parsed data
5. If dates match a trip → Auto-assigned, confirmation toast
6. If no match → Goes to Inbox, user prompted to assign

### Flow 3: Email Forwarding
1. User receives booking confirmation email
2. Forwards to their unique address (trip-inbox-xxx@triphub.dev)
3. Mailgun webhook receives email
4. Backend extracts attachments, calls AI parser
5. Document appears in Inbox (or auto-assigned)
6. User opens app → Badge on Inbox tab
7. Taps Inbox → Sees new document
8. Taps "Assign" → Assign Document Modal
9. Selects trip → Document moved to trip

### Flow 4: View Trip Documents
1. User on Trips tab → Taps trip card
2. Navigates to Trip Detail
3. Sees collapsible sections by category
4. Taps "Flights" → Expands to show:
   - eTicket (TLV → BUD)
   - Boarding Pass (Seat 12A)
5. Taps "eTicket" → Document Detail screen
6. Views parsed info, taps "View Original" → Full PDF viewer

### Flow 5: Reassign Document
1. User on Document Detail
2. Realizes document is in wrong trip
3. Taps "Reassign" button
4. Assign Document Modal opens
5. Selects correct trip
6. Document moved, confirmation toast

---

## Color Choices

TripDocHub uses a **travel-inspired palette** that feels premium and trustworthy:

| Role | Light Mode | Dark Mode | Usage |
|------|------------|-----------|-------|
| **Primary/Accent** | #007AFF (iOS Blue) | #0A84FF | Buttons, links, active states |
| **Background** | #F2F2F7 (System Gray 6) | #000000 | Main background |
| **Card Surface** | #FFFFFF | #1C1C1E | Cards, elevated surfaces |
| **Text Primary** | #000000 | #FFFFFF | Headings, body text |
| **Text Secondary** | #8E8E93 (System Gray) | #8E8E93 | Subtitles, metadata |
| **Text Disabled** | #C7C7CC | #48484A | Disabled states |
| **Success** | #34C759 | #30D158 | Success toasts, confirmed |
| **Warning** | #FF9500 | #FF9F0A | Pending, needs attention |
| **Destructive** | #FF3B30 | #FF453A | Delete actions |

### Category Colors (Icons/Badges)
- ✈️ Flights: #5856D6 (Purple)
- 🚗 Car Rentals: #FF9500 (Orange)
- 🏨 Accommodations: #34C759 (Green)
- 🏥 Medical Insurance: #FF3B30 (Red)
- 🎫 Events: #AF52DE (Magenta)
- 📄 Other: #8E8E93 (Gray)

---

## Typography

Following iOS system typography:

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Large Title | 34pt | Bold | 41pt | Screen titles |
| Title 1 | 28pt | Bold | 34pt | Section headers |
| Title 2 | 22pt | Bold | 28pt | Card titles |
| Headline | 17pt | Semibold | 22pt | List item titles |
| Body | 17pt | Regular | 22pt | Body text |
| Callout | 16pt | Regular | 21pt | Secondary info |
| Subhead | 15pt | Regular | 20pt | Subtitles |
| Footnote | 13pt | Regular | 18pt | Timestamps, metadata |
| Caption | 12pt | Regular | 16pt | Badges, labels |

---

## Spacing & Layout

- **Grid**: 8pt base unit
- **Screen Padding**: 16pt horizontal
- **Card Padding**: 16pt all sides
- **Section Spacing**: 24pt between sections
- **List Item Height**: 44pt minimum (touch target)
- **Button Height**: 50pt for primary actions
- **Corner Radius**: 12pt for cards, 8pt for buttons
- **Tab Bar**: Standard iOS height with safe area

---

## Navigation Structure

```
Tab Bar (4 tabs)
├── Home (index)
│   └── [Stack] Upload Modal
├── Trips
│   ├── [Stack] Trip Detail
│   │   └── [Stack] Document Detail
│   └── [Modal] Add Trip
├── Inbox
│   ├── [Stack] Document Detail
│   └── [Modal] Assign Document
└── Profile
    └── [Modal] Settings
```

---

## Component Patterns

### Collapsible Section (Accordion)
- Chevron icon rotates on expand/collapse
- Animated height transition (Reanimated)
- Maintains expanded state per session

### Document Card
- Left: Category icon with color
- Center: Title, subtitle, date
- Right: Chevron or action button
- Swipe actions: Delete (destructive)

### Trip Card
- Full width, elevated surface
- Trip name (Title 2)
- Date range (Subhead)
- Document count badge (Caption)
- Tap → Navigate to Trip Detail

### Floating Action Button
- 56pt diameter
- Primary color
- Plus icon
- Bottom right, 16pt from edges
- Respects safe area

### Empty State
- Centered illustration (simple, line art)
- Headline text
- Body text explanation
- Primary action button
