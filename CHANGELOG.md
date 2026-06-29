# Changelog

All notable changes to D&D Player Card are documented here.

---

## [2.4] — 2026-06-29

### Added
- **Character Import/Export** — export any character as a compact shareable code from the Characters panel (tap the file-export icon on any character row); paste the code on another device using **Import Character** to instantly recreate the character with all stats, abilities, and settings intact. Codes are LZ-compressed and validated on import to reject malformed data
- **Remove Avatar** — a red × badge appears in the top-right of the avatar circle in the Hero Summary when a portrait is set; tap it to clear the avatar

---

## [2.3] — 2026-06-27

### Added
- **Filled spell slot hover effect** — mousing over a used (filled) spell slot pip now shows a visible purple glow, matching the empty-pip hover style

### Changed
- **Death save icons hug center divider** — Failure icons are right-aligned (closest to the divider), Successes are left-aligned, so clicking feels like moving outward from center in both directions
- **Death save hover previews click result** — hovering a success icon highlights all icons from the left up to that index; hovering a failure icon highlights that icon and all icons to its right — exactly what will be filled on click (mirrors spell slot pip-preview behavior)

---

## [2.2] — 2026-06-27

### Added
- **HP Tracker** — draggable slider on the Act tab shows current HP with a color-coded fill (green → yellow → orange → red by percentage); drag the thumb or tap the track to set HP; tooltip shows exact value while dragging; current HP persists to localStorage
- **Death Saving Throws** — section appears automatically when HP reaches 0; three Failure (skull) and three Success (heartbeat) icons; click to fill in count-based order (failures right-to-left, successes left-to-right); hides again when HP is restored above 0; saves persist to localStorage
- **Long Rest button** — moon icon in the Spell Slots header resets all used spell slots; icon fills and turns purple on hover

---

## [2.1] — 2026-06-26

### Added
- **Service Worker / PWA auto-update** — `sw.js` caches all app assets on first install and clears stale caches on update; bumping the cache version string in `sw.js` with each push causes installed Android PWAs to update automatically on next launch without reinstalling

---

## [2.0] — 2026-06-26

### Changed
- **Pinned abilities hidden from All Abilities list** — abilities pinned to the Pinned Actions block no longer appear in the All Abilities list below; unpinning an ability moves it back down

---

## [1.9] — 2026-06-26

### Added
- **Spellcasting stats on Act tab** — Spell Modifier, Spell Attack, and Save DC cards now appear in the Pinned Actions block (below pinned rows, above Spell Slots) when a Spellcasting Ability is set; tap any card to open the override sheet

---

## [1.8] — 2026-06-26

### Added
- **Drag-to-dismiss sheets** — on mobile, drag the handle bar downward to close any sheet overlay; release past 120 px to dismiss, release early to snap back

---

## [1.7] — 2026-06-26

### Fixed
- **Edit sheet scroll position** — opening an ability edit/detail sheet now always resets to the top; previously the sheet could open scrolled to the bottom when the prior content was longer

---

## [1.6] — 2026-06-26

### Changed
- **Saving Throws — single column on mobile** — the six saving throw rows now stack in a single column on mobile (was 2 columns); 2 columns restored on tablet+

---

## [1.5] — 2026-06-26

### Added
- **PWA / Add to Home Screen** — added `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `mobile-web-app-capable` meta tags so the app runs full-screen (no URL bar) when added to the home screen on iOS or Android; fixed webmanifest icon paths
- **Spellcasting stats on Explore tab** — Spell Modifier, Spell Attack, and Spell Save DC now appear as a three-card row below Passive Scores (visible only when a Spellcasting Ability is set); values auto-calculate from the ability score and proficiency bonus; tap any card to open an override sheet

### Fixed
- **Desktop 2-column pinned row overflow** — right-column pinned rows were overflowing their grid cells (caps clipped by the container edge); fixed by preventing grid item minimum-content-size from forcing columns wider than 1fr

---

## [1.4] — 2026-06-26

### Added
- **Category-colored end caps** — Attack caps are deep crimson; Magic caps are dark indigo. Text color adapts to each dark background (light rose for attack, light lavender for magic)
- **Parchment texture** — randomized SVG fractalNoise grain applied to the content background on every page load; grunge frequency gives subtle paper variation without overwhelming the palette

---

## [1.3] — 2026-06-26

### Changed
- **Spellcasting Ability** — "None" label replaces "—" in the segmented control for clarity
- **Defense summary labels** — Resistances/Immunities/Vulnerabilities section headers now 16px (up from 11px); icons 20px for prominence
- **Resist pill color** — shifted from teal-green to leaf-green (`#3A7A20`) so it reads clearly as green
- **Immunities + Add button** — now uses amber (`--amber`) color for better readability against the parchment background

### Fixed
- **Adv/Disadv badge tooltips** — the A/D hex badges in Skills (Explore tab) and Saving Throws (Defend tab) now show "Advantage" / "Disadvantage" tooltip on hover

### Removed
- **Duplicate defense sections** — the Resistances, Immunities, and Vulnerabilities sections that appeared below Saving Throws have been removed; manage these from the summary box at the top of the Defend tab

---

## [1.2] — 2026-06-26

### Changed
- **Character Stats auto-save on blur** — every text/number input in the Character Stats editor now auto-saves when you click away, without needing to press Save. The Save button still works and also closes the overlay; Cancel closes without committing unsaved segmented-control changes.

### Reverted
- **Hero Card inline editing** — HP, AC, Speed, and Proficiency pills are back to read-only display. Edit these via Character Stats instead (which now auto-saves).

---

## [1.1] — 2026-06-26

### Changed
- **Defense summary box** — Resistances, Immunities, and Vulnerabilities sections now always visible (no longer hidden when empty); labels show full terms; icons added to each label; inline **+ Add** pill button at end of each tag row
- **Tag colors** — Resistances are now green, Immunities are gold, Vulnerabilities are red (was: blue, orange, red)

---

## [1.0] — 2026-06-26

### Added
- **Vulnerabilities section** — new section in the Defend tab (alongside Resistances and Immunities) with red `shield-down` icon; supports add/edit/delete the same way as the others
- **Hero card inline editing** — HP, AC, Speed, and Proficiency bonus on the Hero Summary are now editable inputs; clicking out auto-saves without opening Character Stats
- **Spell Slots auto-hide** — Spell Slots configuration section in Character Stats hides automatically when Spellcasting Ability is set to "—"

### Changed
- **Resistances icon** → `shield-up` (green); **Immunities icon** → `shield-cancel` (gold); icons appear in section headers and Add/Edit sheet titles
- **"Prof" → "Proficiency"** — hero card pill label now fully spelled out
- **Description field doubled in height** — textarea min-height increased from 96 px to 192 px for better visibility
- **Items: Type field removed** — item cards no longer show a separate Type dropdown; Action Type (Action/Bonus Action) is the single source of truth for the badge
- **Tooltip flicker fix** — tooltips no longer disappear briefly when hovering over child elements (icons inside tags); hide delay increased to 150 ms

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
