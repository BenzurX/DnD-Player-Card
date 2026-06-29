# D&D Player Card — CLAUDE.md

## What it is
Mobile-first D&D quick-reference companion. Single HTML page, no build step — open `index.html` in a browser. Data lives in `localStorage`. No server, no framework.

## Files
```
index.html       — markup, all overlay elements
js/app.js        — all logic (~1700+ lines, single file)
css/style.css    — all styles
sw.js            — service worker (PWA caching + auto-update)
README.md        — user-facing docs
CHANGELOG.md     — version history
docs/            — reference docs imported below
```

## Pre-push gate (required every push)
Before any `git push`, always update all three:
1. **CHANGELOG.md** — document what changed
2. **README.md** — reflect any feature/UI changes
3. **sw.js** — bump the `CACHE` version string (e.g. `dnd-player-card-v1` → `dnd-player-card-v2`) so installed Android PWAs pick up the update automatically

Stage all three alongside code. No exceptions.

@docs/data-model.md
@docs/architecture.md
