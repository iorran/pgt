---
title: Smart Checkin System Design
date: 2026-04-07
tags:
  - spec
  - checkin
  - feature
status: approved
---

# Smart Checkin System

> [!info] Related
> - Plan: [[2026-04-07-smart-checkin|Implementation Plan]]
> - [[backlog|Backlog]] for future enhancements

## Overview

Replace the current unrestricted checkin with a validated system that supports two methods: proximity-based button checkin and QR code scanning. Both methods enforce time windows, duplicate prevention, and overlapping class constraints.

## Current Problems

- Students can check in unlimited times to any class
- No time validation — can check in to morning classes at night
- No presence verification — can check in from anywhere
- `studentId` comes from request body instead of session (security issue)

## Design Decisions

- **250m proximity radius** for button checkins (handles GPS drift)
- **Time window**: 15 minutes before `startTime` through 1 hour after `endTime`
- **One checkin per class per day** — students can attend multiple classes but not the same one twice
- **No checkin to overlapping classes** — can't check in to two classes that start at the same time
- **QR tokens rotate every 5 minutes** — prevents screenshot sharing
- **Server validates everything** — client only handles UX hints (showing/hiding buttons)
- **Academy location via browser geolocation** — instructor taps "Set gym location" while at the gym, no external geocoding API

## Database Changes

### Academy table — add columns

```
latitude   decimal(10, 7)   nullable
longitude  decimal(10, 7)   nullable
address    varchar(500)     nullable
```

### Checkin table — add columns + constraint

```
source     enum ['button', 'qr']   not null, default 'button'
latitude   decimal(10, 7)          nullable
longitude  decimal(10, 7)          nullable
```

Add unique constraint: `(classId, studentId, date)` where `date` is derived from `checkedInAt`. Implemented as a unique index on `(classId, studentId, date(checkedInAt))`.

### New table: checkin_token

```
id         uuid          primary key, auto-generated
classId    uuid          references bjjClass, not null
token      varchar(100)  unique, not null
expiresAt  timestamp     not null
createdAt  timestamp     default now()
```

Index on `token` for fast lookups. Expired tokens can be cleaned up periodically or ignored via query filter.

## API Changes

### POST /api/checkins — reworked

Replaces current implementation. `studentId` extracted from session, not request body.

**Request body (button):**
```json
{ "classId": "uuid", "source": "button", "latitude": -23.55, "longitude": -46.63 }
```

**Request body (QR):**
```json
{ "classId": "uuid", "source": "qr", "token": "abc123" }
```

**Server validation pipeline (in order, fail fast):**

1. Class exists and `active = true`
2. Time window — current time is within 15min before `startTime` to 1hr after `endTime`, and today matches the class `dayOfWeek` (or `date` for one-time classes)
3. Duplicate check — no existing checkin for this student + class + today
4. Overlap check — no existing checkin for this student + today + another class with the same `startTime`
5. If `source = 'qr'`: token exists, matches classId, and `expiresAt > now()`
6. If `source = 'button'`: academy has lat/lng set, and Haversine distance between student coordinates and academy coordinates is <= 250m

On success: create checkin record, update streak (existing logic), return `{ success: true }`.

On failure: return 400 with `{ error: "CHECKIN_DUPLICATE" | "CLASS_NOT_ACTIVE" | "OUTSIDE_TIME_WINDOW" | "OVERLAPPING_CLASS" | "INVALID_TOKEN" | "TOO_FAR" | "LOCATION_NOT_SET" }`.

### GET /api/checkins/tokens — new, instructor-only

Returns tokens for all currently active classes in the instructor's academy.

For each active class (within the time window): if a valid (non-expired) token exists, return it. Otherwise, generate a new token (random UUID), store it with `expiresAt = now + 5 minutes`, return it.

**Response:**
```json
[
  {
    "classId": "uuid",
    "className": "Fundamentals Gi",
    "classType": "gi",
    "startTime": "07:00",
    "endTime": "08:30",
    "token": "uuid-token",
    "expiresAt": "2026-04-07T07:35:00Z"
  }
]
```

Returns empty array when no classes are active.

### PUT /api/academies/:id — update to accept location

Add `latitude`, `longitude`, `address` to the accepted body fields. Instructor-only.

## Distance Calculation

Haversine formula implemented as a utility function server-side. No external dependency.

```
haversineDistance(lat1, lon1, lat2, lon2) -> meters
```

Returns distance in meters. Checkin passes if distance <= 250.

## Frontend Changes

### Totem Page — new route `/totem`

Instructor-only page designed for a tablet at the gym entrance.

**Behavior:**
- Polls `GET /api/checkins/tokens` every 4 minutes
- Shows a card per active class: name, type, time range, QR code
- QR encodes a URL: `{APP_URL}/checkin?token={token}` — scanning opens the app
- When no classes are active: shows "no classes right now" with the next upcoming class time
- Minimal UI — no navigation, fullscreen-friendly, large QR codes

**QR generation:** use a lightweight client-side QR library (e.g., `qrcode.react` or similar).

### Checkin Landing Page — new route `/checkin`

Handles the QR scan redirect. Reads `token` from the URL query params.

- If not logged in: redirect to login, preserve the token in return URL
- If logged in: call `POST /api/checkins` with `{ source: 'qr', token, classId }` (classId resolved from token response or embedded in QR payload)
- Show success or error state

Simplified approach: the QR URL encodes both `token` and `classId` so the client doesn't need an extra lookup.

QR URL format: `{APP_URL}/checkin?token={token}&classId={classId}`

### Classes Page — updated

For each class card on today's schedule:

- **Outside time window:** no checkin buttons
- **Inside time window, not checked in:** two buttons — "Check in" (proximity) and QR scan icon
- **Inside time window, already checked in:** checkmark, no buttons
- **Proximity button tapped:** browser requests geolocation, sends coordinates to server. If server rejects, show error message.
- **QR scan tapped:** opens camera scanner, reads QR token, sends to server.

Client checks for time window are purely for showing/hiding buttons. The server is the authority.

**QR scanning:** use a lightweight camera scanner library (e.g., `html5-qrcode` or similar).

### Academy Settings — updated

Add "Set gym location" section:
- "Use my current location" button — calls `navigator.geolocation.getCurrentPosition()`, sends lat/lng to `PUT /api/academies/:id`
- Text input for display address (manual entry)
- Show current saved coordinates if set

## Files to Create/Modify

**New files:**
- `apps/api/src/db/schema/checkin-token.ts` — token table schema
- `apps/api/src/utils/haversine.ts` — distance calculation
- `apps/web/src/pages/totem.tsx` — tablet totem page
- `apps/web/src/pages/checkin-scan.tsx` — QR redirect landing page

**Modified files:**
- `apps/api/src/db/schema/academy.ts` — add lat, lng, address columns
- `apps/api/src/db/schema/checkin.ts` — add source, lat, lng columns + unique index
- `apps/api/src/routes/checkins.ts` — full rework with validation pipeline + token endpoint
- `apps/api/src/routes/academies.ts` — accept location fields on update
- `apps/web/src/pages/classes/index.tsx` — smart checkin buttons
- `apps/web/src/App.tsx` — add /totem and /checkin routes
- DB migration for all schema changes

## Out of Scope

- Configurable proximity radius per academy
- Map-based location picker
- External geocoding API
- Offline checkin support
- Push notifications for class reminders
