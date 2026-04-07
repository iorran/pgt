---
title: Class Management & Academy Location UI
date: 2026-04-07
tags:
  - spec
  - classes
  - academy
  - forms
status: approved
---

# Class Management & Academy Location UI

> [!info] Related
> - [[backlog|Backlog]] for future form migration

## Overview

Add missing CRUD UI for classes (edit/delete) and academy location setup. Refactor class create form and new forms to use TanStack Form.

## Current Problems

- Instructors cannot edit or delete classes from the UI (API exists)
- Instructors cannot set their academy location from the UI (API exists, needed for proximity checkin)
- Class create form uses raw useState, inconsistent with TanStack Form pattern we're establishing

## Changes

### Install @tanstack/react-form

New dependency in apps/web.

### Classes Page — Instructor Actions

**Edit class:**
- Pencil icon button on each class card (visible to instructors only)
- Opens a dialog with TanStack Form pre-filled: name, type, startTime, endTime
- Submit calls `PUT /api/classes/:id` with changed fields
- On success: invalidate classes query, close dialog

**Delete class:**
- Trash icon button on each class card (visible to instructors only)
- Shows a confirmation dialog ("Are you sure?")
- Confirm calls `DELETE /api/classes/:id` (soft delete — sets active: false)
- On success: invalidate classes query, close dialog

**Create class refactor:**
- Existing create dialog refactored from raw useState to TanStack Form
- Same field structure as edit form, ensuring consistency

### Academy Location — Dashboard Section

Instructor-only section on the dashboard page:
- "Set gym location" button calls `navigator.geolocation.getCurrentPosition()`
- Sends lat/lng to `PUT /api/academies/:id/location`
- Address text input via TanStack Form
- Shows current saved address/coordinates if set
- Fetches academy data via existing `GET /api/academies/mine`

## Files to Modify

- Install: `@tanstack/react-form` in apps/web
- `apps/web/src/pages/classes/index.tsx` — edit/delete buttons, edit dialog, refactor create form to TanStack Form
- `apps/web/src/pages/dashboard.tsx` — add academy location section with TanStack Form
- `apps/web/test/pages/classes.test.tsx` — update tests for edit/delete
- `apps/web/test/pages/dashboard.test.tsx` — update tests for location section

## Out of Scope

- Migrating all other forms to TanStack Form (separate brainstorm/spec)
- Editing class recurrence or day of week (would require creating/deleting records)
- Map-based location picker
