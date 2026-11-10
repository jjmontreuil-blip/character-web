# Character Web 0.1.3

Character Web is a dependency-free, offline-first character relationship explorer. **The public release contains no bundled characters, portraits, user projects, or fictional-universe data.** A new browser starts with an empty world.

## Update your GitHub Pages site

1. **Before upgrading, export your private project JSON** via **☰ → Export backup (.json)**. Keep the backup somewhere other than the browser.
2. Unzip this archive. In your existing `character-web` GitHub repository, choose **Add file → Upload files** and upload the **six files from inside the ZIP directly into the repository root**, replacing their older versions. Commit. You do not need a new repository or a new GitHub Pages site.
3. After the deployment completes, refresh your site. If you still see 0.1.2, use Ctrl+Shift+R, or check in a fresh/incognito tab to distinguish a cached page from the new deployment.
4. The current project should persist in the **same browser on the same site URL**. If necessary, import your private backup using **☰ → Import project…**. Import replaces the current project, after confirmation.

The exact public files are `index.html`, `app.js`, `styles.css`, `.nojekyll`, `README.md`, and `CHANGELOG.md`. **Do not upload private project JSON to a public GitHub repository.**

## New in 0.1.3: Mobile & Touch

- **Real two-finger pinch zoom** focused around the gesture midpoint; moving both fingers together also pans the camera. The zoom buttons remain available.
- **One-finger panning on the map**, including when starting over a character. A short tap on a character recenters it. Dragging individual characters to manually rearrange the graph remains a desktop mouse operation for now.
- **Mobile detail sheet:** character/relationship details collapse to a 48-pixel tab by default, keeping much more space for the map. Tap the tab to expand/collapse. Tapping a relationship line opens its details automatically.
- **Fit immediate neighbors (◎):** zoom the camera around the focused character and their direct neighbors, even when the graph is in 2 steps or Everyone mode. **Fit all visible (⤢)** still fits the entire current map. Both controls are located under the +/− zoom buttons.
- **Less layout work during mobile interactions:** physics pauses during active touch gestures, collision calculations stop earlier for large mobile neighborhoods, and moving node elements are positioned with composited transforms rather than changing their layout coordinates every frame. A large-map notice suggests the 1-step view when more than 110 characters are visible.
- **Cleaner relationship hover titles:** they now show only the relationship label(s). Direction information remains on line arrowheads, in the relationship editor, and in accessible labels for keyboard/screen-reader use.
- **Same project format:** no data migration and no new backend. Existing `schemaVersion: 1` JSON imports, portraits, aliases, notes, groups, and relationship directions are preserved.

### Mobile interactions

- Tap a character to explore their neighborhood; tap the **View details** strip at the bottom to see or edit its profile.
- Tap a relationship line to open connection details. The details strip also gives access to the **＋ Connect** action, useful without Shift-click on touch devices.
- Drag one finger to pan. Pinch with two fingers to zoom around your fingers. Tap **◎** to frame immediate neighbors or **⤢** to frame the current view.
- Choose **1 step** for a less crowded neighborhood. Larger 2-step or Everyone maps can still be dense on a phone, especially with hundreds of connections. Relationship Focus filtering and saved layouts are future improvements, not included here.

## Existing features

- Create, edit, duplicate, and delete characters; optional portraits or name-only views.
- Create multiple relationships between two people, with mutual or either directional arrow, history and private notes.
- Shift-click visible nodes on desktop to open pre-targeted connection creation.
- Recenter, mouse-drag nodes, pan, zoom, search, connection depth filters, undo/redo, and locally autosaved edits.
- Portable JSON backup export/import.

## Storage, backups, and privacy

GitHub Pages hosts the application **code**, not your project database. Current-world data stays in the browser's IndexedDB (or localStorage fallback) unless explicitly exported. Different browsers or devices do **not** automatically synchronize worlds. Use backups before upgrading or clearing browser site data. An exported JSON contains all its private notes and any embedded portraits. This is an alpha prototype, not an authenticated, encrypted publishing service.

## Coming next

Proposals include saved per-character neighborhood arrangements, optional primary/secondary/tertiary Relationship Focus filters, smart group/faction exploration (Group Spotlight), and eventually perspective-aware relationship labels and spoiler-safe publishing. These are **not** in 0.1.3.
