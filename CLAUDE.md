# Combat Sheet — CLAUDE.md

## What it is
Mobile-first D&D quick-reference companion. Single HTML page, no build step — open `index.html` in a browser. Data lives in `localStorage`. No server, no framework.

## Files
```
index.html       — markup, all overlay elements
js/app.js        — all logic (~1500 lines, single file)
css/style.css    — all styles
README.md        — user-facing docs
CHANGELOG.md     — version history
```

## Pre-push gate (required every push)
Before any `git push`, always update both:
1. **CHANGELOG.md** — document what changed
2. **README.md** — reflect any feature/UI changes

Stage both alongside code. No exceptions.

## Character data model
`localStorage` key: `dnd_characters`
```js
{
  id, name, sub, level, cls, species,
  hp, ac, speed, prof,            // prof as string e.g. "+3"
  str, dex, con, int, wis, cha,  // raw scores 1–30
  skills: { [key]: 'none'|'prof'|'expert' },
  skillOverrides: { [key]: number|null },
  savingThrows: { [ability]: { prof: bool, override: number|null } },
  resistances: string[], immunities: string[],
  abilities: {
    attack_action, magic_action, items_action, features_action,
    attack_bonus,  magic_bonus,  items_bonus,  features_bonus,
    reaction
  },
  avatar: string|null,       // base64 dataURL
  darkvision: number|null,
  flySpeed, climbSpeed, swimSpeed: string|null,
  size: 'small'|'medium'|'large',
  attacksPerRound: number,
  pinnedActions: string[],   // ability ids
  pinnedBonus: string[]
}
```
Active character: `localStorage` key `dnd_current_char` (id string).

## Ability card fields
- **Attack:** `id, name, badge, desc, toHit, damage, damage2, damageType2, range`
- **Magic:** `id, name, badge, desc, spellLevel, saveOrAttack, damage, range`
- **Items/Features:** `id, name, badge, desc, stat`

## Tabs
| Tab | ID | Render function |
|---|---|---|
| Act | `tab-act` | `renderActTab()` |
| React | `tab-reaction` | static HTML + `renderReactions()` |
| Defend | `tab-defense` | `renderDefenseTab()` |
| Explore | `tab-explore` | `renderExploreTab()` |

`renderAllSimpleTabs()` re-renders React + Defend + Explore after any data change.

## Overlay system
All overlays: `<div class="overlay">` — `.open` class shows them.

| ID | Purpose |
|---|---|
| `overlay` | Ability list/edit, extra actions, overrides, resistance add |
| `statOverlay` | Character Stats editor |
| `charOverlay` | Character switcher |
| `heroOverlay` | Hero Summary (avatar, pills, ability scores) |
| `newCharOverlay` | New character creation form |

## Key helpers (app.js)
- `calcSkillBonus(c, skillKey)` — handles overrides, prof, expertise
- `getSaveBonus(c, ability)` — same for saving throws
- `modStr(score)` — "+3"/"-1" from raw score
- `pinnedRowHTML(a, cat, key)` — builds a single pinned row element

## CSS breakpoints
| Name | Min-width | Key changes |
|---|---|---|
| Mobile | default | single column, slide-up overlays |
| Tablet | 600px | container 680px, 3-col skills, centered modal overlays, wider pinned caps |
| Desktop | 1024px | container 1100px, 3-col action buttons, 2-col pinned lists |

## Pinned row structure
Two row types rendered by `pinnedRowHTML()`:
- `.pinned-row` — attack/magic; has slanted end cap with damage/modifier
- `.pinned-row.pinned-row-flat` — features/items; flat layout, no cap, height 50px

End cap classes:
- `.pinned-row-cap` — single damage (168px mobile → 216px tablet+)
- `.pinned-row-cap-dual` — bonus damage present (same widths, two columns inside)

Subtype line (`.pinned-subtype`, color `var(--amber)`): shown for attack, magic, features — not items.
