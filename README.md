# Character Web 0.1.5 · Saved Neighborhood Layouts

Character Web is a dependency-free, offline-first character relationship explorer. **The public release includes no bundled characters, portraits, starter worlds, user projects, or fictional-universe data.** A fresh browser begins with an empty world.

## Update your GitHub Pages site

1. **Before upgrading, export your private JSON project** using **☰ → Export backup (.json)**. Save it outside the browser.
2. Unzip this archive. Upload its **six files directly into the root** of the same `character-web` GitHub repository using **Add file → Upload files**, replacing the previous versions. Commit.
3. After GitHub Pages deploys, refresh the application. If 0.1.4 remains visible, hard-refresh the browser or check the deployment status.
4. Your existing project should remain in **the same browser at the same site URL**. If not, use **☰ → Import project…** to restore your backup. Import replaces the currently open project after confirmation.

The six root-level files are `.nojekyll`, `index.html`, `styles.css`, `app.js`, `README.md`, and `CHANGELOG.md`. **Never upload your private character JSON to the public repository.**

## New in 0.1.5: saved layouts

Click **▦** at the bottom of the map's zoom/fit controls to open **Neighborhood Layout** for the **currently centered character**. This panel stays accessible even if you've deselected a character or selected a relationship.

- **Save current:** Save the currently visible characters' positions **relative to the centered character**, then activate that saved arrangement. Positioning is personal to each focal character: one character's preferred layout doesn't constrain anyone else's.
- **Use saved arrangement:** Toggle between the saved positions and automatic layout. Turning it off **does not delete** the saved snapshot. Turning it back on restores the saved arrangement.
- **Restore saved:** Return to the saved positions after manually dragging characters into inconvenient places. **Dragging never silently overwrites the snapshot.**
- **↻ Reshuffle:** Switch to automatic layout and assign new positions around the centered character. Your previous saved snapshot stays available and can be restored whenever you want.
- **Update:** Move any nodes where you want them and click **Save current** again to replace the stored positions with the new arrangement.

Saved layouts automatically return when you navigate away from a character and later center on them again. New characters or connections **do not invalidate an existing layout**: previously saved positions remain fixed, while nodes without saved positions enter the automatic layout and can then be placed and saved. Positions are not screen pixels and can be fit/zoomed on desktop or mobile.

Snapshots are optional and stored per character. There is no save-state requirement for people who prefer an automatic graph. Switching the neighborhood depth between **1 step**, **2 steps**, and **Everyone** simply reveals more of the same saved coordinates where available; it does not erase layouts outside the current view.

### Backup format

Layouts are saved as an optional `layouts` object in the **existing schemaVersion 1** JSON. Old Character Web backups import without any changes or conversion work. Exports include the layout snapshots and enabled/automatic mode per focal character. Deleting a character also removes their layout and references to them in other saved layouts. Undo/redo includes layout changes.

## Existing features retained

- Mobile pinch zoom, finger panning, collapsible details, and dedicated neighborhood/whole-map fit controls.
- Searchable character roster with alias search, contact-count sorting, and an unconnected-character filter.
- Clear selection independently of current map focus via blank canvas, **× Clear**, or Escape.
- Character editing, optional portraits, aliases, faction/group tags, biographies, working notes, duplication, and deletion.
- Multiple relationships between the same two people, mutual or directed with arrows and detailed descriptions.
- **Shift-click** another visible character on desktop to preselect it in the new-connection dialog.
- Search, graph depth controls, mouse drag, undo/redo, autosave, import/export, and names-only mode.

**Shortcuts:** `R` roster, `/` search, `Esc` deselect/close menus, `+` new character, `Ctrl/⌘ Z` undo, `Ctrl/⌘ Shift Z` redo.

## Privacy and backups

GitHub Pages hosts the application, **not your private character data**. The project resides in browser-local storage (IndexedDB, with localStorage fallback), without syncing across separate browsers, devices, or site addresses. Export your JSON frequently, particularly before updates or clearing browser data.

## Next milestones

- **0.1.6 Relationship Focus:** independently selectable primary/secondary/tertiary connection layers, possibly assigned separately by each character's viewpoint.
- **0.2 Group Spotlight:** explore groups and affiliations independently from individual relationships.
- Later: reusable custom field/section templates with bulk character assignment, perspective-dependent relationship meanings, analytics, and a spoiler-safe public reader.

These future features are **not part of 0.1.5**.
