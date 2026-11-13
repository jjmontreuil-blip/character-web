# Character Web 0.1.4 · Navigation & Roster

Character Web is a dependency-free, offline-first character relationship explorer. **The public release contains no bundled characters, portraits, starter worlds, user projects, or fictional-universe data.** A fresh browser begins with an empty world.

## Update your GitHub Pages site

1. **Before upgrading, export your private JSON project** using **☰ → Export backup (.json)**. Save it outside the browser.
2. Unzip this archive and upload its **six files directly to the root** of your existing `character-web` GitHub repository using **Add file → Upload files**, replacing the older versions. Commit your changes. Keep your existing repository and Pages URL.
3. Once GitHub Pages deploys, refresh the application. If the page still shows 0.1.3, try a hard refresh (Ctrl+Shift+R) or a private tab to check for an old cached version.
4. Your current project should persist **in the same browser at the same URL**. If needed, use **☰ → Import project…** to restore a backup. Import replaces the current project after confirmation.

The public release consists of `.nojekyll`, `index.html`, `styles.css`, `app.js`, `README.md`, and `CHANGELOG.md`. **Never put your private project JSON in the public repository.**

## New in 0.1.4

### Clear Selection

Selection and network focus are now independent. Clearing a selected character or relationship **does not change the neighborhood currently centered on the map**.

- Click/tap **× Clear** in the graph toolbar, or the **×** in the selected character/relationship panel.
- Click/tap a **blank part of the graph** without dragging. Panning does not clear selection.
- Press **Escape** on desktop (when not editing a text field).
- After clearing, the details panel says **Nothing selected** and offers a button to inspect the current focal character again.
- On mobile, collapsing the bottom sheet hides the details without clearing selection; these are intentionally different actions.
- For a selected relationship, clearing selection also removes its special line highlight, while leaving all arrows and connections intact.

### Character Roster

Click **☷ Roster** in the graph toolbar (also available via **R** when not typing) to open a full-project directory, independent of the visible network depth.

- Alphabetical list of **every character**, with optional aliases.
- Search characters and aliases, including people outside the current one-step or two-step neighborhood.
- Sort by name, **most contacts**, or **fewest contacts**. Each contact count represents **distinct other people**, not the number of relationship records. Two bonds with the same person count as one contact.
- Toggle **Unconnected only** to find characters with zero documented relationships.
- Click/tap a character to recenter on that character. Use the **×** inside the roster, click outside, or press Escape to close it.
- The roster is usable on desktop and mobile; it scrolls independently of the network.
- To keep huge projects responsive, the list renders the first **250 matching entries** at a time and prompts you to search to narrow larger sets. The summary always reports the full number of matching characters.

The roster is a navigation aid, **not the planned advanced statistics/reports system**. Future features may reuse the roster as a bulk-selection interface; bulk editing is **not included** in this release.

## Existing functionality preserved

- Pinch zoom and touch panning on mobile, including a collapsible detail sheet.
- Fit immediate neighborhood **◎** and fit all visible **⤢** controls.
- Create, edit, duplicate, and delete characters, with optional portraits and name-only mode.
- Multiple, optionally directional relationships between the same two people, including arrowheads and history/notes.
- Shift-click a visible character on desktop to start a connection from the currently centered character.
- Drag nodes with a mouse, pan and zoom the graph, search, depth filters, and undo/redo.
- Automatic local saving and portable JSON backup export/import.

The project JSON remains **schemaVersion 1**. Existing names, portraits, notes, custom fields, groups, relationship direction, and private/public visibility are preserved on import. Clearing selection and opening the roster do **not** change or save project data.

## Privacy and backups

GitHub Pages hosts only application files, **not your private character data**. Project data resides in browser-local storage (IndexedDB or localStorage fallback). It does not synchronize across Safari/Chrome, between computers and phones, or between different site addresses. Export backups regularly, especially before updates, resetting browsers, or clearing site data.

## Planned next steps

- **0.1.5: Saved Neighborhood Layouts**, including per-character remembered arrangements, plus JSON backup support.
- **0.1.6: Relationship Focus**, including independently toggled importance tiers and potentially viewpoint-specific importance.
- **0.2: Group Spotlight** to navigate memberships as well as social links.
- Later: custom field/section templates and bulk assignment, perspective-aware relationships, analytics, and a spoiler-safe viewer.

These planned features are **not present** in 0.1.4.
