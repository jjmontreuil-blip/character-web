# Character Web changelog

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
