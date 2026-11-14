# Character Web changelog

## 0.1.5 · Saved Neighborhood Layouts

- Added a **▦ Neighborhood Layout** panel alongside map zoom and fit controls. Works with any selection, including no selection.
- **Save current** captures the current visible nodes' center-relative positions for the focal character and enables the saved layout.
- **Per-focal-character snapshots:** navigating away and back restores that character's own arrangement. The same shared character may be positioned differently around other focal characters.
- **Use saved arrangement** toggle switches between fixed saved placements and the automatic physics layout. Turning the mode off retains the snapshot.
- **Restore saved** discards temporary node drags; **↻ Reshuffle** creates a fresh automatic arrangement while keeping saved positions for later restoration.
- Explicit save/update only: mouse dragging does **not** overwrite snapshots, and new neighbors settle around saved nodes without moving the saved nodes.
- Persisted validated layout snapshots in an optional top-level `layouts` property of schemaVersion 1 JSON. Old backups without layouts remain fully importable; exports include per-character layout states.
- Layout changes are undoable/redoable and character deletion clears references in saved layouts.
- Added mobile-responsive layout controls, touch-safe input, and keyboard Escape behavior.
- Preserved all 0.1.4 navigation/roster and 0.1.3 mobile improvements. Public package starts blank, without private world data.

## 0.1.4 · Navigation & Roster

- Added clear selection via blank-canvas click/tap, **× Clear**, and Escape, without recentering the current neighborhood.
- Added searchable all-project character roster, including alias search, alphabetical/connection-count sorting, and an unconnected-only filter.
- Roster counts distinct contacts, not multiple relationship records.

## 0.1.3 · Mobile & Touch

- Added real pinch-to-zoom, touch panning and tapping, collapsible mobile details, and **Fit Neighborhood**.
- Reduced mobile layout work and clarified relationship hover labels.

## 0.1.2 · Directional Relationships

- Added one-way relationship arrows, reverse-direction support, parallel mutual/directional strands, and Shift-click connection creation.

## 0.1.1 · Public-Clean Starter

- Removed private starter data from the public release. Continued local-first JSON import/export and basic character relationships.
