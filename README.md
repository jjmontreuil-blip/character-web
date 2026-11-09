# Character Web 0.1.2

Character Web is an offline-capable, local-first character relationship explorer. **Public releases contain no character data, portraits, or fictional-universe examples.** New visitors start with an empty world.

## Update your GitHub Pages site

1. **Export your current private project JSON first** using **☰ → Export backup (.json)**. Keep a copy outside your browser.
2. Open your existing `character-web` GitHub repository, choose **Add file → Upload files**, and upload the contents of this ZIP into the repository **root**. Replace the existing files when prompted, then commit the changes. You do not need a new repository.
3. Once GitHub Pages deploys the update, refresh the published page. If you still see the old version, try Ctrl+Shift+R or an incognito tab to check the version label.
4. Your browser-local project should still be there on the same Pages URL. If it isn't, choose **☰ → Import project…** and select your private JSON backup. Import **replaces** the current browser-local world, with confirmation first.

The repository files should be `index.html`, `app.js`, `styles.css`, `.nojekyll`, `README.md`, and `CHANGELOG.md`. **Do not upload your private project JSON to the public repository.**

## New in 0.1.2

- **Shift-click to connect:** with character A centered, hold **Shift** and click a visible character B. The Connect Characters editor opens with B selected. Normal click still centers a character. Works on portrait and name-only nodes. On touch devices, use the profile panel's **＋ Connect** button.
- **Clear relationship entry:** the relationship type field starts empty, with *Connection* used if left blank. Click a suggested relationship type or type your own. Suggestions include common types and types already used in your project.
- **Safer dialogs:** clicking outside the dialog no longer discards what you've typed. Use **Cancel**, **×**, or **Esc** to close.
- **Three direction choices:** mutual/undirected, first person → second, or second person → first. The selector spells out their names and updates when you choose a different recipient.
- **Directional arrows on the web:** one-way relationships show an arrow pointing toward the recipient. If two characters have several relationship records with different directions, those are represented by up to three subtly separated strands (mutual, A→B, B→A), rather than one ambiguous line.
- **Existing projects retained:** the `schemaVersion: 1` data format remains compatible. Existing `forward` relationships and all portraits, aliases, groups, and notes import without conversion. New relationships may also store `direction: "reverse"`.

## Existing features

- Create, edit, duplicate, and delete characters; optional portraits; name-only view
- Create and edit multiple relationships with descriptions and notes
- Recenter, drag, pan, zoom, search, connection-depth controls, undo/redo
- Private browser autosave and portable JSON import/export

## Storage and privacy

The site is a static web app. GitHub Pages hosts the *code*, not your project database. Project data stays in that browser profile's IndexedDB (with a localStorage fallback) unless you export or deliberately publish it. Different browsers/devices do not automatically synchronize projects. Keep regular backups, especially before clearing site storage or changing your Pages URL.

An empty browser or incognito window starts with an empty world; your normal browser may load saved local data. This is expected.

This remains an alpha prototype, not a user-account or secure publishing system. Sharing an exported JSON file reveals all data in that file, including private notes and portraits.

## Next phase

Smart clickable group/faction tags and a Group Spotlight view are being developed separately; they are **not included in 0.1.2**.
