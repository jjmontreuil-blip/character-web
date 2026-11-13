# Character Web changelog

## 0.1.4 · Navigation & Roster

- Added a searchable, scrollable roster covering all project characters, including off-screen and unconnected people.
- Added alphabetical, most-contact, and fewest-contact sorting, plus an unconnected-only filter.
- Counted unique neighbors rather than individual relationship records for roster contact counts.
- Added direct roster-to-character recentering on desktop and mobile, plus R keyboard shortcut and Escape dismissal.
- Added clearing a character/relationship selection by blank-canvas click/tap, Escape, or toolbar/panel × buttons, without changing the focused neighborhood.
- Kept mobile detail-sheet visibility separate from selection and removed relationship highlight upon deselection.
- Preserved schema v1 import/export and public-clean startup with no bundled story or character data.
- Limited very large roster lists to the first 250 matches, with a visible explanation and search to narrow.

## 0.1.3 · Mobile & Touch

- Implemented proper two-finger pinch-to-zoom and multi-touch panning, centered on the fingers
- Made single-finger drags pan on touch devices, while preserving mouse node drags
- Replaced the permanently visible mobile detail pane with a collapsed/expandable sheet
- Added ◎ Fit immediate neighbors alongside ⤢ Fit all visible map controls
- Paused layout physics while touch gestures are active; reduced mobile collision/animation work
- Switched per-frame node updates from layout-position writes to composited transforms
- Added a gentle large-map hint rather than silently hiding imported data
- Simplified mouse-hover relationship titles to label only; preserved directional accessibility metadata
- Retained public-clean startup and full v1 import compatibility

## 0.1.2 · Relationship workflow update

- Shift-click a visible second character to open a pretargeted connection form
- Replaced the prefilled relationship datalist with an empty free-text field and clickable type suggestions
- Protected unsaved modal edits from accidental outside-click dismissal
- Added both directional choices and explicit person-to-person labels to connection creation and editing
- Displayed arrowheads for unilateral connections, including mixed-direction multi-relationship pairs
- Preserved v0.1 JSON compatibility and public-clean empty startup
- Updated help, accessibility labels, and version displays

## 0.1.1 · Public-clean edition

- Removed bundled cast, portraits, and story examples
- Blank project by default, with private JSON import supported
- GitHub Pages-ready flat repository layout

## 0.1 · The Living Web

- First interactive graph and browser-local character encyclopedia prototype
