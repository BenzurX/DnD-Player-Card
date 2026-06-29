# App Architecture Reference

## Tabs

| Tab | ID | Render function |
|---|---|---|
| Act | `tab-act` | `renderActTab()` |
| React | `tab-reaction` | static HTML + `renderReactions()` |
| Defend | `tab-defense` | `renderDefenseTab()` |
| Explore | `tab-explore` | `renderExploreTab()` |

## Overlay System

All overlays: `<div class="overlay">` — `.open` class shows them. Drag handle bar down 120px to dismiss on mobile.

| ID | Purpose |
|---|---|
| `overlay` | Ability list/edit, extra actions, overrides, resistance add |
| `statOverlay` | Character Stats editor |
| `charOverlay` | Character switcher |
| `heroOverlay` | Hero Summary (avatar, pills, ability scores) |
| `newCharOverlay` | New character creation form |

## Key Helpers (app.js)

- `calcSkillBonus(c, skillKey)` — handles overrides, prof, expertise
- `getSaveBonus(c, ability)` — same for saving throws
- `modStr(score)` — "+3"/"-1" from raw score
- `pinnedRowHTML(a, cat, key)` — builds a single pinned row element
- `renderAllSimpleTabs()` — re-renders React + Defend + Explore after any data change
- `hpColorByPct(pct)` — returns color string for HP fill (green/yellow/orange/red)

## CSS Breakpoints

| Name | Min-width | Key changes |
|---|---|---|
| Mobile | default | single column, slide-up overlays |
| Tablet | 600px | container 680px, 3-col skills, centered modal overlays, wider pinned caps |
| Desktop | 1024px | container 1100px, 3-col action buttons, 2-col pinned lists |

## Pinned Row Structure

Two row types rendered by `pinnedRowHTML()`:
- `.pinned-row` — attack/magic; has slanted end cap with damage/modifier
- `.pinned-row.pinned-row-flat` — features/items; flat layout, no cap, height 50px

End cap classes:
- `.pinned-row-cap` — single damage (168px mobile → 216px tablet+)
- `.pinned-row-cap-dual` — bonus damage present (same widths, two columns inside)

Subtype line (`.pinned-subtype`, color `var(--amber)`): shown for attack, magic, features — not items.
