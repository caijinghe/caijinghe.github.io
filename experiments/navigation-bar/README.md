# Navigation Bar — experiment (shelved 2026-11-04)

Bottom dock replacing the top header: `Design | Research` text tabs (current page black) + Info / Résumé filled icons.
Solid gray over a plain page, frosted glass when it sits over imagery (auto-detected).

Not live — the site uses the original top header. Kept here to revisit.

## Files
- `site-dock.css` — dock styles (needs `css/tokens.css`)
- `site-dock.js` — builds the dock into `<nav class="site-dock" data-active="design|research|info">`, detects imagery underneath, filled icons
- `research-with-dock.html` — Research page wired to the dock (open it to try the dock live)
- `pages.patch` — the homepage / Info page / info-popover changes that swapped the header for the dock

## Bring it back
1. Copy `site-dock.css` → `css/`, `site-dock.js` → `js/`, and in `site-dock.js` drop `ROOT` and point the Research tab back to `research.html`.
2. From the repo root: `git apply experiments/navigation-bar/pages.patch` (made against commit b56ae8e; resolve by hand if pages changed).
3. Add `<nav class="site-dock" data-active="research"></nav>` + the two links to `research.html`.

Documented on `design-system.html` under Components → Dock (Experiment).
