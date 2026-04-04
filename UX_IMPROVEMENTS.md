# UX Improvements Backlog

Tracked UI/UX improvement opportunities identified via code analysis.

## High Priority

- [x] **Recipe step tracking (cook mode)** — Tap to highlight current step, dim completed steps, auto-scroll to active. Combine with wake lock + larger text for a dedicated cooking experience. *(Impact: High, Effort: Medium)*
- [x] **Swipe gestures for day navigation** — Swipe left/right to change days in daily view. More natural on mobile, especially with wet/messy hands. *(Impact: High, Effort: Medium)*
- [x] **Wake Lock API in cook mode** — Keep screen on during cooking via `navigator.wakeLock`. *(Impact: High, Effort: Low)*

## Medium Priority

- [ ] **Daily view meal completion indicators** — Surface prep checklist progress on meal cards (checkmark or subtle badge for prepped meals). *(Impact: Medium, Effort: Low)*
- [ ] **Shopping list search/filter** — Text search bar at the top to quickly find ingredients across categories. *(Impact: Medium, Effort: Low)*
- [x] **Aggregated shopping quantities** — Combine identical ingredients across meals with summed totals instead of separate entries. Includes Serbian synonym detection for ingredient name normalization. *(Impact: High, Effort: Medium)*
- [ ] **Actionable empty states** — Replace plain "no data" text with CTA buttons ("Dodaj obrok", "Uvezi plan") to guide users forward. *(Impact: Medium, Effort: Low)*
- [ ] **Undo on destructive editor actions** — Toast with undo when deleting ingredients or recipe steps, instead of instant removal. *(Impact: Medium, Effort: Medium)*

## Low Priority

- [ ] **Offline status indicator** — Subtle banner or icon showing connection/sync state for PWA trust. *(Impact: Medium, Effort: Medium)*
- [ ] **Weekly view progress state** — Visual differentiation for past days, progress rings, or completion badges on the 7-day grid. *(Impact: Low, Effort: Medium)*
- [ ] **Drag-to-reorder in editor** — Drag-and-drop for recipe steps and ingredients instead of delete-and-readd. *(Impact: Medium, Effort: High)*
- [ ] **Haptic feedback on check actions** — Light vibration via `navigator.vibrate()` when checking off shopping/prep items. *(Impact: Low, Effort: Low)*
- [ ] **Prep checklist link from meal detail** — "Start prep" button on meal detail to jump directly to that meal's checklist items. *(Impact: Medium, Effort: Low)*
- [ ] **Settings page section headers** — Add section headers outside cards (Nalog, Obaveštenja, Aplikacija) for better scannability. *(Impact: Low, Effort: Low)*
