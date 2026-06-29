# D&D Player Card

A mobile-first D&D quick-reference companion designed for use at the table. No install required — open `index.html` in any modern browser and you're ready to play.

---

## Features

- A companion app for quick access info for your D&D character. Each tab (Act, React, Defend, and Explore) let you focus on the most important things you want to remember and keep in front of you when playing.
- **Multiple characters** — create and switch between characters on the fly
- **Act tab** — quick-access buttons for Actions, Bonus Actions, and common Extra Actions (Dash, Dodge, Disengage, Hide, Help, Ready)
- **React tab** — manage your Reactions with custom cards
- **Defend tab** — AC display, resistances/immunities, and Saving Throw bonuses
- **Explore tab** — character traits, passive scores, and a full Skills list with auto-calculated bonuses
- **Persistent storage** — everything saves automatically to your browser's localStorage; no account or server needed
- **Drag-to-dismiss** — on mobile, drag the handle bar at the top of any sheet downward to close it
- **Auto-updating PWA** — the installed Android app updates automatically on next launch whenever new changes are pushed; no reinstall needed

---

## Getting Started

1. Open `index.html` in a browser (Chrome or Safari recommended on mobile)
   - On iOS: tap the Share icon → **Add to Home Screen** to run full-screen without the URL bar
   - On Android: tap the browser menu → **Add to Home Screen** / **Install App**
2. Tap **Create Character** on the welcome screen
3. Fill in your character's name, class, race, level, and ability scores
4. Hit **Save** — your character is ready

To switch characters or create another, tap the avatar icon in the top-left corner.

---

## Tabs

### Act
**Pinned Actions** appear at the top for your most-used combat moves — pin any ability from its detail sheet to surface it here instantly during your turn. End caps on pinned cards are color-coded by type: **crimson** for Attack, **indigo** for Magic. If a Spellcasting Ability is set, **Spell Modifier**, **Spell Attack**, and **Save DC** cards appear below your pinned rows for quick reference; tap any to override the values.

Tap any category button (Attack, Magic, Items, Features) to view your saved abilities for that action type. Tap a card to read the full description. Tap **+ Add** to create a new ability card. Features are categorized as **Feat**, **Origin**, or **Species** and display a type icon in the pinned list. Pinned abilities are removed from the All Abilities list below to avoid duplication — unpinning moves them back.

The **HP Tracker** sits below your Pinned Actions — a draggable color-coded slider (green → yellow → orange → red) that tracks your current hit points and saves automatically. When your HP hits 0, **Death Saving Throws** appear: three Failure (skull) and three Success (heartbeat) buttons that fill in count order; they hide again when HP is restored.

The **Extra Actions** section at the bottom has built-in rule reminders for common actions — tap any to read the full rules text.

### React
Lists your Reaction abilities. Tap **+ Add Reaction** to create one. Tap any card to read or edit it.

### Defend
- **Defense summary** — AC at a glance, plus Resistances, Immunities, and Vulnerabilities always visible at the top; tap any existing tag to edit or delete it; tap **+ Add** inline to add a new entry
- **Saving Throws** — auto-calculated from your ability scores and proficiency bonus; displayed as a single-column list on mobile; tap any row to set proficiency or enter a manual override; tap the circle to quickly toggle proficiency

### Explore
The Explore tab is organized into four sections (the Spellcasting section appears only if a Spellcasting Ability is set):

**Character** — key traits at a glance:
- **Size** — tap to open Character Stats and change your size (Sm / Med / Lg)
- **Darkvision** — tap to set range in feet; displays "None" if not set
- **Movement** — tap to set walk, fly, climb, and swim speeds

**Passive Scores** — auto-calculated from your ability scores and skill proficiencies:
- Passive Perception, Passive Investigation, Passive Insight (each = 10 + skill bonus)

**Spellcasting** *(only visible when Spellcasting Ability is set)* — shows Spell Modifier, Spell Attack bonus, and Spell Save DC, auto-calculated from your spellcasting ability score and proficiency bonus. Tap any card to enter a manual override.

**Skills** — all 18 skills in a 2-column grid with auto-calculated bonuses:
- **Circle icon** (left of each card) — tap to cycle through None → Proficient → Expertise
- **Tap the card** to open a popover where you can set proficiency and enter a manual override bonus
- Proficient bonuses display in amber; manual overrides display in blue with an asterisk (`*`)

---

## Editing a Character

Tap your character name or avatar in the top header to open the Hero Summary. From there you can:
- Upload a portrait photo — tap the avatar circle to choose an image; tap the red × badge (top-right of the circle) to remove it
- See your ability scores, HP, AC, Speed, and Prof bonus at a glance
- Tap **Edit Stats** to open the Character Stats editor

The stats editor lets you update:
- Name, class, level
- Ability scores (STR, DEX, CON, INT, WIS, CHA) — modifier updates live as you type
- Armor Class (AC), Max HP, Speed, Proficiency bonus
- Size (Small / Medium / Large) — displayed as Sm / Med / Lg on the Explore tab
- Spellcasting Ability and Spell Slots (hidden when set to None)

All text and number fields **auto-save when you click away** — no need to press Save for every change. The Save button still works and also closes the overlay.

---

## Import / Export

Transfer characters between devices without re-entering data:

1. Open the **Characters** panel (tap the avatar in the top header, then **Switch**)
2. Tap the **file-export icon** on any character row to generate a compact export code
3. Copy the code and paste it on another device using the **Import Character** button

Codes are compressed and validated on import — only recognized fields are accepted. Avatars (portrait photos) are included in the code if set, which makes the code longer.

---

## Data Storage

All data is stored in `localStorage` under the keys `dnd_characters` and `dnd_current_char`. Clearing your browser's site data will erase your characters. Use **Import/Export** (above) to move characters between devices or keep a backup.

---

## Rules Reference

This app is built around the **D&D 2024 rules (5.5e)**. Ability cards, spell data, weapons, items, and feats are drawn from the [Open5e API](https://open5e.com), which publishes the 2024 SRD 5.2 under the Creative Commons CC-BY-4.0 license.

When you add a Magic, Attack, Items, or Features card, the autocomplete suggestions pull live from Open5e and pre-fill fields using 2024 stat blocks — including spell save DCs, attack bonuses, damage, and descriptions.

---

## Tech Stack

- Vanilla JavaScript (no framework)
- CSS custom properties for theming
- [Tabler Icons](https://tabler.io/icons) webfont
- [Google Fonts](https://fonts.google.com) — Cinzel & Crimson Text
- [Open5e API](https://api.open5e.com/v2/) — 2024 SRD 5.2 (CC-BY-4.0)
- localStorage for persistence
