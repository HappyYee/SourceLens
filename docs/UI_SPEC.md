# UI Spec

## UI Principles

- Source-first, not feed-first.
- Dense enough for repeated use, but calm and readable.
- Cards are launchers to original content, not full article readers.
- The app should help the user finish checking sources and leave.

## Current Visual Direction

- Typography: existing app CSS defines the current tone; keep changes consistent with `src/app/globals.css`.
- Layout: left navigation for Rooms/folders, main content for Room timelines and settings.
- Cards: compact launcher cards with platform label, title, excerpt, media, time, tags, and original link.
- Color: use the existing CSS variables and avoid introducing a new palette without a UI task.

## New Page Template

- Top-level purpose should be visible immediately.
- Primary action should be near the related data.
- Use existing `set-card`, `set-form`, `set-btn`, `src-*`, and timeline styles where possible.
- Avoid landing-page or marketing layouts inside the app.

## State Design

- Loading: short inline status text near the triggering control.
- Empty: explain what is missing and what the user can do next.
- Error: show the platform/channel, concise cause, and next action.
- Success: show counts or concrete result, not generic "done".

## Interaction Acceptance

- No broken image icons; failed media should fall back to a clean placeholder.
- Long text should not overflow buttons or compact panels.
- Destructive actions require confirmation.
- Platform login/profile actions must never expose cookies or tokens.
- Refresh and backfill results should be understandable without opening dev tools.

## Component Inventory

- Card system: `ItemCard` shell + `src/components/cards/` (registry, per-platform cards, MediaGrid/LinkPreview/TagList/StatusBadge atoms).
- Source actions are capability-driven (`sourceActionFlags`); result lines come from pure formatters.

## TBD

- Final design tokens.
- Mobile layout polish.
