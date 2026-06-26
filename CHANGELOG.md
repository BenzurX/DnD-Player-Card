# Changelog

All notable changes to Combat Sheet are documented here.

---

## [0.9] — 2026-06-26

### Added
- **Ability icons in check/save tags** — skill check and saving throw inline tags now show the governing ability icon (color-coded) after the bonus number, so STR/DEX/etc. is instantly identifiable at a glance
- **Advantage/disadvantage badges in tooltips** — when hovering a condition or check tag, the tooltip now renders A/D hex badges inline next to advantage/disadvantage words
- **Dynamic tag system applies to all tabs** — ability descriptions on any tab (Act, React, etc.) that mention skill checks, saving throws, conditions, or advantage/disadvantage automatically receive styled tags

### Changed
- **"Standard Turn" → "Pinned Actions"** — section header renamed in the Act tab
- **End cap widths are now context-aware** — single-damage caps are narrower (96 px mobile / 140 px tablet); bonus-damage dual caps are wider (168 px mobile / 216 px tablet). Also fixes a CSS specificity bug where single caps were wider than dual caps on tablet
- **Inset panel backgrounds lightened** — ability description boxes and detail field grids use `parchment-mid` instead of `parchment-drk`; less contrast with the sheet body

### Fixed
- **Icon vertical alignment** — Tabler font icons in category buttons and sheet titles had extra descender space causing them to sit below the text midline; fixed with `line-height: 1`
- **adv-badge vertical alignment** — A/D hex badges were rendering below the text midline; corrected with `vertical-align: middle`
- **adv-badge text not selectable** — added `user-select: none` so the A/D letter can't be accidentally highlighted

### UI/UX Cleanup
- `.char-sub` and `.hero-sub` font-size reduced from `--text-base` → `--text-sm` for better name/subtitle hierarchy
- `.section-hdr` letter-spacing normalized from 1.8 px → 1.5 px to match label tracking
- `.section-gap` margin-top tightened from 20 px → 16 px
- `section-hdr-turn` font-size override removed — "Pinned Actions" header was incorrectly larger than all other section headers
- `.attacks-badge` font-size reduced to `--text-xs` to stay proportional
- `.sheet-body` bottom padding reduced from 32 px → 24 px
- `.pinned-list` and `.all-abilities-list` gaps tightened from 14 px → 10 px
- Fixed undefined `var(--tavern-deep)` in spell detail description and ability detail field backgrounds

---

## [0.8] — 2026-06-25

### Added
- **Bonus Damage field** on attack ability cards — optional second damage entry (e.g. `1d4 radiant`) shown as a `+ damage2` chip on the ability card and a stacked line in the pinned card end cap
- **Attacks/round badge** on pinned Actions header now reads "1 Attack/round" or "N Attacks/round" based on character's `attacksPerRound` value
- **Responsive layout refinements**: horizontal nav preserved on all viewports; Explore tab shows character info and passive scores side-by-side on tablet+; spell slots 3 columns on tablet+; pinned cap doubled in width on tablet+
- **Header chevron** button — subtle down-chevron on the right of the hero bar that lights up on header hover and opens the hero summary
- Scrollbars doubled in width app-wide (content area 8 px, sheet body 6 px)
- Pinned card height reduced to 50 px for consistency; items and features use shorter flat height (`pinned-row-flat`)
- Removed `.pinned-subtype` text from all pinned action/bonus cards
- Increased `.pinned-stat` font weight to 600

---

## [0.7] — 2026-06-25

### Added
- **Responsive layout** — app now adapts across mobile, tablet, and desktop
  - **Mobile (≤ 599 px)**: original layout fully preserved — bottom horizontal nav, slide-up sheet overlays
  - **Tablet (≥ 600 px)**: wider container (680 px), 3-column skills grid, overlays become centered modals with fade-in animation; Explore tab shows character info and passive scores side-by-side; spell slots in 3 columns; pinned card cap doubled in width
  - **Desktop (≥ 1024 px)**: wider container (1100 px), larger avatar, 3-column action button grid, wider overlay modals (600 px max) — bottom nav stays horizontal on all viewports
- Scrollbars doubled in width app-wide for improved visibility (content area 8 px, sheet body 6 px)
- Removed `maximum-scale=1.0, user-scalable=no` from viewport meta to support desktop accessibility and pinch-to-zoom

---

## [0.6] — 2026-06-25

### Added
- Gold D20 icon on loading and splash screen (was light tan)
- Fluid cross-fade transition between loading screen and welcome screen
- Pinned Actions header shows sword icon and capitalized "Attack/Attacks"
- Feature types in Add/Edit sheet changed to **Feat**, **Origin**, **Species**
- Pinned feature cards show a type icon on the right: Bookmark (Feat), Origin (Origin), User-hexagon (Species)
- CHANGELOG.md
- .gitignore

### Removed
- Attack count badge (× N attacks) from the Actions section header
- Stats / Damage input field from Reaction add/edit form
- Size input field from Character Details popover (Explore tab)
- Dark Vision card and concept card experiments from Explore tab

---

## [0.5] — 2026-06-25
_Commit: `1a9e5c8` — redesign Explore Character section; remove Size card from Defend tab_

### Added
- Explore tab Character section redesigned: compact 3-card grid (Size, Darkvision, Movement) matching Passive Scores layout
- Passive Score cards given colored icons (eye / zoom-question / bulb)
- Size ruler icon updated to `ti-ruler-2`

### Removed
- Character/Size section removed from Defend tab entirely

### Fixed
- Replaced missing `ti-ikosaedr` splash icon with `ti-dice-6-filled`
- Fixed `ti-flask` → `ti-flask-2` in category config

---

## [0.4] — 2026-06-25
_Commit: `5ecb77e` — add proficiency segmented controls to skill and saving throw popovers_

### Added
- Segmented proficiency controls (None / Proficient / Expertise) on skill detail popovers
- Segmented proficiency controls on saving throw popovers
- Improved skill card readability

---

## [0.3] — 2026-06-25
_Commit: `9620868` — large scale UI/UX changes_

### Added
- Resistance and immunity chip system (Defend tab)
- Advantage / disadvantage tracking for skills and saving throws
- Pinned Actions system — pin any ability to the top of the Act tab
- Spell slot tracker with pip UI and Long Rest reset
- Combined Explore tab Character section — Size, Darkvision, and all movement speeds in one edit sheet
- Combined Passive Scores popover — Perception, Investigation, Insight, and Stealth with override support
- Species field added to character (editable in New Character and Character Stats; shown in header)
- Act tab converted from static HTML to dynamically rendered

---

## [0.2] — 2026-06-25
_Commits: `cc34bdf`, `2f29657` — README_

### Added
- README with app overview, feature list, and usage guide

---

## [0.1] — 2026-06-24
_Commit: `90c03a1` — initial commit_

### Added
- Core app scaffolding: Act, React, Defend, Explore tabs
- Character creation and multi-character switcher
- Ability cards with categories (Attack, Magic, Items, Features) × (Action, Bonus)
- Extra actions panel
- Character Stats editor (ability scores, proficiency, AC, HP, speed)
- D20 loading screen and splash screen
- Dark parchment visual theme (Cinzel + Crimson Text fonts, Tabler icons)
- localStorage persistence
