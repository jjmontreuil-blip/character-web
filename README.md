# Character Web 0.1.1 (public-clean edition)

An offline-first, locally saved character-relationship explorer. This edition contains **no sample character data, relationships, portraits, or fictional-world references**. A first-time visitor starts with an empty world.

## Deploy on GitHub Pages

1. Make a **new public repository** (for example, `character-web`).
2. Upload the files in this directory into the **repository root**, not a subfolder: `index.html`, `app.js`, `styles.css`, `.nojekyll`, `README.md` and `CHANGELOG.md`.
3. Open **Settings → Pages**; set **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Open the published address after deployment. You should see **0 people · 0 relationships** and an **Add your first character** action.

## Working with a private project

Select **☰ → Import project…** and open your Character Web JSON backup. The existing v0.1 schema is supported. The import replaces the current *browser-local* project only, with a confirmation first.

**Do not upload your creative-project JSON backups to the GitHub repository** unless you deliberately intend to publish them. The repository and Pages files are public. The app saves imported data in your own browser (IndexedDB, with localStorage fallback) and does not send it to GitHub. Export backups regularly.

If you reuse the **same** GitHub Pages URL after deleting and recreating a repository, that browser's old local data may still load because browser storage is tied to the website origin, not the repository. This is expected. To confirm what *new* visitors see, test in a private/incognito window or a different browser. Do not clear browser site data without exporting your backup first.

## Use without GitHub

Open `index.html` locally. For most browsers this works without any install; for reliable persistent storage, using GitHub Pages or another HTTPS static host is recommended.

## What's included

- Interactive navigable character network and connection-depth controls
- Character and relationship editing, optional portraits, aliases, groups, duplication
- Search, zoom, panning, undo/redo, JSON import/export and browser-local autosave
- Empty state for a blank new project

## Privacy and limitations

- This is a prototype, not a secure user-account system or a public/private publishing feature.
- Files on a public GitHub repository, including old commit history, can be publicly visible. Deleting a repository removes its ordinary history from GitHub's repository pages, but cannot guarantee removal of external caches, copies or forks.
- The stored project is local to the browser profile, not automatically synced across devices.
- The older sample project should be restored by importing your private backup, **not** by reintroducing it into public source code.
