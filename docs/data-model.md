# Character Data Model

`localStorage` key: `dnd_characters`

```js
{
  id, name, sub, level, cls, species,
  hp, ac, speed, prof,            // prof as string e.g. "+3"
  str, dex, con, int, wis, cha,  // raw scores 1–30
  currentHp: number,              // tracks HP changes mid-session
  deathSaves: {
    successes: [bool, bool, bool],
    failures:  [bool, bool, bool]
  },
  skills: { [key]: 'none'|'prof'|'expert' },
  skillOverrides: { [key]: number|null },
  savingThrows: { [ability]: { prof: bool, override: number|null } },
  resistances: string[], immunities: string[], vulnerabilities: string[],
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
  pinnedActions: string[],   // ability ids pinned to Act tab Pinned Actions block
  pinnedBonus: string[]      // ability ids pinned to Bonus section
}
```

Active character: `localStorage` key `dnd_current_char` (id string).

## Ability Card Fields

- **Attack:** `id, name, badge, desc, toHit, damage, damage2, damageType2, range`
- **Magic:** `id, name, badge, desc, spellLevel, saveOrAttack, damage, range`
- **Items/Features:** `id, name, badge, desc, stat`
