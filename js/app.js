// ── STATE ─────────────────────────────────────────────────────
let characters    = JSON.parse(localStorage.getItem('dnd_characters') || 'null') || [];
let currentCharId = localStorage.getItem('dnd_current_char') || null;
let draggingHp    = false;
let hpDragCallback = null;

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function currentChar() {
  return characters.find(c => c.id === currentCharId) || characters[0] || null;
}

function save() {
  localStorage.setItem('dnd_characters', JSON.stringify(characters));
  localStorage.setItem('dnd_current_char', currentCharId || '');
}

function hpColorByPct(pct) {
  if (pct > 0.75) return '#2d8a3e';
  if (pct > 0.50) return '#c4a000';
  if (pct > 0.25) return '#d47800';
  return '#8b1a1a';
}

// ── OPEN5E SPELL LOOKUP ───────────────────────────────────────
async function fetchSpellSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const r = await fetch(`https://api.open5e.com/v2/spells/?name__icontains=${encodeURIComponent(query)}&limit=20&ordering=name`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.results || []).filter(s => s.key && s.key.startsWith('srd-2024_'));
  } catch { return []; }
}

function fillSpellForm(spell) {
  const LEVEL_LABELS = ['Cantrip','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];

  const nameEl = document.getElementById('f-name');
  if (nameEl) nameEl.value = spell.name || '';

  const levelEl = document.getElementById('f-spellLevel');
  if (levelEl) {
    const lvl = Number.isFinite(spell.level_int) ? spell.level_int
              : Number.isFinite(spell.level)     ? spell.level
              : 0;
    levelEl.value = LEVEL_LABELS[lvl] || 'Cantrip';
  }

  const rangeEl = document.getElementById('f-range');
  if (rangeEl) rangeEl.value = spell.range_text || spell.range || '';

  const durEl = document.getElementById('f-duration');
  if (durEl) durEl.value = spell.duration || '';

  const isConc = spell.concentration === 'yes' || spell.concentration === true;
  const concEl = document.getElementById('f-concentration');
  if (concEl) concEl.value = isConc ? 'Yes' : 'No';

  const ritualEl = document.getElementById('f-ritual');
  if (ritualEl) ritualEl.value = (spell.ritual === 'yes' || spell.ritual === true) ? 'Yes' : 'No';

  const schoolEl = document.getElementById('f-school');
  if (schoolEl) schoolEl.value = (spell.school && typeof spell.school === 'object' ? spell.school.name : spell.school) || '';

  const componentsEl = document.getElementById('f-components');
  if (componentsEl) {
    if (typeof spell.verbal !== 'undefined') {
      const parts = [];
      if (spell.verbal) parts.push('V');
      if (spell.somatic) parts.push('S');
      if (spell.material) parts.push('M');
      componentsEl.value = parts.join(', ');
    } else {
      componentsEl.value = spell.components || '';
    }
  }

  const desc = spell.desc || '';

  // Character stats used by both attack/save and healing calculations.
  const c        = currentChar();
  const prof     = c ? (parseInt(c.prof) || 2) : 2;
  const spellAb  = (c && c.spellAbility && c.spellAbility !== 'none') ? c.spellAbility : null;
  const spellMod = spellAb ? getAbilityMod(c[spellAb] || 10) : null;

  const saveEl = document.getElementById('f-saveOrAttack');
  if (saveEl) {
    const hasAttack = spell.attack_roll === true;
    const saveAbility = spell.saving_throw_ability || '';

    if (hasAttack && spellMod !== null) {
      const bonus = prof + spellMod;
      saveEl.value = (bonus >= 0 ? '+' : '') + bonus + ' Spell Attack';
    } else if (saveAbility && spellMod !== null) {
      const dc = 8 + prof + spellMod;
      saveEl.value = saveAbility.slice(0, 3).toUpperCase() + ' Save DC ' + dc;
    } else if (hasAttack) {
      saveEl.value = 'Spell Attack';
    } else if (saveAbility) {
      saveEl.value = saveAbility.slice(0, 3).toUpperCase() + ' Save';
    } else {
      saveEl.value = '';
    }
  }

  const castEl = document.getElementById('f-castingTime');
  if (castEl) {
    const ctMap = { action: '1 Action', bonus_action: '1 Bonus Action', reaction: '1 Reaction' };
    castEl.value = ctMap[spell.casting_time] || spell.casting_time || '';
  }

  const damageEl = document.getElementById('f-damage');
  if (damageEl) {
    const dmgRoll  = spell.damage_roll || '';
    const dmgTypes = spell.damage_types || [];
    const tempMatch = desc.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+temporary hit points/i);

    if (dmgRoll && dmgTypes.length > 0) {
      const t = dmgTypes[0];
      damageEl.value = dmgRoll + ' ' + t[0].toUpperCase() + t.slice(1);
    } else if (tempMatch) {
      damageEl.value = tempMatch[1].replace(/\s+/g, '') + ' Temp HP';
    } else if (/hit points/i.test(desc)) {
      const diceMatch = desc.match(/(\d+d\d+)/);
      if (diceMatch) {
        const dice = diceMatch[1];
        const hasSpellMod = /spellcasting ability modifier/i.test(desc);
        if (hasSpellMod && spellMod !== null) {
          damageEl.value = dice + (spellMod >= 0 ? '+' : '') + spellMod + ' Healing';
        } else {
          damageEl.value = dice + ' Healing';
        }
      } else {
        damageEl.value = '';
      }
    } else {
      damageEl.value = '';
    }
  }

  const badgeEl = document.getElementById('f-badge');
  if (badgeEl) badgeEl.value = (spell.attack_roll === true) ? 'spell-attack' : 'spell';

  const descEl = document.getElementById('f-desc');
  if (descEl) descEl.value = spell.desc || '';
}

// ── WEAPON LOOKUP ─────────────────────────────────────────────
// The Open5e weapons endpoint ignores name filters and always returns all weapons,
// so we preload the full list once and filter client-side.
let _weaponCache = null;
let _featureCache = null;

const SRD_CLASS_NAMES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];

async function _loadClassFeatures() {
  if (_featureCache) return _featureCache;
  try {
    const perClass = await Promise.all(
      SRD_CLASS_NAMES.map(async cls => {
        try {
          const r = await fetch(`https://www.dnd5eapi.co/api/classes/${cls.toLowerCase()}/features`);
          if (!r.ok) return [];
          const data = await r.json();
          return (data.results || []).map(f => ({ ...f, _kind: 'class_feature', _className: cls }));
        } catch { return []; }
      })
    );
    _featureCache = perClass.flat();
  } catch { _featureCache = []; }
  return _featureCache;
}

async function _loadWeapons() {
  if (_weaponCache) return _weaponCache;
  try {
    const r = await fetch('https://api.open5e.com/v2/weapons/?limit=100&ordering=name');
    if (!r.ok) { _weaponCache = []; return _weaponCache; }
    const data = await r.json();
    _weaponCache = (data.results || []).filter(w => w.key && w.key.startsWith('srd-2024_'));
  } catch { _weaponCache = []; }
  return _weaponCache;
}

async function fetchWeaponSuggestions(query) {
  if (!query || query.length < 2) return [];
  const all = await _loadWeapons();
  const q = query.toLowerCase();
  return all.filter(w => w.name && w.name.toLowerCase().includes(q));
}

function fillWeaponForm(weapon) {
  const nameEl = document.getElementById('f-name');
  if (nameEl) nameEl.value = weapon.name || '';

  const dmgType = weapon.damage_type && typeof weapon.damage_type === 'object'
    ? weapon.damage_type.name : (weapon.damage_type || '');
  const dmgEl = document.getElementById('f-damage');
  if (dmgEl) dmgEl.value = weapon.damage_dice ? weapon.damage_dice + (dmgType ? ' ' + dmgType : '') : '';

  const props = weapon.properties || [];
  const masteryProp = props.find(p => p.property && p.property.type === 'Mastery');
  const nonMasteryProps = props.filter(p => p.property && p.property.type !== 'Mastery');
  const propsStr = nonMasteryProps.map(p => {
    const n = p.property.name;
    return p.detail ? `${n} (${p.detail})` : n;
  }).join(', ');

  const propsEl = document.getElementById('f-properties');
  if (propsEl) propsEl.value = propsStr;

  const masteryEl = document.getElementById('f-mastery');
  if (masteryEl) masteryEl.value = masteryProp ? masteryProp.property.name : '';

  const rangeEl = document.getElementById('f-range');
  if (rangeEl) {
    if (weapon.range > 0) {
      rangeEl.value = weapon.long_range > weapon.range
        ? `${weapon.range}/${weapon.long_range} ft.`
        : `${weapon.range} ft.`;
    } else {
      rangeEl.value = '5 ft.';
    }
  }

  const badgeEl = document.getElementById('f-badge');
  if (badgeEl) {
    const isThrown = props.some(p => p.property && p.property.name === 'Thrown');
    badgeEl.value = weapon.range > 0 ? 'ranged' : isThrown ? 'thrown' : 'melee';
  }

  // Auto-calculate to hit from character stats
  const c = currentChar();
  if (c) {
    const prof     = parseInt(c.prof) || 2;
    const isFinesse = props.some(p => p.property && p.property.name === 'Finesse');
    const isRanged  = weapon.range > 0;
    let mod;
    if (isFinesse) {
      const strMod = getAbilityMod(c.str || 10);
      const dexMod = getAbilityMod(c.dex || 10);
      mod = Math.max(strMod, dexMod);
    } else if (isRanged) {
      mod = getAbilityMod(c.dex || 10);
    } else {
      mod = getAbilityMod(c.str || 10);
    }
    const toHitEl = document.getElementById('f-toHit');
    if (toHitEl) toHitEl.value = (prof + mod >= 0 ? '+' : '') + (prof + mod);
  }
}

// ── ITEM LOOKUP ───────────────────────────────────────────────
async function fetchItemSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const [r1, r2] = await Promise.all([
      fetch(`https://api.open5e.com/v2/items/?name__icontains=${encodeURIComponent(query)}&limit=15&ordering=name`),
      fetch(`https://api.open5e.com/v2/magicitems/?name__icontains=${encodeURIComponent(query)}&limit=10&ordering=name`),
    ]);
    const [d1, d2] = await Promise.all([r1.ok ? r1.json() : {results:[]}, r2.ok ? r2.json() : {results:[]}]);
    const all = [...(d1.results || []), ...(d2.results || [])];
    return all.filter(i => i.key && i.key.startsWith('srd-2024_'));
  } catch { return []; }
}

function fillItemForm(item) {
  const nameEl = document.getElementById('f-name');
  if (nameEl) nameEl.value = item.name || '';

  const catEl = document.getElementById('f-itemCategory');
  if (catEl) catEl.value = (item.category && typeof item.category === 'object' ? item.category.name : item.category) || (item.rarity ? 'Magic Item' : '');

  const rarityEl = document.getElementById('f-rarity');
  if (rarityEl) rarityEl.value = item.rarity || '';

  const costEl = document.getElementById('f-cost');
  if (costEl) {
    const raw = parseFloat(item.cost);
    costEl.value = raw > 0 ? (Number.isInteger(raw) ? raw + ' gp' : raw.toFixed(2) + ' gp') : '';
  }

  const weightEl = document.getElementById('f-weight');
  if (weightEl) {
    const raw = parseFloat(item.weight);
    weightEl.value = raw > 0 ? raw + ' lb' : '';
  }

  const descEl = document.getElementById('f-desc');
  if (descEl) descEl.value = item.desc || '';
}

// ── FEAT / SPECIES / CLASS FEATURE LOOKUP ─────────────────────
async function fetchFeatSuggestions(query) {
  if (!query || query.length < 2) return [];
  const safeFetch = async url => {
    try {
      const r = await fetch(url);
      return r.ok ? await r.json() : { results: [] };
    } catch { return { results: [] }; }
  };
  const q = query.toLowerCase();
  const [d1, allFeatures] = await Promise.all([
    safeFetch(`https://api.open5e.com/v2/feats/?name__icontains=${encodeURIComponent(query)}&limit=10&ordering=name`),
    _loadClassFeatures(),
  ]);
  const feats    = (d1.results || []).filter(f => f.key && f.key.startsWith('srd-2024_')).map(f => ({...f, _kind: 'feat'}));
  const features = allFeatures.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  return [...feats, ...features];
}

async function fetchSpeciesSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const r = await fetch(`https://api.open5e.com/v2/species/?name__icontains=${encodeURIComponent(query)}&limit=8&ordering=name`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.results || []).filter(s => s.key && s.key.startsWith('srd-2024_'));
  } catch { return []; }
}

async function fetchClassSuggestions(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return SRD_CLASS_NAMES.filter(c => c.toLowerCase().startsWith(q));
}

async function fillFeatForm(entry) {
  const nameEl = document.getElementById('f-name');
  if (nameEl) nameEl.value = entry.name || '';

  if (entry._kind === 'class_feature') {
    const badgeEl = document.getElementById('f-badge');
    if (badgeEl) badgeEl.value = 'class';

    // Fetch full details (list endpoint only has index/name/url)
    try {
      const r = await fetch(`https://www.dnd5eapi.co${entry.url}`);
      if (r.ok) {
        const full = await r.json();
        const prereqEl = document.getElementById('f-prerequisite');
        if (prereqEl) {
          const cls = full.class?.name || full.subclass?.name || '';
          const lvl = full.level;
          prereqEl.value = cls && lvl ? `${cls} Level ${lvl}` : cls || '';
        }
        const descEl = document.getElementById('f-desc');
        if (descEl) descEl.value = Array.isArray(full.desc) ? full.desc.join('\n\n') : (full.desc || '');
      }
    } catch { /* leave fields blank on error */ }

    const hintEl = document.getElementById('f-desc-hint');
    if (hintEl) hintEl.style.display = '';

  } else if (entry._kind === 'species') {
    const badgeEl = document.getElementById('f-badge');
    if (badgeEl) badgeEl.value = 'species';

    const prereqEl = document.getElementById('f-prerequisite');
    if (prereqEl) prereqEl.value = '';

    const descEl = document.getElementById('f-desc');
    if (descEl) {
      const traits = (entry.traits || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(t => `${t.name}. ${t.desc}`)
        .join('\n\n');
      descEl.value = traits || entry.desc || '';
    }

    const hintEl = document.getElementById('f-desc-hint');
    if (hintEl) hintEl.style.display = 'none';
  } else {
    const badgeEl = document.getElementById('f-badge');
    if (badgeEl) badgeEl.value = (entry.type && entry.type.toLowerCase() === 'origin') ? 'origin' : 'feat';

    const prereqEl = document.getElementById('f-prerequisite');
    if (prereqEl) prereqEl.value = entry.has_prerequisite ? (entry.prerequisite || '') : '';

    const descEl = document.getElementById('f-desc');
    if (descEl) {
      const benefits = (entry.benefits || []).map(b => b.desc || b).join('\n\n');
      descEl.value = entry.desc ? (benefits ? entry.desc + '\n\n' + benefits : entry.desc) : benefits;
    }

    const hintEl = document.getElementById('f-desc-hint');
    if (hintEl) hintEl.style.display = 'none';
  }
}

function blankSpellSlots() {
  const s = {};
  for (let i = 1; i <= 9; i++) s[i] = { max: 0, used: 0 };
  return s;
}

const SLOT_ORDINALS = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];

function blankAbilities() {
  return {
    attack_action: [], magic_action: [], items_action: [], features_action: [],
    attack_bonus:  [], magic_bonus:  [], items_bonus:  [], features_bonus:  [],
    reaction: [],
  };
}

// ── CATEGORY CONFIG ───────────────────────────────────────────
// Used by openCategorySheet, openAddSheet, and openEditSheet
const CATEGORIES = {
  attack:   { icon: 'ti-sword',    color: 'c-red',    label: 'Attack' },
  magic:    { icon: 'ti-wand',     color: 'c-purple', label: 'Magic' },
  items:    { icon: 'ti-flask-2',  color: 'c-green',  label: 'Items' },
  features: { icon: 'ti-sparkles', color: 'c-amber',  label: 'Features' },
  reaction: { icon: 'ti-bolt',     color: 'c-purple', label: 'Reaction' },
};

// ── EXTRA ACTIONS ─────────────────────────────────────────────
const EXTRA_ACTIONS = {
  dash: {
    icon: 'ti-shoe', color: 'c-blue', label: 'Dash',
    desc: "Gain extra movement equal to your Speed for this turn. With a Speed of {{SPEED}}, for example, you can move up to {{SPEED2}} on your turn. Any increase or decrease to your Speed changes this additional movement by the same amount.",
  },
  dodge: {
    icon: 'ti-run', color: 'c-plum', label: 'Dodge',
    desc: "Until the start of your next turn, Attack Rolls made against you have Disadvantage if you can see the attacker, and you make Dexterity Saving Throws with Advantage. This benefit ends if you have the Incapacitated condition or if your Speed drops to 0.",
  },
  disengage: {
    icon: 'ti-cloud', color: 'c-blue', label: 'Disengage',
    desc: "Your movement does not provoke Opportunity Attacks for the rest of the turn.",
  },
  hide: {
    icon: 'ti-eye-off', color: 'c-slate', label: 'Hide',
    desc: "Make a Dexterity (Stealth) check to conceal yourself. You must be Heavily Obscured or behind cover and out of any enemy line of sight. On a success, you gain the Invisible condition. The DCs of Perception checks made to find you equal your Stealth check total.",
  },
  help: {
    icon: 'ti-heart-handshake', color: 'c-sage', label: 'Help',
    desc: "Choose one of your allies and a task. Until the start of your next turn, that ally has Advantage on the first ability check they make for that task. Alternatively, choose an ally and a creature within 5 ft. of you both — until the start of your next turn, that ally has Advantage on their first attack roll against that creature.",
  },
  ready: {
    icon: 'ti-clock-pause', color: 'c-gold', label: 'Ready',
    desc: "Decide on a perceivable trigger and the action or movement you will take in response. When the trigger occurs before the start of your next turn, you can use your Reaction to act on it — or ignore it. Taking the Ready action expends your Reaction.",
  },
  influence: {
    icon: 'ti-brand-hipchat', color: 'c-purple', label: 'Influence',
    desc: "Make a Charisma check (Deception, Intimidation, Performance, or Persuasion) to alter the attitude of a creature that can see or hear you. The DM decides which skill applies and sets the DC.",
  },
  search: {
    icon: 'ti-zoom-question', color: 'c-green', label: 'Search',
    desc: "Make a Wisdom (Perception) check to spot, hear, or sense something concealed, or make an Intelligence (Investigation) check to search an area for clues or hidden objects. The DM tells you which check to make and sets the DC.",
  },
  study: {
    icon: 'ti-book', color: 'c-blue', label: 'Study',
    desc: "Make an Intelligence check to recall lore or assess information. Arcana covers magic and planes; History covers past events; Nature covers plants, animals, and weather; Religion covers deities and rites. The DM chooses the skill and sets the DC.",
  },
  utilize: {
    icon: 'ti-tool', color: 'c-amber', label: 'Utilize',
    desc: "Use a nonmagical object in the environment. If the object requires skill to operate, make a Dexterity (Sleight of Hand) check or an appropriate tool check. Objects simple enough to require no special training need no check.",
  },
};

// ── ABILITY SCORE HELPERS ─────────────────────────────────────
function getAbilityMod(score) {
  return Math.floor((score - 10) / 2);
}

const ABILITY_ICON = {
  dex: { icon: 'ti-target-arrow',  cls: 'c-green'  },
  cha: { icon: 'ti-music',         cls: 'c-purple'  },
  int: { icon: 'ti-brain',         cls: 'c-blue'    },
  str: { icon: 'ti-barbell',       cls: 'c-red'     },
  con: { icon: 'ti-heart',         cls: 'c-red'     },
  wis: { icon: 'ti-scale',         cls: 'c-orange'  },
};

function abilityIcon(ab) {
  const a = ABILITY_ICON[ab.toLowerCase()];
  if (!a) return '';
  return `<i class="ti ${a.icon} ${a.cls} skill-ability-icon"></i>`;
}

function modStr(score) {
  const m = getAbilityMod(score);
  return (m >= 0 ? '+' : '') + m;
}

function tagCheckBonuses(html, c) {
  if (!html || !c) return html;

  // Resolve speed tokens before regex passes
  if (html.includes('{{SPEED}}') || html.includes('{{SPEED2}}')) {
    const speedNum = parseInt(c.speed) || 30;
    const s1 = speedNum + ' ft.';
    const s2 = (speedNum * 2) + ' ft.';
    html = html
      .replace(/\{\{SPEED\}\}/g, `<span class="check-tag" data-tooltip="Your base walking speed">${s1}</span>`)
      .replace(/\{\{SPEED2\}\}/g, `<span class="check-tag" data-tooltip="Double your walking speed (Dash)">${s2}</span>`);
  }

  const abilityMods = {
    'strength': modStr(c.str), 'dexterity': modStr(c.dex),
    'constitution': modStr(c.con), 'intelligence': modStr(c.int),
    'wisdom': modStr(c.wis), 'charisma': modStr(c.cha),
  };
  const skillNameToKey = {
    'acrobatics': 'acrobatics', 'animal handling': 'animalHandling',
    'arcana': 'arcana', 'athletics': 'athletics', 'deception': 'deception',
    'history': 'history', 'insight': 'insight', 'intimidation': 'intimidation',
    'investigation': 'investigation', 'medicine': 'medicine', 'nature': 'nature',
    'perception': 'perception', 'performance': 'performance', 'persuasion': 'persuasion',
    'religion': 'religion', 'sleight of hand': 'sleightOfHand',
    'stealth': 'stealth', 'survival': 'survival',
  };
  const abilityToShort = {
    'strength': 'str', 'dexterity': 'dex', 'constitution': 'con',
    'intelligence': 'int', 'wisdom': 'wis', 'charisma': 'cha',
  };
  const skillToAbility = {
    'acrobatics': 'dex', 'animalHandling': 'wis', 'arcana': 'int',
    'athletics': 'str', 'deception': 'cha', 'history': 'int',
    'insight': 'wis', 'intimidation': 'cha', 'investigation': 'int',
    'medicine': 'wis', 'nature': 'int', 'perception': 'wis',
    'performance': 'cha', 'persuasion': 'cha', 'religion': 'int',
    'sleightOfHand': 'dex', 'stealth': 'dex', 'survival': 'wis',
  };
  const fmt = n => (n >= 0 ? '+' : '') + n;
  const toTitle = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const mkAbilityIcon = (key) => {
    if (!key) return '';
    const a = ABILITY_ICON[key];
    return a ? `<i class="ti ${a.icon} ${a.cls} check-tag-icon"></i>` : '';
  };
  const mkTag = (bonus, label, abilityKey = null) =>
    ` <span class="check-tag" data-tooltip="${label}">${bonus}${mkAbilityIcon(abilityKey)}</span>`;

  // Pattern 1: Ability (Skill) check[s] — skill parens before "check", tag after "check"
  html = html.replace(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(\([^)]+\))\s+(checks?)/gi,
    (match, ability, parens, checkWord) => {
      const inner = parens.slice(1, -1).trim().toLowerCase();
      const abilityTitle = toTitle(ability);
      const skillKey = !inner.includes(',') ? skillNameToKey[inner] : null;
      if (skillKey) {
        const skillTitle = inner.replace(/\b\w/g, l => l.toUpperCase());
        const bonus = fmt(calcSkillBonus(c, skillKey));
        return `${ability} ${parens} ${checkWord}${mkTag(bonus, `${abilityTitle} (${skillTitle}) check`, skillToAbility[skillKey])}`;
      }
      const bonus = abilityMods[ability.toLowerCase()];
      return `${ability} ${parens} ${checkWord}${mkTag(bonus, `${abilityTitle} ability check`, abilityToShort[ability.toLowerCase()])}`;
    }
  );

  // Pattern 1b: Ability check[s] (Skill1, Skill2, ...) — multi-skill list after "check",
  // tag each skill individually instead of tagging "check" itself
  html = html.replace(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(checks?)\s+(\([^)]+\))/gi,
    (match, ability, checkWord, parens) => {
      const inner = parens.slice(1, -1);
      if (!inner.includes(',')) return match;
      const taggedInner = inner.replace(
        /\b(Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival)\b/gi,
        (skillMatch) => {
          const skillKey = skillNameToKey[skillMatch.toLowerCase()];
          if (!skillKey) return skillMatch;
          return `${skillMatch}${mkTag(fmt(calcSkillBonus(c, skillKey)), `${skillMatch} check`, skillToAbility[skillKey])}`;
        }
      );
      return `${ability} ${checkWord} (${taggedInner})`;
    }
  );

  // Pattern 2: plain Ability check[s] not followed by ( — tag after "check" with ability mod
  html = html.replace(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(checks?)(?!\s*\()/gi,
    (match, ability, checkWord) => {
      const abilityTitle = toTitle(ability);
      const bonus = abilityMods[ability.toLowerCase()];
      return `${ability} ${checkWord}${mkTag(bonus, `${abilityTitle} ability check`, abilityToShort[ability.toLowerCase()])}`;
    }
  );

  // Pattern 3: Ability saving throw[s] — tag after "throw[s]" with the character's save bonus
  html = html.replace(
    /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(saving throws?)/gi,
    (match, ability, throwPhrase) => {
      const abilityTitle = toTitle(ability);
      const shortKey = abilityToShort[ability.toLowerCase()];
      const bonus = fmt(getSaveBonus(c, shortKey));
      return `${ability} ${throwPhrase}${mkTag(bonus, `${abilityTitle} saving throw`, shortKey)}`;
    }
  );

  // Pattern 4: "Advantage" / "Disadvantage" anywhere — append the hex adv-badge icon
  html = html.replace(
    /\b(Advantage|Disadvantage)\b/gi,
    (match, word) => {
      const isAdv = word.toLowerCase() === 'advantage';
      const cls   = isAdv ? 'adv-badge-adv' : 'adv-badge-disadv';
      const letter = isAdv ? 'A' : 'D';
      return `${word} <span class="adv-badge ${cls}" data-tooltip="${word}">${letter}</span>`;
    }
  );

  // Pattern 5: D&D conditions/status effects — wrap the word itself as a .condition-tag
  // Uses (<[^>]*>) alternation to skip over already-injected HTML tags safely.
  const CONDITIONS = {
    'heavily obscured': "Effectively Blinded — creatures here can't see. Sight-based attacks and checks have disadvantage.",
    'lightly obscured': "Disadvantage on Perception checks relying on sight.",
    'blinded':          "Can't see; fail sight-based checks. Attacks against you have advantage; your attacks have disadvantage.",
    'charmed':          "Can't attack the charmer. They have advantage on social checks against you.",
    'deafened':         "Can't hear; auto-fail hearing-based checks.",
    'exhaustion':       "Cumulative: 1) disadv. on checks  2) halved speed  3) disadv. on attacks/saves  4) half max HP  5) speed 0  6) death.",
    'frightened':       "Disadvantage on checks and attacks while the source is visible. Can't willingly move closer to it.",
    'grappled':         "Speed becomes 0. Ends when the grappler is incapacitated or you leave their reach.",
    'incapacitated':    "Can't take actions or reactions.",
    'invisible':        "Can't be seen. Your attacks have advantage; attacks against you have disadvantage.",
    'paralyzed':        "Incapacitated, can't move or speak. Auto-fail Str/Dex saves. Attacks have advantage; melee hits within 5 ft. are critical.",
    'petrified':        "Turned to stone. Incapacitated, immovable, resistance to all damage. Auto-fail Str/Dex saves.",
    'poisoned':         "Disadvantage on attack rolls and ability checks.",
    'prone':            "Disadvantage on attacks. Melee attacks within 5 ft. have advantage against you; ranged attacks have disadvantage. Half movement to stand up.",
    'restrained':       "Speed 0. Attacks against you have advantage; your attacks have disadvantage. Disadvantage on Dex saves.",
    'stunned':          "Incapacitated, can't move. Auto-fail Str/Dex saves. Attacks against you have advantage.",
    'unconscious':      "Incapacitated and prone, unaware of surroundings. Auto-fail Str/Dex saves. Attacks have advantage; melee hits within 5 ft. are critical.",
  };
  const condKeys = Object.keys(CONDITIONS).sort((a, b) => b.length - a.length);
  const condAlts = condKeys.map(k => k.replace(/\s+/g, '\\s+')).join('|');
  html = html.replace(
    new RegExp(`(<[^>]*>)|\\b(${condAlts})\\b`, 'gi'),
    (match, tag, word) => {
      if (tag) return tag;
      const tooltip = CONDITIONS[word.toLowerCase().replace(/\s+/g, ' ')];
      return tooltip ? `<span class="condition-tag" data-tooltip="${tooltip}">${word}</span>` : word;
    }
  );

  return html;
}

// Ensures a to-hit value is always displayed with an explicit sign (+8, -1, +0).
function normalizeBonus(val) {
  if (!val) return val;
  const s = String(val).trim();
  if (!s || s.startsWith('+') || s.startsWith('-')) return s;
  const n = Number(s);
  return isNaN(n) ? s : (n >= 0 ? '+' : '') + n;
}

// Returns the total skill bonus for a character, accounting for overrides,
// proficiency, and expertise. Used by the skill grid and passive score cards.
function calcSkillBonus(c, skillKey) {
  if (!c) return 0;
  const skill = SKILLS.find(s => s.key === skillKey);
  if (!skill) return 0;
  const over = (c.skillOverrides || {})[skillKey];
  // Explicit null check because 0 is a valid override value
  if (over !== null && over !== undefined) return over;
  const state   = (c.skills || {})[skillKey] || 'none';
  const mod     = getAbilityMod(c[skill.ability] || 10);
  const profNum = parseInt(c.prof || '+2') || 2;
  if (state === 'expert') return mod + profNum * 2;
  if (state === 'prof')   return mod + profNum;
  return mod;
}

// ── SKILLS ───────────────────────────────────────────────────
const SKILLS = [
  { name: 'Acrobatics',      key: 'acrobatics',    ability: 'dex' },
  { name: 'Animal Handling', key: 'animalHandling', ability: 'wis' },
  { name: 'Arcana',          key: 'arcana',         ability: 'int' },
  { name: 'Athletics',       key: 'athletics',      ability: 'str' },
  { name: 'Deception',       key: 'deception',      ability: 'cha' },
  { name: 'History',         key: 'history',        ability: 'int' },
  { name: 'Insight',         key: 'insight',        ability: 'wis' },
  { name: 'Intimidation',    key: 'intimidation',   ability: 'cha' },
  { name: 'Investigation',   key: 'investigation',  ability: 'int' },
  { name: 'Medicine',        key: 'medicine',       ability: 'wis' },
  { name: 'Nature',          key: 'nature',         ability: 'int' },
  { name: 'Perception',      key: 'perception',     ability: 'wis' },
  { name: 'Performance',     key: 'performance',    ability: 'cha' },
  { name: 'Persuasion',      key: 'persuasion',     ability: 'cha' },
  { name: 'Religion',        key: 'religion',       ability: 'int' },
  { name: 'Sleight of Hand', key: 'sleightOfHand',  ability: 'dex' },
  { name: 'Stealth',         key: 'stealth',        ability: 'dex' },
  { name: 'Survival',        key: 'survival',       ability: 'wis' },
];

function blankSkills() {
  const s = {};
  SKILLS.forEach(sk => { s[sk.key] = 'none'; });
  return s;
}

function blankSavingThrows() {
  const st = {};
  ['str','dex','con','int','wis','cha'].forEach(ab => { st[ab] = { prof: false, override: null }; });
  return st;
}

// Shared lookup used by renderDefenseTab and openSaveOverrideSheet
const ABILITY_NAMES = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

function getSaveBonus(c, ability) {
  if (!c) return 0;
  const st      = (c.savingThrows || {})[ability] || { prof: false, override: null };
  if (st.override !== null && st.override !== undefined) return st.override;
  const mod     = getAbilityMod(c[ability] || 10);
  const profNum = parseInt(c.prof || '+2') || 2;
  return st.prof ? mod + profNum : mod;
}

// ── LOADING SCREEN ────────────────────────────────────────────
function hideLoading() {
  const el = document.getElementById('loading');
  el.classList.add('fade-out');
  // If welcome is waiting underneath, cross-fade it in simultaneously
  const wel = document.getElementById('welcome');
  if (wel.style.display !== 'none') {
    requestAnimationFrame(() => wel.classList.add('visible'));
  }
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

// ── WELCOME SCREEN ────────────────────────────────────────────
function showWelcome(immediate = false) {
  document.getElementById('app').style.display = 'none';
  const wel = document.getElementById('welcome');
  wel.style.display = 'flex';
  // immediate=true for post-delete reveal; false when loading screen will cross-fade it in
  if (immediate) requestAnimationFrame(() => wel.classList.add('visible'));
}

function hideWelcome() {
  const wel = document.getElementById('welcome');
  wel.classList.remove('visible');
  wel.style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

document.getElementById('welcomeCreate').addEventListener('click', () => {
  openNewCharSheet(true);
});

// ── NEW CHARACTER FORM ────────────────────────────────────────
// fromWelcome: true when called from the splash screen — hides welcome on success
function openNewCharSheet(fromWelcome) {
  document.getElementById('newCharBody').innerHTML = `
    <div class="edit-form">

      <div class="form-row">
        <label class="form-label"><i class="ti ti-user"></i> Character Name</label>
        <input class="form-input" id="nc-name" placeholder="John Dungeon" autocomplete="off">
      </div>

      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-crown"></i> Level</label>
          <input class="form-input" id="nc-level" type="number" min="1" max="20" placeholder="1">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-award"></i> Prof. Bonus</label>
          <input class="form-input" id="nc-prof" placeholder="+1">
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-row" style="position:relative;">
          <label class="form-label"><i class="ti ti-wand"></i> Class</label>
          <input class="form-input" id="nc-class" placeholder="Fighter" autocomplete="off">
          <div class="spell-suggestions" id="nc-class-suggestions"></div>
        </div>
        <div class="form-row" style="position:relative;">
          <label class="form-label"><i class="ti ti-dna-2"></i> Species</label>
          <input class="form-input" id="nc-species" placeholder="Human" autocomplete="off">
          <div class="spell-suggestions" id="nc-species-suggestions"></div>
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-heart"></i> Max HP</label>
          <input class="form-input" id="nc-hp" type="number" min="1" placeholder="10">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-shield"></i> Armor Class</label>
          <input class="form-input" id="nc-ac" type="number" min="1" placeholder="10">
        </div>
      </div>

      <div class="form-row">
        <label class="form-label"><i class="ti ti-shoe"></i> Movement Speed</label>
        <input class="form-input" id="nc-speed" placeholder="30ft">
      </div>

      <div class="section-lbl">Ability Scores</div>
      <div class="form-row-3">
        <div class="form-row">
          <label class="form-label">STR</label>
          <input class="form-input" id="nc-str" type="number" min="1" max="30" placeholder="10">
          <div class="ability-mod" id="nc-str-mod">+0</div>
        </div>
        <div class="form-row">
          <label class="form-label">DEX</label>
          <input class="form-input" id="nc-dex" type="number" min="1" max="30" placeholder="10">
          <div class="ability-mod" id="nc-dex-mod">+0</div>
        </div>
        <div class="form-row">
          <label class="form-label">CON</label>
          <input class="form-input" id="nc-con" type="number" min="1" max="30" placeholder="10">
          <div class="ability-mod" id="nc-con-mod">+0</div>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-row">
          <label class="form-label">INT</label>
          <input class="form-input" id="nc-int" type="number" min="1" max="30" placeholder="10">
          <div class="ability-mod" id="nc-int-mod">+0</div>
        </div>
        <div class="form-row">
          <label class="form-label">WIS</label>
          <input class="form-input" id="nc-wis" type="number" min="1" max="30" placeholder="10">
          <div class="ability-mod" id="nc-wis-mod">+0</div>
        </div>
        <div class="form-row">
          <label class="form-label">CHA</label>
          <input class="form-input" id="nc-cha" type="number" min="1" max="30" placeholder="10">
          <div class="ability-mod" id="nc-cha-mod">+0</div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-cancel" id="nc-cancel">Cancel</button>
        <button class="btn-save"   id="nc-save"><i class="ti ti-check"></i> Create</button>
      </div>

    </div>`;

  document.getElementById('nc-cancel').addEventListener('click', () => {
    closeOverlay('newCharOverlay');
  });

  document.getElementById('nc-save').addEventListener('click', () => {
    const name    = document.getElementById('nc-name').value.trim();
    const level   = document.getElementById('nc-level').value.trim();
    const cls     = document.getElementById('nc-class').value.trim();
    const species = document.getElementById('nc-species').value.trim();
    const hp      = parseInt(document.getElementById('nc-hp').value)  || 10;
    const ac      = parseInt(document.getElementById('nc-ac').value)  || 10;
    const speed    = document.getElementById('nc-speed').value.trim()   || '30ft';
    const prof     = document.getElementById('nc-prof').value.trim()    || '+2';
    const str      = parseInt(document.getElementById('nc-str').value)  || 10;
    const dex      = parseInt(document.getElementById('nc-dex').value)  || 10;
    const con      = parseInt(document.getElementById('nc-con').value)  || 10;
    const intScore = parseInt(document.getElementById('nc-int').value)  || 10;
    const wis      = parseInt(document.getElementById('nc-wis').value)  || 10;
    const cha      = parseInt(document.getElementById('nc-cha').value)  || 10;

    if (!name) { document.getElementById('nc-name').focus(); return; }

    const subParts = [
      level   ? `Lvl ${level}` : null,
      species || null,
      cls     || null
    ].filter(Boolean);

    const id = 'char_' + Date.now();
    characters.push({
      id, name,
      sub: subParts.join(' · '),
      level: level || '',
      cls:   cls   || '',
      species: species || '',
      hp, ac, speed, prof,
      currentHp: hp,
      str, dex, con, int: intScore, wis, cha,
      skills: blankSkills(),
      skillAdv: {},
      savingThrows: blankSavingThrows(),
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      abilities: blankAbilities(),
      spellSlots: blankSpellSlots(),
      deathSaves: { successes: [false, false, false], failures: [false, false, false] },
    });
    currentCharId = id;
    save();

    closeOverlay('newCharOverlay');
    if (fromWelcome) hideWelcome();
    renderHeader();
    renderAllSimpleTabs();
  });

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ab => {
    const input = document.getElementById(`nc-${ab}`);
    const mod   = document.getElementById(`nc-${ab}-mod`);
    if (input && mod) {
      input.addEventListener('input', () => {
        mod.textContent = modStr(parseInt(input.value) || 10);
      });
    }
  });

  wireInputSearch('nc-species', 'nc-species-suggestions',
    fetchSpeciesSuggestions, () => '2024 SRD',
    s => { document.getElementById('nc-species').value = s.name || s; });
  wireInputSearch('nc-class', 'nc-class-suggestions',
    fetchClassSuggestions, () => '',
    cls => { document.getElementById('nc-class').value = typeof cls === 'string' ? cls : cls.name; }, 1);

  openOverlay('newCharOverlay');
}

document.getElementById('newCharClose').addEventListener('click', () => closeOverlay('newCharOverlay'));

// ── RENDER HEADER ─────────────────────────────────────────────
function renderHeader() {
  const c = currentChar();
  if (!c) return;
  document.getElementById('charName').textContent = c.name;
  const subParts = [
    c.level   ? `Lvl ${c.level}` : null,
    c.species || null,
    c.cls     || null,
  ].filter(Boolean);
  document.getElementById('charSub').textContent = subParts.join(' · ') || c.sub || '';
  const avatarBtn = document.getElementById('avatarBtn');
  avatarBtn.innerHTML = c.avatar
    ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<i class="ti ti-user"></i>`;
}

// ── RENDER ABILITY CARD HTML ──────────────────────────────────
function renderAbilityCard(a, key) {
  const category = key.split('_')[0];
  let badgeLabel;
  if (category === 'attack') {
    badgeLabel = a.badge === 'melee' ? 'Melee' : a.badge === 'ranged' ? 'Ranged' : 'Thrown';
  } else if (category === 'magic') {
    const magicLabels = { spell: 'Spell', 'spell-attack': 'Spell Attack', buff: 'Buff', ability: 'Ability' };
    badgeLabel = magicLabels[a.badge] || 'Spell';
  } else if (category === 'features') {
    const featLabels = { class: 'Class', feat: 'Feat', origin: 'Origin', species: 'Species' };
    const featBadgeIcons = { class: 'ti-award', feat: 'ti-bookmark', origin: 'ti-globe', species: 'ti-dna-2' };
    const featBadgeIcon = featBadgeIcons[a.badge] || 'ti-bookmark';
    badgeLabel = `<i class="ti ${featBadgeIcon}"></i> ${featLabels[a.badge] || 'Feat'}`;
  } else {
    badgeLabel = a.badge === 'action' ? 'Action' : a.badge === 'bonus' ? 'Bonus' : 'Passive';
  }

  let statsHTML = '';
  if (category === 'attack') {
    const chips = [
      a.toHit          ? `<span class="ability-chip">${esc(normalizeBonus(a.toHit))} to hit</span>` : '',
      a.damage         ? `<span class="ability-chip">${esc(a.damage)}</span>` : '',
      a.damage2        ? `<span class="ability-chip ability-chip-bonus">+ ${esc(a.damage2)}</span>` : '',
      a.range          ? `<span class="ability-chip">${esc(a.range)}</span>` : '',
      a.properties     ? `<span class="ability-chip ability-chip-prop">${esc(a.properties)}</span>` : '',
      (a.mastery && a.masteryEnabled) ? `<span class="ability-chip ability-chip-mastery">${esc(a.mastery)}</span>` : '',
    ].filter(Boolean);
    if (chips.length) statsHTML = `<div class="ability-chips">${chips.join('')}</div>`;
  } else if (category === 'items') {
    const chips = [
      a.itemCategory ? `<span class="ability-chip">${esc(a.itemCategory)}</span>` : '',
      a.rarity       ? `<span class="ability-chip ability-chip-purple">${esc(a.rarity)}</span>` : '',
      a.cost         ? `<span class="ability-chip">${esc(a.cost)}</span>` : '',
      a.weight       ? `<span class="ability-chip">${esc(a.weight)}</span>` : '',
    ].filter(Boolean);
    if (chips.length) statsHTML = `<div class="ability-chips">${chips.join('')}</div>`;
    else if (a.stat) statsHTML = `<span class="ability-stat">${esc(a.stat)}</span>`;
  } else if (category === 'features') {
    if (a.prerequisite) statsHTML = `<span class="ability-stat">Req: ${esc(a.prerequisite)}</span>`;
    else if (a.stat) statsHTML = `<span class="ability-stat">${esc(a.stat)}</span>`;
  } else if (category === 'magic') {
    const chips = [
      a.spellLevel    ? `<span class="ability-chip ability-chip-purple">${esc(a.spellLevel)}</span>` : '',
      a.school        ? `<span class="ability-chip ability-chip-school">${esc(a.school)}</span>` : '',
      a.castingTime   ? `<span class="ability-chip">${esc(a.castingTime)}</span>` : '',
      a.saveOrAttack  ? `<span class="ability-chip">${esc(a.saveOrAttack.replace(/\bSpell Attack\b/gi, 'ATK'))}</span>` : '',
      a.damage        ? `<span class="ability-chip">${esc(a.damage)}</span>` : '',
      a.range         ? `<span class="ability-chip">${esc(a.range)}</span>` : '',
      a.duration      ? `<span class="ability-chip">${esc(a.duration)}</span>` : '',
      a.components    ? `<span class="ability-chip">${esc(a.components)}</span>` : '',
      a.concentration ? `<span class="ability-chip ability-chip-conc">Conc.</span>` : '',
      a.ritual        ? `<span class="ability-chip ability-chip-ritual">Ritual</span>` : '',
    ].filter(Boolean);
    if (chips.length) statsHTML = `<div class="ability-chips">${chips.join('')}</div>`;
  } else if (a.stat) {
    statsHTML = `<span class="ability-stat">${esc(a.stat)}</span>`;
  }

  let actionType = key.endsWith('_bonus') ? 'Bonus Action' : key.endsWith('_action') ? 'Action' : '';
  if (category === 'magic' && a.castingTime) {
    const ct = a.castingTime.toLowerCase();
    if (ct.includes('bonus')) actionType = 'Bonus Action';
    else if (ct.includes('reaction')) actionType = 'Reaction';
    else if (ct.includes('action')) actionType = 'Action';
  }
  const spellLvlAbbr = (() => {
    if (!a.spellLevel) return '';
    const m = a.spellLevel.match(/^(\d+(?:st|nd|rd|th))(?:\s+level)?$/i);
    return m ? m[1] + ' Lvl' : a.spellLevel;
  })();
  const actionTypeText = actionType
    + (category === 'magic' && a.spellLevel ? ' · ' + spellLvlAbbr : '');

  return `
    <div class="ability-card" data-id="${a.id}" data-key="${key}">
      <div class="ability-top">
        <span class="ability-name">${esc(a.name)}</span>
      </div>
      ${category !== 'reaction' ? `<div class="ability-subline">
        <span class="ability-action-type">${esc(actionTypeText)}</span>
        <span class="ability-badge badge-${a.badge}">${badgeLabel}</span>
      </div>` : ''}
      ${a.desc ? `<p class="ability-desc">${esc(a.desc)}</p>` : ''}
      ${statsHTML}
    </div>`;
}

// ── RENDER SIMPLE TAB ─────────────────────────────────────────
function renderSimpleTab(tabId, abilityKey, addLabel) {
  const list = document.getElementById(tabId + 'List');
  if (!list) return;
  const c = currentChar();
  const abilities = (c && c.abilities[abilityKey]) || [];

  list.innerHTML = abilities.length === 0
    ? `<div class="empty-state">No ${addLabel.toLowerCase()} added yet.<br>Tap below to add one.</div>`
    : abilities.map(a => renderAbilityCard(a, abilityKey)).join('');

  list.querySelectorAll('.ability-card').forEach(card => {
    card.addEventListener('click', () => {
      const ability = c.abilities[abilityKey].find(a => a.id === card.dataset.id);
      if (ability) openAbilityDetailSheet(ability, abilityKey);
    });
  });
}

function renderAllSimpleTabs() {
  renderActTab();
  renderSimpleTab('reaction', 'reaction', 'Reaction');
  renderDefenseTab();
  renderExploreTab();
}

// ── RENDER ACT TAB ────────────────────────────────────────────
function renderActTab() {
  const tab = document.getElementById('tab-act');
  const c   = currentChar();

  const ALL_KEYS = [
    'attack_action','magic_action','items_action','features_action',
    'attack_bonus', 'magic_bonus', 'items_bonus', 'features_bonus'
  ];

  const standardTurn = [];
  const allAbilities = { attack: [], magic: [], items: [], features: [] };
  if (c) {
    ALL_KEYS.forEach(key => {
      const cat = key.split('_')[0];
      (c.abilities[key] || []).forEach(a => {
        if (a.pinned) standardTurn.push({ a, key });
        else allAbilities[cat].push({ a, key });
      });
    });

    // One-time migration: merge old separate order arrays into standardTurnOrder
    if (!c.standardTurnOrder) {
      c.standardTurnOrder = [
        ...(c.pinnedActionsOrder || []),
        ...(c.pinnedBonusOrder   || [])
      ];
      if (c.standardTurnOrder.length) save();
    }

    if (c.standardTurnOrder.length) {
      standardTurn.sort((x, y) => {
        const ai = c.standardTurnOrder.indexOf(x.a.id);
        const bi = c.standardTurnOrder.indexOf(y.a.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      });
    }
  }

  function pinnedRowHTML({ a, key }, isDraggable = true) {
    const cat = key.split('_')[0];
    const cfg = CATEGORIES[cat];

    const attackLabels = { melee: 'Melee', ranged: 'Ranged', thrown: 'Thrown' };
    const magicLabels  = { spell: 'Spell', 'spell-attack': 'Spell Attack', buff: 'Buff', ability: 'Ability' };
    const subtype = cat === 'attack' ? (attackLabels[a.badge] || '')
                  : cat === 'magic'  ? (magicLabels[a.badge]  || '')
                  : '';

    const isBonus = key.endsWith('_bonus');
    const actionLabel = isBonus ? 'Bonus Action' : '';

    // Flat layout for features/items (no end cap)
    if (cat !== 'attack' && cat !== 'magic') {
      const featLabels   = { class: 'Class', feat: 'Feat', origin: 'Origin', species: 'Species' };
      const featIcons    = { class: 'ti-award', feat: 'ti-bookmark', origin: 'ti-globe', species: 'ti-dna-2' };
      const featIcon     = cat === 'features' ? (featIcons[a.badge] || '') : '';
      const featSubtype  = cat === 'features' ? (featLabels[a.badge] || '') : '';
      const itemStat     = cat === 'items' && a.stat ? a.stat : '';
      const itemQuickRef = cat === 'items' ? (a.quickRef || '') : '';
      // features: [type · action label] to left of icon; items: quickRef only on right
      const rightText = cat === 'features'
        ? [featSubtype, actionLabel].filter(Boolean).join(' · ')
        : itemQuickRef;
      // items: action label (Bonus Action) sits below the name
      const itemSubtype = cat === 'items' ? actionLabel : '';
      return `<div class="pinned-row pinned-row-flat" data-id="${a.id}" data-key="${key}"${isDraggable ? ' draggable="true"' : ''}>
        <div class="pinned-row-left">
          <i class="ti ti-grip-vertical pinned-drag-handle"></i>
          <i class="ti ${cfg.icon} ${cfg.color} pinned-icon"></i>
          <div class="pinned-name-group">
            <span class="pinned-name">${esc(a.name)}</span>
            ${itemSubtype ? `<span class="pinned-subtype">${esc(itemSubtype)}</span>` : ''}
          </div>
          ${itemStat ? `<span class="pinned-stat">${esc(itemStat)}</span>` : ''}
        </div>
        ${rightText ? `<span class="pinned-flat-right-text">${esc(rightText)}</span>` : ''}
        ${featIcon ? `<i class="ti ${featIcon} pinned-feat-icon"></i>` : ''}
      </div>`;
    }

    // Left-side stat (to-hit or save)
    let statNum = cat === 'attack' ? normalizeBonus(a.toHit || '') : (a.saveOrAttack || '');
    let statLbl = cat === 'attack' && a.toHit ? 'TO HIT' : '';
    if (cat === 'magic' && statNum) {
      const atkM  = statNum.match(/^([+\-]?\d+)\s+Spell\s+Attack$/i);
      const saveM = statNum.match(/^([A-Za-z]{3})\s+Save\s+DC\s+(\d+)$/i);
      if (atkM)  { statNum = atkM[1];            statLbl = 'ATK'; }
      else if (saveM) { statNum = 'DC ' + saveM[2]; statLbl = saveM[1].toUpperCase() + ' Save'; }
    }

    // Right end cap (damage split into roll + type)
    let capNum = '', capLbl = '';
    if (a.damage) {
      const parts = a.damage.trim().split(/\s+/);
      capNum = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
      capLbl = parts.length > 1 ? parts[parts.length - 1] : '';
    } else if (cat === 'magic') {
      if (a.quickRef) {
        capNum = a.quickRef;
        capLbl = a.spellLevel || '';
      } else if (a.spellLevel) {
        capNum = a.spellLevel;
      }
    }

    let capNum2 = '', capLbl2 = '';
    if (a.damage2) {
      const parts2 = a.damage2.trim().split(/\s+/);
      capNum2 = parts2.length > 1 ? parts2.slice(0, -1).join(' ') : parts2[0];
      capLbl2 = parts2.length > 1 ? parts2[parts2.length - 1] : '';
    }

    const hasEndCap = !!capNum;
    const isDual    = hasEndCap && !!capNum2;
    let actionLabelAM = isBonus ? 'Bonus Action' : 'Action';
    if (cat === 'magic' && a.castingTime) {
      const ct = a.castingTime.toLowerCase();
      if (ct.includes('bonus')) actionLabelAM = 'Bonus Action';
      else if (ct.includes('reaction')) actionLabelAM = 'Reaction';
      else if (ct.includes('action')) actionLabelAM = 'Action';
    }
    let spellLvlShort = '';
    if (cat === 'magic' && a.spellLevel) {
      const m = a.spellLevel.match(/^(\d+(?:st|nd|rd|th))(?:\s+level)?$/i);
      spellLvlShort = m ? m[1] + ' Lvl' : a.spellLevel;
    }
    const masteryLabel = cat === 'attack' && a.mastery && a.masteryEnabled ? a.mastery : '';
    const combinedSubtype = [actionLabelAM, subtype, spellLvlShort || masteryLabel].filter(Boolean).join(' · ');

    const capHTML = !hasEndCap ? '' : isDual
      ? `<div class="pinned-row-cap pinned-row-cap-dual cap-cat-${cat}">
          <div class="pinned-cap-col">
            <span class="pinned-cap-num">${esc(capNum)}</span>
            ${capLbl ? `<span class="pinned-cap-lbl">${esc(capLbl)}</span>` : ''}
          </div>
          <span class="pinned-cap-sep">+</span>
          <div class="pinned-cap-col">
            <span class="pinned-cap-num">${esc(capNum2)}</span>
            ${capLbl2 ? `<span class="pinned-cap-lbl">${esc(capLbl2)}</span>` : ''}
          </div>
        </div>`
      : `<div class="pinned-row-cap cap-cat-${cat}">
          <span class="pinned-cap-num">${esc(capNum)}</span>
          ${capLbl ? `<span class="pinned-cap-lbl">${esc(capLbl)}</span>` : ''}
        </div>`;

    return `<div class="pinned-row" data-id="${a.id}" data-key="${key}"${isDraggable ? ' draggable="true"' : ''}>
      <div class="pinned-row-left">
        <i class="ti ti-grip-vertical pinned-drag-handle"></i>
        <i class="ti ${cfg.icon} ${cfg.color} pinned-icon"></i>
        <div class="pinned-name-group">
          <span class="pinned-name">${esc(a.name)}${(cat === 'attack' && a.mastery && a.masteryEnabled) ? ' <span class="pinned-mastery-wrap" data-tooltip="Weapon Mastery"><i class="ti ti-sparkles pinned-mastery-icon"></i></span>' : ''}${(cat === 'magic' && a.concentration) ? ' <span class="pinned-conc-wrap" data-tooltip="Concentration"><i class="ti ti-eye-exclamation pinned-conc-icon"></i></span>' : ''}</span>
          ${combinedSubtype ? `<span class="pinned-subtype">${esc(combinedSubtype)}</span>` : ''}
        </div>
        ${statNum ? `<div class="pinned-tohit">
          <span class="pinned-tohit-num">${esc(statNum)}</span>
          ${statLbl ? `<span class="pinned-tohit-lbl">${statLbl}</span>` : ''}
        </div>` : ''}
      </div>
      ${capHTML}
    </div>`;
  }

  // Spell slots — only shown when character has a spellcasting ability set
  const hasSpellAbility = c && c.spellAbility && c.spellAbility !== 'none';

  // Spell stats (Mod / Attack / Save DC) — mirrors Explore tab computation
  const spellAbKey  = hasSpellAbility ? c.spellAbility : null;
  const spellModVal = spellAbKey ? getAbilityMod(c[spellAbKey] || 10) : null;
  const profBonAct  = parseInt((c && c.prof) || '+2') || 2;
  const spellOvrAct = (c && c.spellStats) || {};
  const dispSpMod   = spellOvrAct.modOverride    != null ? spellOvrAct.modOverride    : spellModVal;
  const dispSpAtk   = spellOvrAct.attackOverride != null ? spellOvrAct.attackOverride : (spellModVal !== null ? profBonAct + spellModVal : null);
  const dispSpDC    = spellOvrAct.dcOverride     != null ? spellOvrAct.dcOverride     : (spellModVal !== null ? 8 + profBonAct + spellModVal : null);
  const fmtSpAct    = v => v !== null && v !== undefined ? (v >= 0 ? '+' : '') + v : '—';
  const spellStatsHTML = hasSpellAbility ? `
    <div class="section-hdr section-gap">Spellcasting</div>
    <div class="passive-row" id="actSpellStatsRow">
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-sparkles c-purple passive-icon"></i><div class="passive-val${spellOvrAct.modOverride != null ? ' is-override' : ''}">${fmtSpAct(dispSpMod)}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Spell Mod</div>
      </div>
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-wand c-purple passive-icon"></i><div class="passive-val${spellOvrAct.attackOverride != null ? ' is-override' : ''}">${fmtSpAct(dispSpAtk)}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Spell Attack</div>
      </div>
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-shield-bolt c-purple passive-icon"></i><div class="passive-val${spellOvrAct.dcOverride != null ? ' is-override' : ''}">${dispSpDC !== null ? dispSpDC : '—'}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Save DC</div>
      </div>
    </div>` : '';

  const slots = (c && c.spellSlots) || {};
  const activeSlots = SLOT_ORDINALS
    .map((ord, i) => ({ ord, level: i + 1, max: 0, used: 0, ...(slots[i + 1] || {}) }))
    .filter(s => s.max > 0);

  const anySlotUsed = activeSlots.some(s => s.used > 0);
  const slotsHTML = (hasSpellAbility && activeSlots.length) ? `
    <div class="section-hdr${standardTurn.length ? ' section-gap' : ''} section-hdr-row section-hdr-turn"><span>Spell Slots</span><button class="long-rest-btn${anySlotUsed ? ' slots-active' : ''}" id="longRestBtn"><span class="long-rest-label">Long Rest</span><span class="long-rest-moon"><i class="ti ti-moon long-rest-moon-out"></i><i class="ti ti-moon-filled long-rest-moon-fill"></i></span></button></div>
    <div class="slot-tracker">
      ${activeSlots.map(s => {
        const pips = Array.from({ length: s.max }, (_, i) => {
          const isUsed = i < s.used;
          return `<button class="slot-pip${isUsed ? ' filled' : ''}" data-level="${s.level}" data-index="${i}"><i class="ti ${isUsed ? 'ti-circle-filled' : 'ti-circle'}"></i></button>`;
        }).join('');
        return `<div class="slot-row"><span class="slot-label">${s.ord}</span><div class="slot-pips">${pips}</div></div>`;
      }).join('')}
    </div>` : '';

  // All Abilities auto-list grouped by category
  const CAT_ORDER = ['attack', 'magic', 'items', 'features'];
  const allAbilitiesHTML = CAT_ORDER.map(cat => {
    const rows = allAbilities[cat];
    if (!rows.length) return '';
    const cfg = CATEGORIES[cat];
    return `<div class="all-abilities-cat-hdr"><i class="ti ${cfg.icon} ${cfg.color}"></i> ${cfg.label}</div>
      ${rows.map(r => pinnedRowHTML(r, false)).join('')}`;
  }).filter(Boolean).join('');
  const hasAnyAbilities = CAT_ORDER.some(cat => allAbilities[cat].length > 0);

  const attacks  = (c && c.attacksPerRound) || 1;
  const slotsVisible = hasSpellAbility && activeSlots.length > 0;
  const hasAbove = standardTurn.length || slotsVisible || hasAnyAbilities;
  const hasActiveTurn = slotsVisible || standardTurn.length > 0 || hasSpellAbility;

  const hpMax = parseInt(c && c.hp) || 0;
  if (c && c.currentHp === undefined) { c.currentHp = hpMax; save(); }
  const initHp = c ? Math.max(0, Math.min(hpMax, c.currentHp ?? hpMax)) : 0;
  if (c && !c.deathSaves) { c.deathSaves = { successes: [false, false, false], failures: [false, false, false] }; save(); }
  const ds = (c && c.deathSaves) || { successes: [false, false, false], failures: [false, false, false] };

  const deathSavesHTML = hpMax > 0 ? `
    <div class="ds-section${initHp > 0 ? ' ds-hidden' : ''}" id="dsSection">
      <div class="section-hdr section-gap">Death Saving Throws</div>
      <div class="ds-cols">
        <div class="ds-col ds-fai-col">
          <div class="ds-col-label">Failures</div>
          <div class="ds-icons">
            <div class="ds-icon ds-fai-icon${ds.failures[0] ? ' filled' : ''}" data-ds-type="failures" data-ds-idx="0"><i class="ti ti-skull"></i></div>
            <div class="ds-icon ds-fai-icon${ds.failures[1] ? ' filled' : ''}" data-ds-type="failures" data-ds-idx="1"><i class="ti ti-skull"></i></div>
            <div class="ds-icon ds-fai-icon${ds.failures[2] ? ' filled' : ''}" data-ds-type="failures" data-ds-idx="2"><i class="ti ti-skull"></i></div>
          </div>
        </div>
        <div class="ds-col ds-suc-col">
          <div class="ds-col-label">Successes</div>
          <div class="ds-icons">
            <div class="ds-icon ds-suc-icon${ds.successes[0] ? ' filled' : ''}" data-ds-type="successes" data-ds-idx="0"><i class="ti ti-heartbeat"></i></div>
            <div class="ds-icon ds-suc-icon${ds.successes[1] ? ' filled' : ''}" data-ds-type="successes" data-ds-idx="1"><i class="ti ti-heartbeat"></i></div>
            <div class="ds-icon ds-suc-icon${ds.successes[2] ? ' filled' : ''}" data-ds-type="successes" data-ds-idx="2"><i class="ti ti-heartbeat"></i></div>
          </div>
        </div>
      </div>
    </div>` : '';

  const showActiveTurnBlock = hasActiveTurn || hpMax > 0;
  const hpHTML = hpMax > 0 ? `
    <div class="section-hdr${hasActiveTurn ? ' section-gap' : ''}"> Hit Point Tracker</div>
    <div class="hp-track-outer">
      <div class="hp-track" id="hpTrack">
        <div class="hp-fill" id="hpFill"></div>
        <div class="hp-thumb" id="hpThumb">
          <div class="hp-tooltip" id="hpTooltip"></div>
          <span id="hpThumbNum"></span>
        </div>
      </div>
    </div>` : '';

  const activeTurnHTML = showActiveTurnBlock ? `
    <div class="active-turn-block">
      ${standardTurn.length ? `
        <div class="section-hdr section-hdr-row section-hdr-turn"><span>Player Turn</span><span class="attacks-hex" data-tooltip="${attacks} ${attacks === 1 ? 'Attack' : 'Attacks'}/round"><svg width="52" height="52" viewBox="0 0 48 48"><polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill="#1E1810" stroke="#C9A84C" stroke-width="1.5"/></svg><span class="attacks-hex-inner"><span class="attacks-hex-num">${attacks}</span><span class="attacks-hex-atk">ATK</span></span></span></div>
        <div class="pinned-list" id="standard-turn-list">${standardTurn.map(r => pinnedRowHTML(r, true)).join('')}</div>` : ''}
      ${spellStatsHTML}
      ${slotsHTML}
      ${hpHTML}
      ${deathSavesHTML}
    </div>` : '';

  tab.innerHTML = `
    ${activeTurnHTML}
    ${hasAnyAbilities ? `
      <div class="section-hdr${showActiveTurnBlock ? ' section-gap' : ''}">Available Actions</div>
      <div class="all-abilities-list">${allAbilitiesHTML}</div>` : ''}
    <div class="section-hdr section-gap">Add Actions / Bonus Actions</div>
    <div class="btn-grid">
      <div class="act-btn" data-category="attack"  ><i class="ti ti-sword    c-red    cat-i"></i><div class="btn-text"><span class="btn-name">Attack</span>   <span class="btn-desc">Weapon Attacks</span></div></div>
      <div class="act-btn" data-category="magic"   ><i class="ti ti-wand     c-purple cat-i"></i><div class="btn-text"><span class="btn-name">Magic</span>    <span class="btn-desc">Spells &amp; Abilities</span></div></div>
      <div class="act-btn" data-category="items"   ><i class="ti ti-flask-2  c-green  cat-i"></i><div class="btn-text"><span class="btn-name">Items</span>    <span class="btn-desc">Healing Potion</span></div></div>
      <div class="act-btn" data-category="features"><i class="ti ti-sparkles c-amber  cat-i"></i><div class="btn-text"><span class="btn-name">Features</span> <span class="btn-desc">Action Surge</span></div></div>
    </div>
    <div class="section-hdr section-gap">Extra Turn Actions</div>
    <div class="btn-grid">
      <div class="act-btn extra-act" data-extra="dash">      <i class="ti ti-shoe            c-blue   cat-i"></i><div class="btn-text"><span class="btn-name">Dash</span>      <span class="btn-desc">Double Movement</span></div></div>
      <div class="act-btn extra-act" data-extra="dodge">     <i class="ti ti-run             c-plum   cat-i"></i><div class="btn-text"><span class="btn-name">Dodge</span>     <span class="btn-desc">Disadv. on Attacks</span></div></div>
      <div class="act-btn extra-act" data-extra="disengage"> <i class="ti ti-cloud           c-blue   cat-i"></i><div class="btn-text"><span class="btn-name">Disengage</span> <span class="btn-desc">No Opp. Attacks</span></div></div>
      <div class="act-btn extra-act" data-extra="hide">      <i class="ti ti-eye-off         c-slate  cat-i"></i><div class="btn-text"><span class="btn-name">Hide</span>      <span class="btn-desc">Stealth Check</span></div></div>
      <div class="act-btn extra-act" data-extra="help">      <i class="ti ti-heart-handshake c-sage   cat-i"></i><div class="btn-text"><span class="btn-name">Help</span>      <span class="btn-desc">Give Ally Adv.</span></div></div>
      <div class="act-btn extra-act" data-extra="ready">     <i class="ti ti-clock-pause     c-orange cat-i"></i><div class="btn-text"><span class="btn-name">Ready</span>     <span class="btn-desc">Hold Action</span></div></div>
      <div class="act-btn extra-act" data-extra="influence"> <i class="ti ti-brand-hipchat   c-purple cat-i"></i><div class="btn-text"><span class="btn-name">Influence</span> <span class="btn-desc">Social Check</span></div></div>
      <div class="act-btn extra-act" data-extra="search">    <i class="ti ti-zoom-question   c-green  cat-i"></i><div class="btn-text"><span class="btn-name">Search</span>    <span class="btn-desc">Perception / Invest.</span></div></div>
      <div class="act-btn extra-act" data-extra="study">     <i class="ti ti-book            c-blue   cat-i"></i><div class="btn-text"><span class="btn-name">Study</span>     <span class="btn-desc">Int Check</span></div></div>
      <div class="act-btn extra-act" data-extra="utilize">   <i class="ti ti-tool            c-amber  cat-i"></i><div class="btn-text"><span class="btn-name">Utilize</span>   <span class="btn-desc">Use an Object</span></div></div>
    </div>
    <div class="project-link"><a href="https://github.com/BenzurX/D-D-Player-Card" target="_blank" rel="noopener"><i class="ti ti-brand-github"></i> Learn more about this project</a></div>`;

  // HP Tracker wiring
  {
    const hpTrack    = document.getElementById('hpTrack');
    const hpFill     = document.getElementById('hpFill');
    const hpThumb    = document.getElementById('hpThumb');
    const hpThumbNum = document.getElementById('hpThumbNum');
    const hpTooltip  = document.getElementById('hpTooltip');

    function setHpSlider(hp, persist) {
      hp = Math.max(0, Math.min(hpMax, Math.round(hp)));
      const pct = hpMax > 0 ? hp / hpMax : 0;
      const col = hpColorByPct(pct);
      hpFill.style.width        = (pct * 100) + '%';
      hpFill.style.background   = col;
      hpThumb.style.borderColor = col;
      hpThumb.style.color       = col;
      hpThumb.style.left        = (pct * 100) + '%';
      hpThumbNum.textContent    = hp;
      hpTooltip.textContent     = hp + ' HP';
      if (persist && c) { c.currentHp = hp; save(); }
      const dsSection = document.getElementById('dsSection');
      if (dsSection) dsSection.classList.toggle('ds-hidden', hp > 0);
    }

    hpDragCallback = clientX => {
      const r = hpTrack.getBoundingClientRect();
      const hp = Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * hpMax);
      setHpSlider(hp, true);
    };

    if (hpThumb && hpMax > 0) {
      hpThumb.addEventListener('mousedown',  e => { draggingHp = true; hpThumb.classList.add('dragging'); e.preventDefault(); });
      hpThumb.addEventListener('touchstart', e => { draggingHp = true; hpThumb.classList.add('dragging'); e.preventDefault(); }, { passive: false });
      hpTrack.addEventListener('click', e => { if (!draggingHp) hpDragCallback(e.clientX); });
      setHpSlider(initHp);
    }
  }

  tab.querySelectorAll('[data-ds-idx]').forEach(icon => {
    icon.addEventListener('click', () => {
      if (!c) return;
      if (!c.deathSaves) c.deathSaves = { successes: [false, false, false], failures: [false, false, false] };
      const type = icon.dataset.dsType;
      const i    = parseInt(icon.dataset.dsIdx);

      if (type === 'successes') {
        // left-to-right fill: click i fills 0..i
        const count    = c.deathSaves.successes.filter(Boolean).length;
        const newCount = i < count ? i : i + 1;
        c.deathSaves.successes = [newCount > 0, newCount > 1, newCount > 2];
      } else {
        // right-to-left fill: click i=2 (rightmost) = 1st failure
        const revI     = 2 - i;
        const count    = c.deathSaves.failures.filter(Boolean).length;
        const newCount = revI < count ? revI : revI + 1;
        c.deathSaves.failures = [newCount > 2, newCount > 1, newCount > 0];
      }

      // Sync all icons without a full re-render
      tab.querySelectorAll('[data-ds-type="successes"][data-ds-idx]').forEach(el => {
        el.classList.toggle('filled', c.deathSaves.successes[parseInt(el.dataset.dsIdx)]);
      });
      tab.querySelectorAll('[data-ds-type="failures"][data-ds-idx]').forEach(el => {
        el.classList.toggle('filled', c.deathSaves.failures[parseInt(el.dataset.dsIdx)]);
      });

      save();
    });

    icon.addEventListener('mouseenter', () => {
      const type = icon.dataset.dsType;
      const i    = parseInt(icon.dataset.dsIdx);
      tab.querySelectorAll(`[data-ds-type="${type}"]`).forEach(el => {
        const elIdx = parseInt(el.dataset.dsIdx);
        el.classList.toggle('ds-preview', type === 'successes' ? elIdx <= i : elIdx >= i);
      });
    });
    icon.addEventListener('mouseleave', () => {
      tab.querySelectorAll('[data-ds-idx]').forEach(el => el.classList.remove('ds-preview'));
    });
  });

  if (hasSpellAbility) {
    const actSpellRow = tab.querySelector('#actSpellStatsRow');
    if (actSpellRow) actSpellRow.querySelectorAll('.passive-card').forEach(card => {
      card.addEventListener('click', () => openSpellStatsSheet());
    });
  }

  tab.querySelectorAll('.act-btn:not(.extra-act)').forEach(btn => {
    btn.addEventListener('click', () => openAddSheet(btn.dataset.category + '_action', btn.dataset.category));
  });
  tab.querySelectorAll('.extra-act').forEach(btn => {
    btn.addEventListener('click', () => openExtraActionSheet(btn.dataset.extra));
  });
  tab.querySelectorAll('.pinned-row').forEach(row => {
    row.addEventListener('click', () => {
      const ability = (c.abilities[row.dataset.key] || []).find(a => a.id === row.dataset.id);
      if (!ability) return;
      openAbilityDetailSheet(ability, row.dataset.key);
    });
  });

  function wirePinnedDrag(listEl, orderKey) {
    if (!listEl) return;
    let dragSrcId = null;

    listEl.querySelectorAll('.pinned-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrcId = row.dataset.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcId);
        setTimeout(() => row.classList.add('dragging'), 0);
      });
      row.addEventListener('dragend', () => {
        listEl.querySelectorAll('.pinned-row').forEach(r => r.classList.remove('dragging', 'drag-over'));
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        listEl.querySelectorAll('.pinned-row').forEach(r => r.classList.remove('drag-over'));
        if (row.dataset.id !== dragSrcId) row.classList.add('drag-over');
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrcId || dragSrcId === row.dataset.id) return;
        const srcEl = listEl.querySelector(`.pinned-row[data-id="${dragSrcId}"]`);
        if (!srcEl) return;
        listEl.insertBefore(srcEl, row);
        c[orderKey] = [...listEl.querySelectorAll('.pinned-row')].map(r => r.dataset.id);
        save();
      });
    });
  }

  wirePinnedDrag(tab.querySelector('#standard-turn-list'), 'standardTurnOrder');
  tab.querySelectorAll('.slot-pip').forEach(pip => {
    pip.addEventListener('click', () => {
      if (!c) return;
      const level = parseInt(pip.dataset.level);
      const index = parseInt(pip.dataset.index);
      if (!c.spellSlots) c.spellSlots = blankSpellSlots();
      const slot = c.spellSlots[level];
      if (!slot) return;
      slot.used = index < slot.used ? index : index + 1;
      save();
      renderActTab();
    });
    pip.addEventListener('mouseenter', () => {
      if (pip.classList.contains('filled')) return;
      const index = parseInt(pip.dataset.index);
      pip.closest('.slot-pips').querySelectorAll('.slot-pip').forEach(p => {
        if (!p.classList.contains('filled') && parseInt(p.dataset.index) <= index)
          p.classList.add('pip-preview');
      });
    });
    pip.addEventListener('mouseleave', () => {
      pip.closest('.slot-pips').querySelectorAll('.slot-pip').forEach(p => p.classList.remove('pip-preview'));
    });
  });
  const longRestBtn = tab.querySelector('#longRestBtn');
  if (longRestBtn) {
    longRestBtn.addEventListener('click', () => {
      if (!c) return;
      if (!c.spellSlots) c.spellSlots = blankSpellSlots();
      Object.values(c.spellSlots).forEach(s => { s.used = 0; });
      c.currentHp = parseInt(c.hp) || 0;
      save();
      renderActTab();
    });
  }
}

// ── RENDER EXPLORE TAB ────────────────────────────────────────
function renderExploreTab() {
  const tab = document.getElementById('tab-explore');
  const c   = currentChar();

  const skillData      = (c && c.skills)         || {};
  const skillOverrides = (c && c.skillOverrides)  || {};

  function profIcon(state) {
    if (state === 'expert') return 'ti-star-filled';
    if (state === 'prof')   return 'ti-circle-filled';
    return 'ti-circle';
  }

  // ── Character info cards ──────────────────────────────────

  const walkVal    = c && c.speed      ? c.speed      : '30 ft';
  const walkNum    = parseInt((walkVal.match(/\d+/) || ['30'])[0]);
  const halfWalkFt = Math.floor(walkNum / 2) + ' ft';
  const flyVal     = c && c.flySpeed   ? c.flySpeed   : null;
  const climbVal   = c && c.climbSpeed ? c.climbSpeed : null;
  const swimVal    = c && c.swimSpeed  ? c.swimSpeed  : null;
  const climbDef   = !climbVal;
  const swimDef    = !swimVal;
  const addFt      = v => v && !/ft/i.test(v) ? v + ' ft' : v;

  // ── Passive scores ────────────────────────────────────────
  const passiveOvr  = (c && c.passiveOverrides) || {};
  const passPercOver = passiveOvr.perception    != null;
  const passInvOver  = passiveOvr.investigation != null;
  const passInsOver  = passiveOvr.insight       != null;
  const passPerc = passPercOver ? passiveOvr.perception    : 10 + calcSkillBonus(c, 'perception');
  const passInv  = passInvOver  ? passiveOvr.investigation : 10 + calcSkillBonus(c, 'investigation');
  const passIns  = passInsOver  ? passiveOvr.insight       : 10 + calcSkillBonus(c, 'insight');

  // ── Spell stats ──────────────────────────────────────────
  const hasSpell    = !!(c && c.spellAbility && c.spellAbility !== 'none');
  const spellAbKey  = hasSpell ? c.spellAbility : null;
  const spellModVal = spellAbKey ? getAbilityMod(c[spellAbKey] || 10) : null;
  const profBon     = parseInt((c && c.prof) || '+2') || 2;
  const autoSpMod   = spellModVal;
  const autoSpAtk   = spellModVal !== null ? profBon + spellModVal : null;
  const autoSpDC    = spellModVal !== null ? 8 + profBon + spellModVal : null;
  const spellOvr    = (c && c.spellStats) || {};
  const dispSpMod   = spellOvr.modOverride    != null ? spellOvr.modOverride    : autoSpMod;
  const dispSpAtk   = spellOvr.attackOverride != null ? spellOvr.attackOverride : autoSpAtk;
  const dispSpDC    = spellOvr.dcOverride     != null ? spellOvr.dcOverride     : autoSpDC;
  const modOvrd     = spellOvr.modOverride    != null;
  const atkOvrd     = spellOvr.attackOverride != null;
  const dcOvrd      = spellOvr.dcOverride     != null;
  const fmtSp       = v => v !== null ? (v >= 0 ? '+' : '') + v : '—';

  // ── Skills ───────────────────────────────────────────────
  const skillAdvData = (c && c.skillAdv) || {};
  const skillsHTML = SKILLS.map(skill => {
    const state    = skillData[skill.key] || 'none';
    const hasOver  = skillOverrides[skill.key] !== null && skillOverrides[skill.key] !== undefined;
    const bonus    = calcSkillBonus(c, skill.key);
    const bonusStr = (bonus >= 0 ? '+' : '') + bonus;
    const adv      = skillAdvData[skill.key] || 'none';
    const advIcon  = adv === 'adv'    ? `<span class="adv-badge adv-badge-adv" data-tooltip="Advantage">A</span>`
                   : adv === 'disadv' ? `<span class="adv-badge adv-badge-disadv" data-tooltip="Disadvantage">D</span>`
                   : '';
    return `
      <div class="skill-row" data-skill="${skill.key}">
        <button class="prof-toggle ${state}" data-skill="${skill.key}" aria-label="Toggle ${skill.name} proficiency">
          <i class="ti ${profIcon(state)}"></i>
        </button>
        <div class="skill-info">
          <span class="skill-name">${skill.name}</span>
          <span class="skill-ability">${abilityIcon(skill.ability)}${skill.ability.toUpperCase()}</span>
        </div>
        ${advIcon}
        <div class="skill-bonus${state !== 'none' && !hasOver ? ' is-prof' : ''}${hasOver ? ' is-override' : ''}">${bonusStr}${hasOver ? '*' : ''}</div>
      </div>`;
  }).join('');

  tab.innerHTML = `
    <div class="explore-info-cols">
    <div class="explore-info-col">
    <div class="section-hdr">Character</div>
    <div class="defense-summary">
      <div class="defense-tags-col explore-tappable" id="explore-speed-card">
        <div class="defense-tags-section-lbl">Movement</div>
        <div class="move-rows">
          <div class="move-row">
            <span class="move-type"><i class="ti ti-shoe c-blue"></i> Walk</span>
            <span class="move-dots"></span>
            <span class="move-val">${esc(addFt(walkVal))}</span>
          </div>
          <div class="move-row">
            <span class="move-type"><i class="ti ti-feather c-blue"></i> Fly</span>
            <span class="move-dots"></span>
            <span class="move-val${flyVal ? '' : ' move-val-none'}">${flyVal ? esc(addFt(flyVal)) : '—'}</span>
          </div>
          <div class="move-row">
            <span class="move-type"><i class="ti ti-mountain c-blue"></i> Climb</span>
            <span class="move-dots"></span>
            <span class="move-val${climbDef ? ' move-val-default' : ''}">${climbVal ? esc(addFt(climbVal)) : halfWalkFt}</span>
          </div>
          <div class="move-row">
            <span class="move-type"><i class="ti ti-ripple c-blue"></i> Swim</span>
            <span class="move-dots"></span>
            <span class="move-val${swimDef ? ' move-val-default' : ''}">${swimVal ? esc(addFt(swimVal)) : halfWalkFt}</span>
          </div>
        </div>
      </div>
    </div>
    </div>
    <div class="explore-info-col">
    <div class="section-hdr">Passive Scores</div>
    <div class="passive-row" id="passiveRow">
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-eye c-blue passive-icon"></i><div class="passive-val${passPercOver ? ' is-override' : ''}">${passPerc}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Perception</div>
      </div>
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-zoom-question c-green passive-icon"></i><div class="passive-val${passInvOver ? ' is-override' : ''}">${passInv}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Investigation</div>
      </div>
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-bulb c-amber passive-icon"></i><div class="passive-val${passInsOver ? ' is-override' : ''}">${passIns}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Insight</div>
      </div>
    </div>
    </div>
    </div>

    ${hasSpell ? `
    <div class="section-hdr section-gap">Spellcasting</div>
    <div class="passive-row" id="spellStatsRow">
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-sparkles c-purple passive-icon"></i><div class="passive-val${modOvrd ? ' is-override' : ''}">${fmtSp(dispSpMod)}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Spell Mod</div>
      </div>
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-wand c-purple passive-icon"></i><div class="passive-val${atkOvrd ? ' is-override' : ''}">${fmtSp(dispSpAtk)}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Spell Attack</div>
      </div>
      <div class="passive-card tappable">
        <div class="passive-top"><i class="ti ti-shield-bolt c-purple passive-icon"></i><div class="passive-val${dcOvrd ? ' is-override' : ''}">${dispSpDC !== null ? dispSpDC : '—'}</div></div>
        <span class="passive-dots"></span>
        <div class="passive-label">Save DC</div>
      </div>
    </div>` : ''}

    <div class="section-hdr">Skills</div>
    <div class="skill-grid">${skillsHTML}</div>
    <div class="skill-legend">
      <span><i class="ti ti-circle"></i> None</span>
      <span><i class="ti ti-circle-filled c-gold"></i> Proficient</span>
      <span><i class="ti ti-star-filled c-gold"></i> Expertise</span>
    </div>
    <div class="project-link"><a href="https://github.com/BenzurX/D-D-Player-Card" target="_blank" rel="noopener"><i class="ti ti-brand-github"></i> Learn more about this project</a></div>`;

  document.getElementById('explore-speed-card').addEventListener('click', () => openCharacterDetailsSheet());
  document.getElementById('passiveRow').querySelectorAll('.passive-card').forEach(card => {
    card.addEventListener('click', () => openPassiveScoresSheet());
  });
  if (hasSpell) {
    document.getElementById('spellStatsRow').querySelectorAll('.passive-card').forEach(card => {
      card.addEventListener('click', () => openSpellStatsSheet());
    });
  }

  tab.querySelectorAll('.prof-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!c) return;
      const key     = btn.dataset.skill;
      const current = (c.skills || {})[key] || 'none';
      const next    = current === 'none' ? 'prof' : current === 'prof' ? 'expert' : 'none';
      if (!c.skills) c.skills = {};
      c.skills[key] = next;
      save();
      renderExploreTab();
    });
  });

  tab.querySelectorAll('.skill-grid .skill-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.prof-toggle')) return;
      openSkillOverrideSheet(row.dataset.skill);
    });
  });
}

// ── RENDER DEFENSE TAB ───────────────────────────────────────
function renderDefenseTab() {
  const tab = document.getElementById('tab-defense');
  const c   = currentChar();

  const saves = (c && c.savingThrows) || {};

  const saveRows = ['str','int','dex','wis','con','cha'].map(ab => {
    const st      = saves[ab] || { prof: false, override: null };
    const isProf  = !!st.prof;
    const hasOver = st.override !== null && st.override !== undefined;
    const bonus   = getSaveBonus(c, ab);
    const bStr    = (bonus >= 0 ? '+' : '') + bonus;
    const adv     = st.adv || 'none';
    const advIcon = adv === 'adv'    ? `<span class="adv-badge adv-badge-adv" data-tooltip="Advantage">A</span>`
                  : adv === 'disadv' ? `<span class="adv-badge adv-badge-disadv" data-tooltip="Disadvantage">D</span>`
                  : '';
    return `
      <div class="skill-row save-row" data-ability="${ab}">
        <button class="prof-toggle${isProf ? ' prof' : ''}" data-save="${ab}" aria-label="Toggle ${ABILITY_NAMES[ab]} save proficiency">
          <i class="ti ${isProf ? 'ti-circle-filled' : 'ti-circle'}"></i>
        </button>
        <div class="skill-info">
          <span class="skill-name">${abilityIcon(ab)} ${ABILITY_NAMES[ab]}</span>
        </div>
        ${advIcon}
        <div class="skill-bonus${isProf ? ' is-prof' : ''}${hasOver ? ' is-override' : ''}">${bStr}${hasOver ? '*' : ''}</div>
      </div>`;
  }).join('');

  const resistances    = (c && c.resistances)    || [];
  const immunities     = (c && c.immunities)     || [];
  const vulnerabilities = (c && c.vulnerabilities) || [];

  const resistTags = resistances.map((r, i) => `<div class="def-tag def-tag-resist def-tag-edit" data-type="resistances" data-index="${i}">${esc(r)}</div>`).join('');
  const immuneTags = immunities.map((im, i) => `<div class="def-tag def-tag-immune def-tag-edit" data-type="immunities" data-index="${i}">${esc(im)}</div>`).join('');
  const vulnTags   = vulnerabilities.map((v, i) => `<div class="def-tag def-tag-vuln def-tag-edit" data-type="vulnerabilities" data-index="${i}">${esc(v)}</div>`).join('');
  tab.innerHTML = `
    <div class="defense-summary">
      <div class="defense-ac">
        <i class="ti ti-shield-half"></i>
        <div class="defense-ac-val">${c && c.ac ? c.ac : '—'}</div>
        <div class="defense-ac-lbl">AC</div>
      </div>
      <div class="defense-tags-col">
        <div>
          <div class="defense-tags-section-lbl"><i class="ti ti-shield-up c-green"></i> Resistances</div>
          <div class="defense-tags">${resistTags}<button class="def-tag-add def-tag-add-resist" data-add-type="resistances"><i class="ti ti-plus"></i> Add</button></div>
        </div>
        <div>
          <div class="defense-tags-section-lbl"><i class="ti ti-shield-cancel c-gold"></i> Immunities</div>
          <div class="defense-tags">${immuneTags}<button class="def-tag-add def-tag-add-immune" data-add-type="immunities"><i class="ti ti-plus"></i> Add</button></div>
        </div>
        <div>
          <div class="defense-tags-section-lbl"><i class="ti ti-shield-down c-red"></i> Vulnerabilities</div>
          <div class="defense-tags">${vulnTags}<button class="def-tag-add def-tag-add-vuln" data-add-type="vulnerabilities"><i class="ti ti-plus"></i> Add</button></div>
        </div>
      </div>
    </div>

    <div class="section-hdr">Saving Throws</div>
    <div class="skill-grid" id="saveList">${saveRows}</div>
    <div class="skill-legend">
      <span><i class="ti ti-circle"></i> None</span>
      <span><i class="ti ti-circle-filled c-gold"></i> Proficient</span>
    </div>

    <div class="project-link"><a href="https://github.com/BenzurX/D-D-Player-Card" target="_blank" rel="noopener"><i class="ti ti-brand-github"></i> Learn more about this project</a></div>`;

  tab.querySelectorAll('.prof-toggle[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!c) return;
      if (!c.savingThrows) c.savingThrows = blankSavingThrows();
      const ab = btn.dataset.save;
      if (!c.savingThrows[ab]) c.savingThrows[ab] = { prof: false, override: null };
      c.savingThrows[ab].prof = !c.savingThrows[ab].prof;
      save();
      renderDefenseTab();
    });
  });

  tab.querySelectorAll('.save-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.prof-toggle')) return;
      openSaveOverrideSheet(row.dataset.ability);
    });
  });

  tab.querySelectorAll('.def-tag-edit').forEach(tag => {
    tag.addEventListener('click', () => {
      openAddResistanceSheet(tag.dataset.type, parseInt(tag.dataset.index));
    });
  });

  tab.querySelectorAll('.def-tag-add').forEach(btn => {
    btn.addEventListener('click', () => openAddResistanceSheet(btn.dataset.addType));
  });

}

// ── NAV SWITCHING ─────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    renderAllSimpleTabs();
  });
});

// ── PIN BUTTON HELPERS ────────────────────────────────────────
function resetSheetPin() {
  const btn = document.getElementById('sheetPin');
  btn.style.display = 'none';
  btn.onclick = null;
}

function showSheetPin(ability, key) {
  const btn = document.getElementById('sheetPin');
  btn.style.display = '';
  const update = () => {
    btn.title   = ability.pinned ? 'Remove from Standard Turn' : 'Add to Standard Turn';
    btn.innerHTML = ability.pinned
      ? `<i class="ti ti-pin-filled c-gold"></i>`
      : `<i class="ti ti-pin"></i>`;
  };
  update();
  btn.onclick = () => {
    const c = currentChar();
    const a = (c.abilities[key] || []).find(a => a.id === ability.id);
    if (!a) return;
    a.pinned = !a.pinned;
    save();
    renderActTab();
    update();
  };
}

// ── OPEN CATEGORY SHEET ───────────────────────────────────────
function openCategorySheet(category) {
  resetSheetPin();
  const cfg       = CATEGORIES[category];
  const actionKey = category + '_action';
  const bonusKey  = category + '_bonus';
  const c         = currentChar();
  const actionAbs = (c && c.abilities[actionKey]) || [];
  const bonusAbs  = (c && c.abilities[bonusKey])  || [];

  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ${cfg.icon} ${cfg.color}"></i> ${cfg.label}`;

  const addBtnLabel = category === 'magic' ? 'Add Spell or Ability' : `Add ${cfg.label} ability`;
  const sectionHTML = (abilities, key, label) =>
    `<div class="cat-sheet-divider">${label}</div>` +
    (abilities.length
      ? abilities.map(a => renderAbilityCard(a, key)).join('')
      : `<div class="empty-state empty-state-sm">None added yet.</div>`);

  const body = document.getElementById('sheetBody');
  body.innerHTML =
    sectionHTML(actionAbs, actionKey, 'Actions') +
    sectionHTML(bonusAbs,  bonusKey,  'Bonus Actions') +
    `<button class="add-btn" id="sheetAddBtn"><i class="ti ti-plus"></i> ${addBtnLabel}</button>`;

  body.querySelectorAll('.ability-card').forEach(card => {
    card.addEventListener('click', () => {
      const key     = card.dataset.key;
      const ability = (c.abilities[key] || []).find(a => a.id === card.dataset.id);
      if (!ability) return;
      openAbilityDetailSheet(ability, key);
    });
  });

  document.getElementById('sheetAddBtn').addEventListener('click', () => openAddSheet(actionKey, category));
  openOverlay('overlay');
}

// ── OPEN EXTRA ACTION SHEET ───────────────────────────────────
function openExtraActionSheet(key) {
  resetSheetPin();
  const cfg = EXTRA_ACTIONS[key];
  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ${cfg.icon} ${cfg.color}"></i> ${cfg.label}`;
  document.getElementById('sheetBody').innerHTML =
    `<p class="ability-desc" style="padding-top:4px;">${tagCheckBonuses(esc(cfg.desc), currentChar())}</p>`;
  openOverlay('overlay');
}

// ── OPEN SAVE OVERRIDE SHEET ──────────────────────────────────
function openSaveOverrideSheet(ability) {
  const c = currentChar();
  const st      = (c && c.savingThrows && c.savingThrows[ability]) || { prof: false, override: null };
  const hasOver = st.override !== null && st.override !== undefined;
  const mod     = getAbilityMod((c && c[ability]) || 10);
  const profNum = parseInt((c && c.prof) || '+2') || 2;
  const autoVal = st.prof ? mod + profNum : mod;
  const autoStr = (autoVal >= 0 ? '+' : '') + autoVal;
  const saveAdv = st.adv || 'none';

  document.getElementById('sheetTitle').innerHTML =
    `${abilityIcon(ability)} ${ABILITY_NAMES[ability]} Saving Throw`;
  const isProf = !!st.prof;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label">Proficiency</label>
        <div class="prof-seg" id="save-prof-seg">
          <button class="prof-seg-btn${!isProf ? ' active' : ''}" data-state="none">None</button>
          <button class="prof-seg-btn${isProf  ? ' active' : ''}" data-state="prof"><i class="ti ti-circle-filled"></i> Proficient</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Advantage</label>
        <div class="prof-seg" id="save-adv-seg">
          <button class="prof-seg-btn${saveAdv === 'disadv' ? ' active' : ''}" data-state="disadv"><i class="ti ti-chevrons-down"></i> Disadv.</button>
          <button class="prof-seg-btn${saveAdv === 'none'   ? ' active' : ''}" data-state="none">Normal</button>
          <button class="prof-seg-btn${saveAdv === 'adv'    ? ' active' : ''}" data-state="adv"><i class="ti ti-chevrons-up"></i> Adv.</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Override Bonus</label>
        <input class="form-input" id="save-override-input" type="number" value="${hasOver ? st.override : ''}" placeholder="Override (${autoStr})">
        <div class="tab-hint">Leave blank to auto-calculate from proficiency</div>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" id="save-override-cancel">Cancel</button>
        <button class="btn-save" id="save-override-save">Save</button>
      </div>
    </div>`;

  document.getElementById('save-prof-seg').addEventListener('click', e => {
    const btn = e.target.closest('.prof-seg-btn');
    if (!btn) return;
    document.querySelectorAll('#save-prof-seg .prof-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
  document.getElementById('save-adv-seg').addEventListener('click', e => {
    const btn = e.target.closest('.prof-seg-btn');
    if (!btn) return;
    document.querySelectorAll('#save-adv-seg .prof-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('save-override-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('save-override-save').addEventListener('click', () => {
    if (!c) { closeOverlay('overlay'); return; }
    if (!c.savingThrows) c.savingThrows = blankSavingThrows();
    if (!c.savingThrows[ability]) c.savingThrows[ability] = { prof: false, override: null };
    const selectedProf = document.querySelector('#save-prof-seg .prof-seg-btn.active')?.dataset.state || 'none';
    c.savingThrows[ability].prof = selectedProf === 'prof';
    const selectedAdv = document.querySelector('#save-adv-seg .prof-seg-btn.active')?.dataset.state || 'none';
    c.savingThrows[ability].adv = selectedAdv;
    const raw = document.getElementById('save-override-input').value.trim();
    c.savingThrows[ability].override = raw === '' ? null : parseInt(raw);
    save();
    closeOverlay('overlay');
    renderDefenseTab();
  });

  openOverlay('overlay');
}

// ── OPEN CHARACTER DETAILS SHEET (Darkvision + Speeds) ─
function openCharacterDetailsSheet() {
  const c = currentChar();
  if (!c) return;
  const dv = c.darkvision != null ? c.darkvision : '';

  document.getElementById('sheetTitle').innerHTML = `<i class="ti ti-user c-gold"></i> Character Details`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label"><i class="ti ti-eye c-blue"></i> Darkvision</label>
        <input class="form-input" id="cd-dv" type="number" min="0" value="${dv}" placeholder="60">
        <div class="tab-hint">Range in feet. Leave blank for no darkvision.</div>
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-shoe c-blue"></i> Walk Speed</label>
        <input class="form-input" id="cd-walk" value="${esc(c.speed || '30 ft')}">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-feather c-blue"></i> Fly Speed</label>
        <input class="form-input" id="cd-fly" value="${esc(c.flySpeed || '')}" placeholder="Leave blank if none">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-mountain c-blue"></i> Climb Speed</label>
        <input class="form-input" id="cd-climb" value="${esc(c.climbSpeed || '')}" placeholder="Default: half walk speed">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-ripple c-blue"></i> Swim Speed</label>
        <input class="form-input" id="cd-swim" value="${esc(c.swimSpeed || '')}" placeholder="Default: half walk speed">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" id="cd-cancel">Cancel</button>
        <button class="btn-save" id="cd-save">Save</button>
      </div>
    </div>`;

  document.getElementById('cd-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('cd-save').addEventListener('click', () => {
    const dvRaw  = document.getElementById('cd-dv').value.trim();
    c.darkvision = dvRaw === '' ? null : parseInt(dvRaw);
    c.speed      = document.getElementById('cd-walk').value.trim()  || c.speed;
    c.flySpeed   = document.getElementById('cd-fly').value.trim()   || null;
    c.climbSpeed = document.getElementById('cd-climb').value.trim() || null;
    c.swimSpeed  = document.getElementById('cd-swim').value.trim()  || null;
    save();
    closeOverlay('overlay');
    renderExploreTab();
  });
  openOverlay('overlay');
}

// ── OPEN PASSIVE SCORES SHEET ─────────────────────────────────
function openPassiveScoresSheet() {
  const c = currentChar();
  if (!c) return;
  const ovr = c.passiveOverrides || {};

  const autoPerc = 10 + calcSkillBonus(c, 'perception');
  const autoInv  = 10 + calcSkillBonus(c, 'investigation');
  const autoIns  = 10 + calcSkillBonus(c, 'insight');

  document.getElementById('sheetTitle').innerHTML = `<i class="ti ti-eye c-blue"></i> Passive Scores`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="tab-hint" style="margin-bottom:4px;">Leave blank to use the auto-calculated value (10 + skill bonus).</div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-eye c-blue"></i> Perception</label>
        <input class="form-input" id="ps-perc" type="number" value="${ovr.perception != null ? ovr.perception : ''}" placeholder="Override (${autoPerc})">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-zoom-question c-green"></i> Investigation</label>
        <input class="form-input" id="ps-inv" type="number" value="${ovr.investigation != null ? ovr.investigation : ''}" placeholder="Override (${autoInv})">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-bulb c-amber"></i> Insight</label>
        <input class="form-input" id="ps-ins" type="number" value="${ovr.insight != null ? ovr.insight : ''}" placeholder="Override (${autoIns})">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" id="ps-cancel">Cancel</button>
        <button class="btn-save" id="ps-save">Save</button>
      </div>
    </div>`;

  document.getElementById('ps-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('ps-save').addEventListener('click', () => {
    if (!c.passiveOverrides) c.passiveOverrides = {};
    const rawPerc = document.getElementById('ps-perc').value.trim();
    const rawInv  = document.getElementById('ps-inv').value.trim();
    const rawIns  = document.getElementById('ps-ins').value.trim();
    c.passiveOverrides.perception    = rawPerc === '' ? null : parseInt(rawPerc);
    c.passiveOverrides.investigation = rawInv  === '' ? null : parseInt(rawInv);
    c.passiveOverrides.insight       = rawIns  === '' ? null : parseInt(rawIns);
    save();
    closeOverlay('overlay');
    renderExploreTab();
  });
  openOverlay('overlay');
}

// ── OPEN SPELL STATS SHEET ───────────────────────────────────
function openSpellStatsSheet() {
  const c = currentChar();
  if (!c) return;
  const spAb   = c.spellAbility && c.spellAbility !== 'none' ? c.spellAbility : null;
  const spMod  = spAb ? getAbilityMod(c[spAb] || 10) : null;
  const prof   = parseInt(c.prof || '+2') || 2;
  const autoMod = spMod;
  const autoAtk = spMod !== null ? prof + spMod : null;
  const autoDC  = spMod !== null ? 8 + prof + spMod : null;
  const fmt    = v => v !== null && v !== undefined ? (v >= 0 ? '+' : '') + v : '—';
  const ovr    = c.spellStats || {};

  document.getElementById('sheetTitle').innerHTML = `<i class="ti ti-sparkles c-purple"></i> Spellcasting Stats`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="tab-hint" style="margin-bottom:4px;">Leave blank to auto-calculate from your spellcasting ability and proficiency.</div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-sparkles c-purple"></i> Spell Modifier</label>
        <input class="form-input" id="ss-mod" type="number" value="${ovr.modOverride != null ? ovr.modOverride : ''}" placeholder="Auto (${fmt(autoMod)})">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-wand c-purple"></i> Spell Attack</label>
        <input class="form-input" id="ss-atk" type="number" value="${ovr.attackOverride != null ? ovr.attackOverride : ''}" placeholder="Auto (${fmt(autoAtk)})">
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-shield-bolt c-purple"></i> Spell Save DC</label>
        <input class="form-input" id="ss-dc" type="number" value="${ovr.dcOverride != null ? ovr.dcOverride : ''}" placeholder="Auto (${autoDC !== null ? autoDC : '—'})">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" id="ss-cancel">Cancel</button>
        <button class="btn-save" id="ss-save">Save</button>
      </div>
    </div>`;

  document.getElementById('ss-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('ss-save').addEventListener('click', () => {
    if (!c.spellStats) c.spellStats = {};
    const rawMod = document.getElementById('ss-mod').value.trim();
    const rawAtk = document.getElementById('ss-atk').value.trim();
    const rawDC  = document.getElementById('ss-dc').value.trim();
    c.spellStats.modOverride    = rawMod === '' ? null : parseInt(rawMod);
    c.spellStats.attackOverride = rawAtk === '' ? null : parseInt(rawAtk);
    c.spellStats.dcOverride     = rawDC  === '' ? null : parseInt(rawDC);
    save();
    closeOverlay('overlay');
    renderExploreTab();
  });
  openOverlay('overlay');
}

// ── OPEN SKILL OVERRIDE SHEET ────────────────────────────────
function openSkillOverrideSheet(skillKey) {
  const skill = SKILLS.find(s => s.key === skillKey);
  if (!skill) return;
  const c            = currentChar();
  const state        = (c && c.skills && c.skills[skillKey]) || 'none';
  const score        = c ? (c[skill.ability] || 10) : 10;
  const mod          = getAbilityMod(score);
  const profNum      = parseInt((c && c.prof) || '+2') || 2;
  let autoVal = mod;
  if (state === 'prof')   autoVal = mod + profNum;
  if (state === 'expert') autoVal = mod + profNum * 2;
  const autoStr      = (autoVal >= 0 ? '+' : '') + autoVal;
  const overrides    = (c && c.skillOverrides) || {};
  const hasOver      = overrides[skillKey] !== null && overrides[skillKey] !== undefined;
  const skillAdv     = ((c && c.skillAdv) || {})[skillKey] || 'none';

  document.getElementById('sheetTitle').innerHTML =
    `${abilityIcon(skill.ability)} ${skill.name} <span style="font-weight:400;color:var(--ink-faint);font-size:0.8em;">(${skill.ability.toUpperCase()})</span>`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label">Proficiency</label>
        <div class="prof-seg" id="prof-seg">
          <button class="prof-seg-btn${state === 'none'   ? ' active' : ''}" data-state="none">None</button>
          <button class="prof-seg-btn${state === 'prof'   ? ' active' : ''}" data-state="prof"><i class="ti ti-circle-filled"></i> Proficient</button>
          <button class="prof-seg-btn${state === 'expert' ? ' active' : ''}" data-state="expert"><i class="ti ti-star-filled"></i> Expertise</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Advantage</label>
        <div class="prof-seg" id="skill-adv-seg">
          <button class="prof-seg-btn${skillAdv === 'disadv' ? ' active' : ''}" data-state="disadv"><i class="ti ti-chevrons-down"></i> Disadv.</button>
          <button class="prof-seg-btn${skillAdv === 'none'   ? ' active' : ''}" data-state="none">Normal</button>
          <button class="prof-seg-btn${skillAdv === 'adv'    ? ' active' : ''}" data-state="adv"><i class="ti ti-chevrons-up"></i> Adv.</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Override Bonus</label>
        <input class="form-input" id="skill-override-input" type="number" value="${hasOver ? overrides[skillKey] : ''}" placeholder="Override (${autoStr})">
        <div class="tab-hint">Leave blank to auto-calculate from proficiency</div>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" id="skill-override-cancel">Cancel</button>
        <button class="btn-save"   id="skill-override-save">Save</button>
      </div>
    </div>`;

  document.getElementById('prof-seg').addEventListener('click', e => {
    const btn = e.target.closest('.prof-seg-btn');
    if (!btn) return;
    document.querySelectorAll('#prof-seg .prof-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
  document.getElementById('skill-adv-seg').addEventListener('click', e => {
    const btn = e.target.closest('.prof-seg-btn');
    if (!btn) return;
    document.querySelectorAll('#skill-adv-seg .prof-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('skill-override-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('skill-override-save').addEventListener('click', () => {
    if (!c) { closeOverlay('overlay'); return; }
    const selectedState = document.querySelector('#prof-seg .prof-seg-btn.active')?.dataset.state || 'none';
    if (!c.skills) c.skills = {};
    c.skills[skillKey] = selectedState;
    if (!c.skillOverrides) c.skillOverrides = {};
    const raw = document.getElementById('skill-override-input').value.trim();
    c.skillOverrides[skillKey] = raw === '' ? null : parseInt(raw);
    if (!c.skillAdv) c.skillAdv = {};
    c.skillAdv[skillKey] = document.querySelector('#skill-adv-seg .prof-seg-btn.active')?.dataset.state || 'none';
    save();
    closeOverlay('overlay');
    renderExploreTab();
  });

  openOverlay('overlay');
}

// ── OPEN ADD / EDIT RESISTANCE / IMMUNITY SHEET ───────────────
function openAddResistanceSheet(type, editIndex = null) {
  const label = type === 'resistances' ? 'Resistance' : type === 'immunities' ? 'Immunity' : 'Vulnerability';
  const iconName  = type === 'resistances' ? 'ti-shield-up' : type === 'immunities' ? 'ti-shield-cancel' : 'ti-shield-down';
  const iconColor = type === 'resistances' ? 'c-green' : type === 'immunities' ? 'c-gold' : 'c-red';
  const isEdit   = editIndex !== null;
  const c        = currentChar();
  const existing = isEdit ? (c && c[type] && c[type][editIndex]) || '' : '';

  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ${isEdit ? 'ti-pencil c-blue' : `${iconName} ${iconColor}`}"></i> ${isEdit ? 'Edit' : 'Add'} ${label}`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label">${label} Type</label>
        <input class="form-input" id="resist-input" placeholder="Fire damage" autocomplete="off" value="${esc(existing)}">
      </div>
      <div class="form-actions">
        ${isEdit ? `<button class="btn-delete" id="resist-delete"><i class="ti ti-trash"></i></button>` : ''}
        <button class="btn-cancel" id="resist-cancel">Cancel</button>
        <button class="btn-save" id="resist-save">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </div>`;

  document.getElementById('resist-cancel').addEventListener('click', () => closeOverlay('overlay'));
  if (isEdit) {
    document.getElementById('resist-delete').addEventListener('click', () => {
      const c = currentChar();
      if (!c || !c[type]) return;
      c[type].splice(editIndex, 1);
      save();
      closeOverlay('overlay');
      renderDefenseTab();
    });
  }
  document.getElementById('resist-save').addEventListener('click', () => {
    const val = document.getElementById('resist-input').value.trim();
    if (!val) { document.getElementById('resist-input').focus(); return; }
    const c = currentChar();
    if (!c) return;
    if (!c[type]) c[type] = [];
    if (isEdit) {
      c[type][editIndex] = val;
    } else {
      c[type].push(val);
    }
    save();
    closeOverlay('overlay');
    renderDefenseTab();
  });

  openOverlay('overlay');
}

// ── OPEN ADD SHEET ────────────────────────────────────────────
function openAddSheet(key, category) {
  resetSheetPin();
  const cfg = CATEGORIES[category];
  const typeLabel = key.endsWith('_bonus') ? ' Bonus Action' : key.endsWith('_action') ? ' Action' : '';
  const addTitle  = category === 'magic' ? `${cfg.label}${typeLabel}` : cfg.label;
  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ti-plus ${cfg.color}"></i> Add ${addTitle}`;
  document.getElementById('sheetBody').innerHTML = buildForm(null, key);
  attachFormListeners(null, key);
  openOverlay('overlay');
}

// ── OPEN EDIT SHEET ───────────────────────────────────────────
function openEditSheet(ability, key) {
  const catName = key.split('_')[0];
  const cfg     = CATEGORIES[catName] || CATEGORIES['attack'];
  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ti-edit ${cfg.color}"></i> Edit`;
  document.getElementById('sheetBody').innerHTML = buildForm(ability, key);
  attachFormListeners(ability, key);
  if (key.endsWith('_action') || key.endsWith('_bonus')) showSheetPin(ability, key);
  else resetSheetPin();
  openOverlay('overlay');
}

// ── OPEN ABILITY DETAIL SHEET ─────────────────────────────────
function openAbilityDetailSheet(ability, key) {
  const category = key.split('_')[0];
  const cfg = CATEGORIES[category] || CATEGORIES['attack'];

  const badgeLabels = {
    melee: 'Melee', ranged: 'Ranged', thrown: 'Thrown',
    spell: 'Spell', 'spell-attack': 'Spell Attack', buff: 'Buff', ability: 'Ability',
    action: 'Action', bonus: 'Bonus', passive: 'Passive',
    class: 'Class', feat: 'Feat', origin: 'Origin', species: 'Species',
    reaction: 'Reaction',
  };

  const df = (label, val, full) =>
    val ? `<div class="detail-field${full ? ' detail-field-full' : ''}"><span class="detail-field-label">${label}</span><span class="detail-field-value">${esc(val)}</span></div>` : '';

  let flagChips = '';
  let fieldsHTML = '';

  if (category === 'magic') {
    flagChips = [
      ability.school  ? `<span class="ability-chip ability-chip-school">${esc(ability.school)}</span>` : '',
      ability.ritual  ? `<span class="ability-chip ability-chip-ritual">Ritual</span>` : '',
    ].filter(Boolean).join('');
    fieldsHTML = [
      df('Spell Level',      ability.spellLevel),
      df('Casting Time',     ability.castingTime),
      df('Components',       ability.components),
      df('Range / Area',     ability.range),
      df('Duration',         ability.duration),
      ability.concentration  ? df('Concentration', 'Yes') : '',
      df('Attack / Save',    ability.saveOrAttack),
      df('Damage / Healing', ability.damage),
    ].filter(Boolean).join('');
  } else if (category === 'attack') {
    flagChips = (ability.masteryEnabled && ability.mastery)
      ? `<span class="ability-chip ability-chip-mastery">Mastery: ${esc(ability.mastery)}</span>` : '';
    fieldsHTML = [
      df('To Hit',       ability.toHit),
      df('Range',        ability.range),
      df('Damage',       ability.damage),
      df('Bonus Damage', ability.damage2),
      df('Properties',   ability.properties, true),
    ].filter(Boolean).join('');
  } else if (category === 'items') {
    flagChips = ability.rarity
      ? `<span class="ability-chip ability-chip-purple">${esc(ability.rarity)}</span>` : '';
    fieldsHTML = [
      df('Category', ability.itemCategory),
      df('Cost',     ability.cost),
      df('Weight',   ability.weight),
    ].filter(Boolean).join('');
  } else if (category === 'features') {
    fieldsHTML = df('Prerequisite', ability.prerequisite, true);
  }

  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ${cfg.icon} ${cfg.color}"></i> ${esc(ability.name)}`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="spell-detail">
      <div class="spell-detail-badge">
        <span class="ability-badge badge-${ability.badge}">${esc(badgeLabels[ability.badge] || ability.badge || '')}</span>
        ${flagChips}
      </div>
      ${fieldsHTML ? `<div class="detail-fields">${fieldsHTML}</div>` : ''}
      ${ability.desc
        ? `<div class="spell-detail-desc">${tagCheckBonuses(esc(ability.desc), currentChar())}</div>`
        : `<p class="spell-detail-nodesc">No description saved.</p>`}
      <div class="form-actions">
        <button class="btn-cancel" id="det-close">Close</button>
        <button class="btn-save"   id="det-edit"><i class="ti ti-edit"></i> Edit</button>
      </div>
    </div>`;

  document.getElementById('det-close').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('det-edit').addEventListener('click', () => openEditSheet(ability, key));
  if (key.endsWith('_action') || key.endsWith('_bonus')) showSheetPin(ability, key);
  else resetSheetPin();
  openOverlay('overlay');
}

// ── BUILD ABILITY FORM ────────────────────────────────────────
function buildForm(ability, key) {
  const category = key.split('_')[0];
  const v = f => ability ? (ability[f] || '') : '';
  const badges = category === 'attack'
    ? [
        { value: 'melee',  label: 'Melee' },
        { value: 'ranged', label: 'Ranged' },
        { value: 'thrown', label: 'Thrown' },
      ]
    : category === 'magic'
    ? [
        { value: 'spell',        label: 'Spell' },
        { value: 'spell-attack', label: 'Spell Attack' },
        { value: 'buff',         label: 'Buff' },
        { value: 'ability',      label: 'Ability' },
      ]
    : category === 'features'
    ? [
        { value: 'class',   label: 'Class' },
        { value: 'feat',    label: 'Feat' },
        { value: 'origin',  label: 'Origin' },
        { value: 'species', label: 'Species' },
      ]
    : [
        { value: 'action',  label: 'Action' },
        { value: 'bonus',   label: 'Bonus' },
        { value: 'passive', label: 'Passive' },
      ];

  let extraFields = '';
  if (category === 'attack') {
    const isMasteryEnabled = ability ? !!ability.masteryEnabled : false;
    extraFields = `
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">To Hit</label>
          <input class="form-input" id="f-toHit" value="${esc(normalizeBonus(v('toHit')))}" placeholder="+8">
        </div>
        <div class="form-row">
          <label class="form-label">Range</label>
          <input class="form-input" id="f-range" value="${esc(v('range'))}" placeholder="5 ft.">
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Damage</label>
        <input class="form-input" id="f-damage" value="${esc(v('damage'))}" placeholder="2d6+4 slashing">
      </div>
      <div class="form-row">
        <label class="form-label">Bonus Damage <span class="form-label-opt">(optional)</span></label>
        <input class="form-input" id="f-damage2" value="${esc(v('damage2'))}" placeholder="1d4 Radiant">
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Properties <span class="form-label-opt">(optional)</span></label>
          <input class="form-input" id="f-properties" value="${esc(v('properties'))}" placeholder="Versatile (1d10)">
        </div>
        <div class="form-row">
          <label class="form-label">Mastery</label>
          <input class="form-input" id="f-mastery" value="${esc(v('mastery'))}" placeholder="Topple">
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Weapon Mastery</label>
        <div class="prof-seg" id="mastery-seg">
          <button class="prof-seg-btn${!isMasteryEnabled ? ' active' : ''}" data-state="off">No</button>
          <button class="prof-seg-btn${isMasteryEnabled ? ' active' : ''}" data-state="on">Yes</button>
        </div>
      </div>`;
  } else if (category === 'magic') {
    const curLevel  = v('spellLevel') || 'Cantrip';
    const isConc    = ability ? !!ability.concentration : false;
    const isRitual  = ability ? !!ability.ritual        : false;
    extraFields = `
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Spell Level</label>
          <input class="form-input" id="f-spellLevel" value="${esc(curLevel)}" placeholder="Cantrip">
        </div>
        <div class="form-row">
          <label class="form-label">Casting Time</label>
          <input class="form-input" id="f-castingTime" value="${esc(v('castingTime'))}" placeholder="1 Action">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">School</label>
          <input class="form-input" id="f-school" value="${esc(v('school'))}" placeholder="Abjuration">
        </div>
        <div class="form-row">
          <label class="form-label">Components</label>
          <input class="form-input" id="f-components" value="${esc(v('components'))}" placeholder="V, S">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Duration</label>
          <input class="form-input" id="f-duration" value="${esc(v('duration'))}" placeholder="Instantaneous">
        </div>
        <div class="form-row">
          <label class="form-label">Concentration</label>
          <input class="form-input" id="f-concentration" value="${isConc ? 'Yes' : 'No'}" placeholder="No">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Ritual</label>
          <input class="form-input" id="f-ritual" value="${isRitual ? 'Yes' : 'No'}" placeholder="No">
        </div>
        <div class="form-row">
          <label class="form-label">Range / Area</label>
          <input class="form-input" id="f-range" value="${esc(v('range'))}" placeholder="Self">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Attack / Save</label>
          <input class="form-input" id="f-saveOrAttack" value="${esc(v('saveOrAttack'))}" placeholder="DEX Save DC 15">
        </div>
        <div class="form-row">
          <label class="form-label">Damage / Healing</label>
          <input class="form-input" id="f-damage" value="${esc(v('damage'))}" placeholder="3d6 Fire">
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Quick Help Text <span class="form-label-opt">(optional)</span></label>
        <input class="form-input" id="f-quickRef" value="${esc(v('quickRef'))}" placeholder="3d6 Fire · CON Save DC 15">
      </div>`;
  } else if (category === 'items') {
    extraFields = `
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Category</label>
          <input class="form-input" id="f-itemCategory" value="${esc(v('itemCategory'))}" placeholder="Potion">
        </div>
        <div class="form-row">
          <label class="form-label">Rarity <span class="form-label-opt">(optional)</span></label>
          <input class="form-input" id="f-rarity" value="${esc(v('rarity'))}" placeholder="Common">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Cost <span class="form-label-opt">(optional)</span></label>
          <input class="form-input" id="f-cost" value="${esc(v('cost'))}" placeholder="50 gp">
        </div>
        <div class="form-row">
          <label class="form-label">Weight <span class="form-label-opt">(optional)</span></label>
          <input class="form-input" id="f-weight" value="${esc(v('weight'))}" placeholder="1 lb">
        </div>
      </div>`;
  } else if (category === 'features') {
    extraFields = `
      <div class="form-row">
        <label class="form-label">Prerequisite <span class="form-label-opt">(optional)</span></label>
        <input class="form-input" id="f-prerequisite" value="${esc(v('prerequisite'))}" placeholder="Level 4, Proficiency with a weapon">
      </div>`;
  } else if (category !== 'reaction') {
    extraFields = `
      <div class="form-row">
        <label class="form-label">Stats / Damage <span class="form-label-opt">(optional)</span></label>
        <input class="form-input" id="f-stat" value="${esc(v('stat'))}" placeholder="1d6+8 slashing · +8 to hit">
      </div>
      <div class="form-row">
        <label class="form-label">Quick Reference Text <span class="form-label-opt">(optional)</span></label>
        <input class="form-input" id="f-quickRef" value="${esc(v('quickRef'))}" placeholder="Heals 2d4+2 HP · Restores 1 charge">
      </div>`;
  }

  const namePlaceholder = category === 'magic'    ? 'Magic Missile'
    : category === 'attack'   ? 'Longsword'
    : category === 'items'    ? 'Healing Potion'
    : category === 'features' ? 'Alert'
    : 'Action Surge';

  const searchIcons = { magic: 'ti-wand c-purple', attack: 'ti-sword c-red', items: 'ti-flask-2 c-green', features: 'ti-sparkles c-amber' };
  const searchSugIds = { magic: 'spell-suggestions', attack: 'weapon-suggestions', items: 'item-suggestions', features: 'feat-suggestions' };
  const hasSearch = category in searchIcons;

  return `
    <div class="edit-form">
      <div class="form-row${hasSearch ? ' spell-search-row' : ''}">
        <label class="form-label">${hasSearch ? `<i class="ti ${searchIcons[category]}"></i> ` : ''}Name</label>
        <input class="form-input" id="f-name" value="${esc(v('name'))}" placeholder="${namePlaceholder}" autocomplete="off">
        ${hasSearch ? `<div id="${searchSugIds[category]}" class="spell-suggestions"></div>` : ''}
      </div>
      ${category !== 'reaction' ? `
      ${category !== 'items' ? `
      <div class="form-row">
        <label class="form-label">${category === 'attack' ? 'Weapon Type' : 'Type'}</label>
        <select class="form-select" id="f-badge">
          ${badges.map(b => `<option value="${b.value}" ${v('badge') === b.value ? 'selected' : ''}>${b.label}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="form-row">
        <label class="form-label">Action Type</label>
        <div class="prof-seg" id="action-type-seg">
          <button class="prof-seg-btn${!key.endsWith('_bonus') ? ' active' : ''}" data-state="action">Action</button>
          <button class="prof-seg-btn${key.endsWith('_bonus')  ? ' active' : ''}" data-state="bonus">Bonus Action</button>
        </div>
      </div>` : ''}
      ${extraFields}
      <div class="form-row">
        <label class="form-label">Description</label>
        <textarea class="form-textarea${category === 'magic' ? ' form-textarea-magic' : ''}" id="f-desc" placeholder="What does this ability do?">${esc(v('desc'))}</textarea>
        ${category === 'features' ? `<p class="form-hint-2014" id="f-desc-hint" style="${ability && ability.badge === 'class' ? '' : 'display:none'}">Description pulled from the 2014 SRD — may not reflect 2024 rules. Review and edit as needed.</p>` : ''}
      </div>
      <div class="form-actions">
        ${ability ? `<button class="btn-delete" id="f-delete"><i class="ti ti-trash"></i></button>` : ''}
        <button class="btn-cancel" id="f-cancel">Cancel</button>
        <button class="btn-save"   id="f-save">Save</button>
      </div>
    </div>`;
}

// ── GENERIC AUTOCOMPLETE HELPER ───────────────────────────────
function wireInputSearch(inputId, sugId, fetchFn, labelFn, fillFn, minLen = 2) {
  const searchEl  = document.getElementById(inputId);
  const suggestEl = document.getElementById(sugId);
  if (!searchEl || !suggestEl) return;
  let debounce;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = searchEl.value.trim();
    if (q.length < minLen) { suggestEl.innerHTML = ''; return; }
    debounce = setTimeout(async () => {
      const results = await fetchFn(q);
      if (!results.length) { suggestEl.innerHTML = ''; return; }
      suggestEl.innerHTML = results.map((r, i) => {
        const name = typeof r === 'string' ? r : esc(r.name);
        const lbl  = typeof r === 'string' ? '' : esc(labelFn(r));
        return `<div class="spell-suggest-item" data-idx="${i}">${name}${lbl ? `<span class="spell-suggest-lvl">${lbl}</span>` : ''}</div>`;
      }).join('');
      suggestEl._results = results;
      suggestEl.querySelectorAll('.spell-suggest-item').forEach(item => {
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          const r = suggestEl._results[parseInt(item.dataset.idx)];
          if (r) fillFn(r);
          suggestEl.innerHTML = '';
        });
      });
    }, 250);
  });
  searchEl.addEventListener('blur', () => setTimeout(() => { suggestEl.innerHTML = ''; }, 200));
}

// ── ATTACH ABILITY FORM LISTENERS ─────────────────────────────
function attachFormListeners(ability, key) {
  const category = key.split('_')[0];

  document.getElementById('f-cancel').addEventListener('click', () => closeOverlay('overlay'));

  const actionTypeSeg = document.getElementById('action-type-seg');
  if (actionTypeSeg) {
    actionTypeSeg.addEventListener('click', e => {
      const btn = e.target.closest('.prof-seg-btn');
      if (!btn) return;
      actionTypeSeg.querySelectorAll('.prof-seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  const concSeg = document.getElementById('f-conc-seg');
  if (concSeg) {
    concSeg.addEventListener('click', e => {
      const btn = e.target.closest('.prof-seg-btn');
      if (!btn) return;
      concSeg.querySelectorAll('.prof-seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  const wireSearch = (sugId, fetchFn, labelFn, fillFn) => wireInputSearch('f-name', sugId, fetchFn, labelFn, fillFn);

  const LVLS = ['Cantrip','1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];
  if (category === 'magic') {
    wireSearch('spell-suggestions', fetchSpellSuggestions,
      s => LVLS[Number.isFinite(s.level) ? s.level : 0] || '',
      fillSpellForm);
  } else if (category === 'attack') {
    wireSearch('weapon-suggestions', fetchWeaponSuggestions,
      w => w.is_simple ? 'Simple' : 'Martial',
      fillWeaponForm);
    const masterySeg = document.getElementById('mastery-seg');
    if (masterySeg) {
      masterySeg.addEventListener('click', e => {
        const btn = e.target.closest('.prof-seg-btn');
        if (!btn) return;
        masterySeg.querySelectorAll('.prof-seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
  } else if (category === 'items') {
    wireSearch('item-suggestions', fetchItemSuggestions,
      i => (i.rarity ? i.rarity : (i.category && typeof i.category === 'object' ? i.category.name : i.category)) || '',
      fillItemForm);
  } else if (category === 'features') {
    wireSearch('feat-suggestions', fetchFeatSuggestions,
      f => {
        if (f._kind === 'class_feature') return `${f._className || 'Class'} Feature`;
        return f.type === 'Origin' ? 'Origin Feat' : 'Feat';
      },
      fillFeatForm);
  }

  document.getElementById('f-save').addEventListener('click', () => {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { document.getElementById('f-name').focus(); return; }

    const badgeEl = document.getElementById('f-badge');
    const activeTypeBtnEl = document.querySelector('#action-type-seg .prof-seg-btn.active');
    const actionTypeVal = activeTypeBtnEl ? activeTypeBtnEl.dataset.state : (key.endsWith('_bonus') ? 'bonus' : 'action');
    const entry = {
      id:     ability ? ability.id : 'ab_' + Date.now(),
      name,
      badge:  category === 'items' ? actionTypeVal : (badgeEl ? badgeEl.value : 'reaction'),
      desc:   document.getElementById('f-desc').value.trim(),
      pinned: ability ? (ability.pinned || false) : false,
    };

    if (category === 'attack') {
      entry.toHit          = normalizeBonus(document.getElementById('f-toHit').value.trim());
      entry.damage         = document.getElementById('f-damage').value.trim();
      entry.damage2        = document.getElementById('f-damage2').value.trim();
      entry.range          = document.getElementById('f-range').value.trim();
      entry.properties     = document.getElementById('f-properties')?.value.trim() || '';
      entry.mastery        = document.getElementById('f-mastery')?.value.trim() || '';
      entry.masteryEnabled = document.querySelector('#mastery-seg .prof-seg-btn.active')?.dataset.state === 'on';
    } else if (category === 'magic') {
      entry.spellLevel    = document.getElementById('f-spellLevel').value.trim();
      entry.castingTime   = document.getElementById('f-castingTime').value.trim();
      entry.school        = document.getElementById('f-school').value.trim();
      entry.components    = document.getElementById('f-components').value.trim();
      entry.duration      = document.getElementById('f-duration').value.trim();
      entry.concentration = document.getElementById('f-concentration')?.value === 'Yes';
      entry.ritual        = document.getElementById('f-ritual')?.value === 'Yes';
      entry.range         = document.getElementById('f-range').value.trim();
      entry.saveOrAttack  = document.getElementById('f-saveOrAttack').value.trim();
      entry.damage        = document.getElementById('f-damage').value.trim();
      entry.quickRef      = document.getElementById('f-quickRef')?.value.trim() || '';
    } else if (category === 'items') {
      entry.itemCategory = document.getElementById('f-itemCategory')?.value.trim() || '';
      entry.rarity       = document.getElementById('f-rarity')?.value.trim() || '';
      entry.cost         = document.getElementById('f-cost')?.value.trim() || '';
      entry.weight       = document.getElementById('f-weight')?.value.trim() || '';
    } else if (category === 'features') {
      entry.prerequisite = document.getElementById('f-prerequisite')?.value.trim() || '';
    } else {
      const statEl = document.getElementById('f-stat');
      if (statEl) entry.stat = statEl.value.trim();
      const quickRefEl = document.getElementById('f-quickRef');
      if (quickRefEl) entry.quickRef = quickRefEl.value.trim();
    }

    const activeTypeBtn = document.querySelector('#action-type-seg .prof-seg-btn.active');
    const newType = activeTypeBtn ? activeTypeBtn.dataset.state : (key.endsWith('_bonus') ? 'bonus' : 'action');
    const newKey  = category === 'reaction' ? 'reaction' : (category + '_' + newType);

    const c = currentChar();
    if (!c.abilities[newKey]) c.abilities[newKey] = [];

    if (ability && key !== newKey) {
      c.abilities[key] = (c.abilities[key] || []).filter(a => a.id !== ability.id);
      c.abilities[newKey].push(entry);
    } else if (ability) {
      const idx = c.abilities[newKey].findIndex(a => a.id === ability.id);
      if (idx !== -1) c.abilities[newKey][idx] = entry;
    } else {
      c.abilities[newKey].push(entry);
    }

    save();
    renderAllSimpleTabs();
    closeOverlay('overlay');
  });

  const delBtn = document.getElementById('f-delete');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const c = currentChar();
      c.abilities[key] = (c.abilities[key] || []).filter(a => a.id !== ability.id);
      save();
      renderAllSimpleTabs();
      closeOverlay('overlay');
    });
  }
}

// ── OVERLAY HELPERS ───────────────────────────────────────────
function openOverlay(id)  {
  document.getElementById(id).classList.add('open');
  const body = document.getElementById('sheetBody');
  if (body) body.scrollTop = 0;
}
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// Tap the dark backdrop (outside the sheet) to dismiss
document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay(overlay.id);
  });
});

document.getElementById('sheetClose').addEventListener('click', () => closeOverlay('overlay'));

// ── DRAG-TO-DISMISS (mobile sheet handles) ────────────────────
document.querySelectorAll('.sheet-handle').forEach(handle => {
  const sheet   = handle.closest('.sheet');
  const overlay = handle.closest('.overlay');
  if (!sheet || !overlay) return;

  let startY    = 0;
  let active    = false;

  function onMove(e) {
    if (!active) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = Math.max(0, clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }

  function onEnd(e) {
    if (!active) return;
    active = false;
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onEnd);
    sheet.style.transition = '';
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const dy = clientY - startY;
    if (dy > 120) {
      sheet.style.transform = '';
      closeOverlay(overlay.id);
    } else {
      sheet.style.transform = '';
    }
  }

  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    active = true;
    sheet.style.transition = 'none';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onEnd);
  }, { passive: true });
});

// ── ADD BUTTONS (simple tabs) ─────────────────────────────────
document.querySelectorAll('.add-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => openAddSheet(btn.dataset.tab, btn.dataset.tab));
});

// ── STAT EDIT ─────────────────────────────────────────────────
function applyStatForm(c) {
  const nameVal = document.getElementById('s-name')?.value.trim();
  if (nameVal) c.name = nameVal;
  c.level   = document.getElementById('s-level')?.value.trim()   ?? c.level;
  c.species = document.getElementById('s-species')?.value.trim() ?? c.species;
  c.cls     = document.getElementById('s-cls')?.value.trim()     ?? c.cls;
  const subParts = [
    c.level   ? `Lvl ${c.level}` : null,
    c.species || null,
    c.cls     || null,
  ].filter(Boolean);
  if (subParts.length) c.sub = subParts.join(' · ');
  c.hp    = parseInt(document.getElementById('s-hp')?.value)    || c.hp;
  c.ac    = parseInt(document.getElementById('s-ac')?.value)    || c.ac;
  c.speed = document.getElementById('s-speed')?.value.trim()   || c.speed;
  c.prof  = document.getElementById('s-prof')?.value.trim()    || c.prof;
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ab => {
    c[ab] = parseInt(document.getElementById(`s-${ab}`)?.value) || c[ab] || 10;
  });
  c.size          = document.querySelector('#size-seg .prof-seg-btn.active')?.dataset.state         || c.size || 'medium';
  c.spellAbility  = document.querySelector('#spell-ability-seg .prof-seg-btn.active')?.dataset.state || 'none';
  c.attacksPerRound = parseInt(document.getElementById('s-attacks')?.value) || 1;
  if (!c.spellSlots) c.spellSlots = blankSpellSlots();
  for (let lvl = 1; lvl <= 9; lvl++) {
    const el = document.getElementById(`s-slot-${lvl}`);
    if (el) {
      const newMax  = parseInt(el.value) || 0;
      const oldUsed = (c.spellSlots[lvl] || {}).used || 0;
      c.spellSlots[lvl] = { max: newMax, used: Math.min(oldUsed, newMax) };
    }
  }
}

function openStatSheet() {
  const c = currentChar();
  if (!c) return;
  document.getElementById('statBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label"><i class="ti ti-user"></i> Character Name</label>
        <input class="form-input" id="s-name" value="${esc(c.name)}">
      </div>
      <div class="form-row-3">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-crown"></i> Level</label>
          <input class="form-input" id="s-level" type="number" min="1" max="20" value="${esc(c.level || '')}">
        </div>
        <div class="form-row" style="position:relative;">
          <label class="form-label"><i class="ti ti-dna-2"></i> Species</label>
          <input class="form-input" id="s-species" value="${esc(c.species || '')}" placeholder="Human" autocomplete="off">
          <div class="spell-suggestions" id="s-species-suggestions"></div>
        </div>
        <div class="form-row" style="position:relative;">
          <label class="form-label"><i class="ti ti-wand"></i> Class</label>
          <input class="form-input" id="s-cls" value="${esc(c.cls || '')}" autocomplete="off">
          <div class="spell-suggestions" id="s-cls-suggestions"></div>
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-heart"></i> Max HP</label>
          <input class="stat-edit-input" id="s-hp" type="number" value="${c.hp}">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-shield"></i> Armor Class</label>
          <input class="stat-edit-input" id="s-ac" type="number" value="${c.ac}">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-shoe"></i> Speed</label>
          <input class="stat-edit-input" id="s-speed" value="${esc(c.speed || '30ft')}">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-star"></i> Prof. Bonus</label>
          <input class="stat-edit-input" id="s-prof" value="${esc(c.prof || '+2')}">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-swords"></i> Attacks / Round</label>
          <input class="stat-edit-input" id="s-attacks" type="number" min="1" max="10" value="${c.attacksPerRound || 1}">
        </div>
        <div></div>
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-ruler-2"></i> Size</label>
        <div class="prof-seg" id="size-seg">
          <button class="prof-seg-btn${(c.size||'medium')==='small'  ? ' active' : ''}" data-state="small">Small</button>
          <button class="prof-seg-btn${(c.size||'medium')==='medium' ? ' active' : ''}" data-state="medium">Medium</button>
          <button class="prof-seg-btn${(c.size||'medium')==='large'  ? ' active' : ''}" data-state="large">Large</button>
        </div>
      </div>
      <div class="section-lbl">Ability Scores</div>
      <div class="form-row-3">
        <div class="form-row">
          <label class="form-label">STR</label>
          <input class="stat-edit-input" id="s-str" type="number" min="1" max="30" value="${c.str || 10}">
          <div class="ability-mod" id="s-str-mod">${modStr(c.str || 10)}</div>
        </div>
        <div class="form-row">
          <label class="form-label">DEX</label>
          <input class="stat-edit-input" id="s-dex" type="number" min="1" max="30" value="${c.dex || 10}">
          <div class="ability-mod" id="s-dex-mod">${modStr(c.dex || 10)}</div>
        </div>
        <div class="form-row">
          <label class="form-label">CON</label>
          <input class="stat-edit-input" id="s-con" type="number" min="1" max="30" value="${c.con || 10}">
          <div class="ability-mod" id="s-con-mod">${modStr(c.con || 10)}</div>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-row">
          <label class="form-label">INT</label>
          <input class="stat-edit-input" id="s-int" type="number" min="1" max="30" value="${c.int || 10}">
          <div class="ability-mod" id="s-int-mod">${modStr(c.int || 10)}</div>
        </div>
        <div class="form-row">
          <label class="form-label">WIS</label>
          <input class="stat-edit-input" id="s-wis" type="number" min="1" max="30" value="${c.wis || 10}">
          <div class="ability-mod" id="s-wis-mod">${modStr(c.wis || 10)}</div>
        </div>
        <div class="form-row">
          <label class="form-label">CHA</label>
          <input class="stat-edit-input" id="s-cha" type="number" min="1" max="30" value="${c.cha || 10}">
          <div class="ability-mod" id="s-cha-mod">${modStr(c.cha || 10)}</div>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label"><i class="ti ti-sparkles c-purple"></i> Spellcasting Ability</label>
        <div class="prof-seg" id="spell-ability-seg">
          <button class="prof-seg-btn${!c.spellAbility || c.spellAbility === 'none' ? ' active' : ''}" data-state="none">None</button>
          <button class="prof-seg-btn${c.spellAbility === 'int' ? ' active' : ''}" data-state="int">INT</button>
          <button class="prof-seg-btn${c.spellAbility === 'wis' ? ' active' : ''}" data-state="wis">WIS</button>
          <button class="prof-seg-btn${c.spellAbility === 'cha' ? ' active' : ''}" data-state="cha">CHA</button>
        </div>
      </div>
      <div id="spell-slots-section" style="${!c.spellAbility || c.spellAbility === 'none' ? 'display:none' : ''}">
      <div class="section-lbl"><i class="ti ti-wand c-purple"></i> Spell Slots</div>
      <div class="tab-hint" style="margin-bottom:10px;">Max slots per level. Leave at 0 if not a caster.</div>
      <div class="slot-config-grid">
        ${SLOT_ORDINALS.map((ord, i) => {
          const lvl = i + 1;
          const max = (c.spellSlots && c.spellSlots[lvl]) ? c.spellSlots[lvl].max : 0;
          return `<div class="slot-config-cell">
            <label class="form-label">${ord}</label>
            <input class="stat-edit-input" id="s-slot-${lvl}" type="number" min="0" max="9" value="${max}">
          </div>`;
        }).join('')}
      </div>
      </div>
      <div class="form-actions" style="margin-top:4px;">
        <button class="btn-cancel" id="s-cancel">Cancel</button>
        <button class="btn-save"   id="s-save">Save</button>
      </div>
    </div>`;

  document.getElementById('s-cancel').addEventListener('click', () => closeOverlay('statOverlay'));
  document.getElementById('s-save').addEventListener('click', () => {
    applyStatForm(c);
    save();
    renderHeader();
    renderAllSimpleTabs();
    closeOverlay('statOverlay');
  });

  document.getElementById('statOverlay').addEventListener('focusout', e => {
    if (!e.target.matches('input')) return;
    applyStatForm(c);
    save();
    renderHeader();
    renderAllSimpleTabs();
  });

  document.getElementById('size-seg').addEventListener('click', e => {
    const btn = e.target.closest('.prof-seg-btn');
    if (!btn) return;
    document.querySelectorAll('#size-seg .prof-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('spell-ability-seg').addEventListener('click', e => {
    const btn = e.target.closest('.prof-seg-btn');
    if (!btn) return;
    document.querySelectorAll('#spell-ability-seg .prof-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const slotsSection = document.getElementById('spell-slots-section');
    if (slotsSection) slotsSection.style.display = btn.dataset.state === 'none' ? 'none' : '';
  });

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ab => {
    const input = document.getElementById(`s-${ab}`);
    const mod   = document.getElementById(`s-${ab}-mod`);
    if (input && mod) {
      input.addEventListener('input', () => {
        mod.textContent = modStr(parseInt(input.value) || 10);
      });
    }
  });

  wireInputSearch('s-species', 's-species-suggestions',
    fetchSpeciesSuggestions, () => '2024 SRD',
    s => { document.getElementById('s-species').value = s.name || s; });
  wireInputSearch('s-cls', 's-cls-suggestions',
    fetchClassSuggestions, () => '',
    cls => { document.getElementById('s-cls').value = typeof cls === 'string' ? cls : cls.name; }, 1);

  openOverlay('statOverlay');
}

document.getElementById('statClose').addEventListener('click', () => closeOverlay('statOverlay'));

// ── HERO SUMMARY ─────────────────────────────────────────────
function openHeroSummary() {
  const c = currentChar();
  if (!c) return;

  const subParts = [
    c.level   ? `Lvl ${c.level}` : null,
    c.species || null,
    c.cls     || null,
  ].filter(Boolean);
  const sub = subParts.join(' · ') || c.sub || '';

  const avatarInner = c.avatar
    ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<i class="ti ti-user" style="font-size:32px;color:var(--gold);"></i>`;

  const ABILITY_LABELS = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' };
  const abilityGrid = ['str','dex','con','int','wis','cha'].map(ab => `
    <div class="hero-ability">
      <div class="hero-ability-label">${ABILITY_LABELS[ab]}</div>
      <div class="hero-ability-score">${c[ab] || 10}</div>
      <div class="hero-ability-mod">${modStr(c[ab] || 10)}</div>
    </div>`).join('');

  document.getElementById('heroBody').innerHTML = `
    <div class="hero-summary">
      <div class="hero-top">
        <div class="hero-avatar-wrap" id="heroAvatarWrap">
          <div class="hero-avatar">${avatarInner}</div>
          <div class="hero-avatar-edit"><i class="ti ti-camera"></i></div>
          ${c.avatar ? `<button class="hero-avatar-remove" id="heroAvatarRemove" aria-label="Remove avatar"><i class="ti ti-x"></i></button>` : ''}
          <input type="file" id="heroAvatarInput" accept="image/*" style="display:none;">
        </div>
        <div class="hero-ident">
          <div class="hero-name">${esc(c.name)}</div>
          ${sub ? `<div class="hero-sub">${esc(sub)}</div>` : ''}
        </div>
      </div>
      <div class="hero-pills">
        <div class="hero-pill"><i class="ti ti-heart c-red"></i><span>${c.hp || '—'}</span><div class="hero-pill-lbl">Max HP</div></div>
        <div class="hero-pill"><i class="ti ti-shield ac-i"></i><span>${c.ac || '—'}</span><div class="hero-pill-lbl">AC</div></div>
        <div class="hero-pill"><i class="ti ti-shoe speed-i"></i><span>${esc(c.speed || '—')}</span><div class="hero-pill-lbl">Speed</div></div>
        <div class="hero-pill"><i class="ti ti-star prof-i"></i><span>${esc(c.prof || '—')}</span><div class="hero-pill-lbl">Proficiency</div></div>
      </div>
      <div class="hero-ability-grid">${abilityGrid}</div>
      <div class="hero-actions">
        <button class="btn-cancel" id="heroSwitchBtn"><i class="ti ti-users"></i> Switch</button>
        <button class="btn-save"   id="heroEditBtn"><i class="ti ti-pencil"></i> Edit Stats</button>
      </div>
    </div>`;

  document.getElementById('heroAvatarWrap').addEventListener('click', () => {
    document.getElementById('heroAvatarInput').click();
  });

  document.getElementById('heroAvatarInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      c.avatar = ev.target.result;
      save();
      renderHeader();
      const heroAvatar = document.querySelector('#heroBody .hero-avatar');
      if (heroAvatar) heroAvatar.innerHTML =
        `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      if (!document.getElementById('heroAvatarRemove')) {
        const btn = document.createElement('button');
        btn.className = 'hero-avatar-remove';
        btn.id = 'heroAvatarRemove';
        btn.setAttribute('aria-label', 'Remove avatar');
        btn.innerHTML = '<i class="ti ti-x"></i>';
        document.getElementById('heroAvatarWrap').appendChild(btn);
        wireRemoveAvatar(c, btn);
      }
    };
    reader.readAsDataURL(file);
  });

  const removeBtn = document.getElementById('heroAvatarRemove');
  if (removeBtn) wireRemoveAvatar(c, removeBtn);

  function wireRemoveAvatar(c, btn) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      c.avatar = null;
      save();
      renderHeader();
      document.querySelector('#heroBody .hero-avatar').innerHTML =
        `<i class="ti ti-user" style="font-size:32px;color:var(--gold);"></i>`;
      btn.remove();
    });
  }

  document.getElementById('heroEditBtn').addEventListener('click', () => {
    closeOverlay('heroOverlay');
    openStatSheet();
  });

  document.getElementById('heroSwitchBtn').addEventListener('click', () => {
    closeOverlay('heroOverlay');
    renderCharSwitcher();
    openOverlay('charOverlay');
  });

  openOverlay('heroOverlay');
}

// ── IMPORT / EXPORT ───────────────────────────────────────────
function stripCharDefaults(c) {
  const out = {};
  const skip = v => v === null || v === undefined || v === '';

  ['id','name','sub','level','cls','species','hp','ac','speed','prof',
   'str','dex','con','int','wis','cha','currentHp','darkvision',
   'flySpeed','climbSpeed','swimSpeed','spellAbility',
   'spellSaveOverride','spellAttackOverride','spellModOverride'].forEach(k => {
    if (!skip(c[k])) out[k] = c[k];
  });
  if (c.size && c.size !== 'medium') out.size = c.size;
  if (c.attacksPerRound && c.attacksPerRound !== 1) out.attacksPerRound = c.attacksPerRound;

  const skills = {};
  Object.entries(c.skills || {}).forEach(([k,v]) => { if (v !== 'none') skills[k] = v; });
  if (Object.keys(skills).length) out.skills = skills;

  const so = {};
  Object.entries(c.skillOverrides || {}).forEach(([k,v]) => { if (v !== null) so[k] = v; });
  if (Object.keys(so).length) out.skillOverrides = so;

  const sa = {};
  Object.entries(c.skillAdv || {}).forEach(([k,v]) => { if (v) sa[k] = v; });
  if (Object.keys(sa).length) out.skillAdv = sa;

  const st = {};
  Object.entries(c.savingThrows || {}).forEach(([k,v]) => {
    if (v.prof || v.override !== null || v.adv) st[k] = v;
  });
  if (Object.keys(st).length) out.savingThrows = st;

  ['resistances','immunities','vulnerabilities'].forEach(k => {
    if (c[k] && c[k].length) out[k] = c[k];
  });

  const abs = {};
  Object.entries(c.abilities || {}).forEach(([k,v]) => {
    if (Array.isArray(v) && v.length) abs[k] = v;
  });
  if (Object.keys(abs).length) out.abilities = abs;

  const ss = {};
  Object.entries(c.spellSlots || {}).forEach(([k,v]) => {
    if (v && (v.max > 0 || v.used > 0)) ss[k] = v;
  });
  if (Object.keys(ss).length) out.spellSlots = ss;

  if (c.pinnedActions && c.pinnedActions.length) out.pinnedActions = c.pinnedActions;
  if (c.pinnedBonus   && c.pinnedBonus.length)   out.pinnedBonus   = c.pinnedBonus;
  if (c.avatar) out.avatar = c.avatar;

  return out;
}

function encodeChar(c) {
  return LZString.compressToBase64(JSON.stringify(stripCharDefaults(c)));
}

function validateImportedChar(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { valid: false, error: 'Invalid export code.' };

  const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v, mn, mx, fb) => { const n = Number(v); return (Number.isFinite(n) && n >= mn && n <= mx) ? Math.floor(n) : fb; };

  const name = str(d.name, 100).trim();
  if (!name) return { valid: false, error: 'Character has no name.' };

  const VALID_SKILL_VALS = new Set(['none', 'prof', 'expert']);
  const VALID_SIZES      = new Set(['small', 'medium', 'large']);
  const SPELL_ABILITIES  = new Set(['str','dex','con','int','wis','cha','none']);

  // Skills
  const skills = blankSkills();
  if (d.skills && typeof d.skills === 'object') {
    Object.keys(skills).forEach(k => { if (VALID_SKILL_VALS.has(d.skills[k])) skills[k] = d.skills[k]; });
  }

  // Skill numeric overrides
  const skillOverrides = {};
  if (d.skillOverrides && typeof d.skillOverrides === 'object') {
    Object.keys(skills).forEach(k => {
      const v = d.skillOverrides[k];
      if (v === null) skillOverrides[k] = null;
      else if (Number.isFinite(Number(v))) skillOverrides[k] = Number(v);
    });
  }

  // Skill advantage/disadvantage overrides
  const skillAdv = {};
  if (d.skillAdv && typeof d.skillAdv === 'object') {
    Object.keys(skills).forEach(k => { if (['adv','dis'].includes(d.skillAdv[k])) skillAdv[k] = d.skillAdv[k]; });
  }

  // Saving throws
  const savingThrows = blankSavingThrows();
  if (d.savingThrows && typeof d.savingThrows === 'object') {
    ['str','dex','con','int','wis','cha'].forEach(ab => {
      const st = d.savingThrows[ab];
      if (st && typeof st === 'object') {
        savingThrows[ab] = {
          prof: !!st.prof,
          override: (st.override !== undefined && st.override !== null && Number.isFinite(Number(st.override))) ? Number(st.override) : null,
        };
        if (['adv','dis'].includes(st.adv)) savingThrows[ab].adv = st.adv;
      }
    });
  }

  // Resistances / immunities / vulnerabilities
  const sanitizeTags = arr =>
    Array.isArray(arr) ? arr.filter(v => typeof v === 'string').map(v => v.slice(0, 100)).slice(0, 50) : [];

  // Abilities (all nine categories)
  const abilities = blankAbilities();
  const ABILITY_CATS = ['attack_action','magic_action','items_action','features_action',
                        'attack_bonus','magic_bonus','items_bonus','features_bonus','reaction'];
  if (d.abilities && typeof d.abilities === 'object') {
    ABILITY_CATS.forEach(cat => {
      if (!Array.isArray(d.abilities[cat])) return;
      abilities[cat] = d.abilities[cat]
        .filter(a => a && typeof a === 'object')
        .map(a => {
          const entry = {
            id:   str(a.id, 50) || ('imp_' + Math.random().toString(36).slice(2)),
            name: str(a.name, 200),
            badge: str(a.badge, 50),
            desc: str(a.desc, 2000),
          };
          // Optional category-specific fields — include only if present
          ['toHit','damage','damage2','damageType2','range',
           'spellLevel','saveOrAttack','stat'].forEach(f => {
            if (a[f] !== undefined) entry[f] = str(a[f], 200);
          });
          return entry;
        });
    });
  }

  // Spell slots
  const spellSlots = blankSpellSlots();
  if (d.spellSlots && typeof d.spellSlots === 'object') {
    for (let i = 1; i <= 9; i++) {
      const s = d.spellSlots[i];
      if (s && typeof s === 'object') {
        const mx = num(s.max, 0, 10, 0);
        spellSlots[i] = { max: mx, used: Math.min(num(s.used, 0, 10, 0), mx) };
      }
    }
  }

  // Avatar — only accept data URIs
  const avatar = (typeof d.avatar === 'string' && d.avatar.startsWith('data:image/')) ? d.avatar : null;

  const maxHp = num(d.hp, 0, 9999, 10);

  const char = {
    id: 'char_' + Date.now(),
    name,
    sub:     str(d.sub, 200),
    level:   str(d.level, 10),
    cls:     str(d.cls, 100),
    species: str(d.species, 100),
    hp:    maxHp,
    ac:    num(d.ac, 0, 99, 10),
    speed: str(d.speed, 20),
    prof:  /^\+?\d+$/.test(str(d.prof, 5)) ? str(d.prof, 5) : '+2',
    currentHp: num(d.currentHp, 0, 9999, maxHp),
    str: num(d.str, 1, 30, 10),
    dex: num(d.dex, 1, 30, 10),
    con: num(d.con, 1, 30, 10),
    int: num(d.int, 1, 30, 10),
    wis: num(d.wis, 1, 30, 10),
    cha: num(d.cha, 1, 30, 10),
    skills, skillOverrides, skillAdv, savingThrows,
    resistances:    sanitizeTags(d.resistances),
    immunities:     sanitizeTags(d.immunities),
    vulnerabilities: sanitizeTags(d.vulnerabilities),
    abilities,
    spellSlots,
    spellAbility: SPELL_ABILITIES.has(d.spellAbility) ? d.spellAbility : 'none',
    spellSaveOverride:   (d.spellSaveOverride   != null && Number.isFinite(Number(d.spellSaveOverride)))   ? Number(d.spellSaveOverride)   : null,
    spellAttackOverride: (d.spellAttackOverride != null && Number.isFinite(Number(d.spellAttackOverride))) ? Number(d.spellAttackOverride) : null,
    spellModOverride:    (d.spellModOverride    != null && Number.isFinite(Number(d.spellModOverride)))    ? Number(d.spellModOverride)    : null,
    deathSaves: { successes: [false, false, false], failures: [false, false, false] },
    size: VALID_SIZES.has(d.size) ? d.size : 'medium',
    darkvision:  (d.darkvision  != null && Number.isFinite(Number(d.darkvision)))  ? Number(d.darkvision)  : null,
    flySpeed:    typeof d.flySpeed   === 'string' ? d.flySpeed.slice(0, 20)   : null,
    climbSpeed:  typeof d.climbSpeed === 'string' ? d.climbSpeed.slice(0, 20) : null,
    swimSpeed:   typeof d.swimSpeed  === 'string' ? d.swimSpeed.slice(0, 20)  : null,
    attacksPerRound: num(d.attacksPerRound, 1, 20, 1),
    pinnedActions: Array.isArray(d.pinnedActions) ? d.pinnedActions.filter(v => typeof v === 'string').slice(0, 20) : [],
    pinnedBonus:   Array.isArray(d.pinnedBonus)   ? d.pinnedBonus.filter(v => typeof v === 'string').slice(0, 20)   : [],
    avatar,
  };

  // Only keep pins that reference ability IDs that actually exist in this character
  const allIds = new Set(Object.values(char.abilities).flatMap(arr => arr.map(a => a.id)));
  char.pinnedActions = char.pinnedActions.filter(id => allIds.has(id));
  char.pinnedBonus   = char.pinnedBonus.filter(id => allIds.has(id));

  return { valid: true, char };
}

function openExportSheet(charId) {
  const c = characters.find(ch => ch.id === charId);
  if (!c) return;
  const code = encodeChar(c);
  const body = document.getElementById('exportCharBody');
  body.innerHTML = `
    <p class="transfer-hint">Copy this code and paste it on another device to import this character.</p>
    <textarea class="transfer-code-area" id="exportCodeArea" readonly spellcheck="false">${esc(code)}</textarea>
    <button class="transfer-copy-btn" id="exportCopyBtn"><i class="ti ti-copy"></i> Copy Code</button>`;
  document.getElementById('exportCodeArea').addEventListener('click', e => e.target.select());
  document.getElementById('exportCopyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('exportCopyBtn');
      btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
      setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy Code'; }, 2000);
    });
  });
  openOverlay('exportCharOverlay');
}

function openImportSheet() {
  const body = document.getElementById('importCharBody');
  body.innerHTML = `
    <p class="transfer-hint">Paste an export code below to add this character to your roster.</p>
    <textarea class="transfer-code-area" id="importCodeArea" placeholder="Paste export code here…" spellcheck="false"></textarea>
    <p class="import-error" id="importError"></p>
    <button class="new-char-btn" id="doImportBtn"><i class="ti ti-file-import"></i> Import Character</button>`;
  document.getElementById('doImportBtn').addEventListener('click', () => {
    const raw     = document.getElementById('importCodeArea').value.trim();
    const errorEl = document.getElementById('importError');
    errorEl.textContent = '';
    if (!raw) { errorEl.textContent = 'Please paste an export code.'; return; }
    let data;
    try {
      const decompressed = LZString.decompressFromBase64(raw);
      data = decompressed
        ? JSON.parse(decompressed)
        : JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch { errorEl.textContent = 'Invalid code — could not be read.'; return; }
    const result = validateImportedChar(data);
    if (!result.valid) { errorEl.textContent = result.error; return; }
    characters.push(result.char);
    save();
    closeOverlay('importCharOverlay');
    openOverlay('charOverlay');
    renderCharSwitcher();
  });
  openOverlay('importCharOverlay');
}

// ── CHARACTER SWITCHER ────────────────────────────────────────
function renderCharSwitcher() {
  const body = document.getElementById('charBody');

  body.innerHTML = characters.map(c => `
    <div class="char-list-item" data-id="${c.id}">
      <div class="char-list-avatar">${c.avatar
        ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<i class="ti ti-user"></i>`}</div>
      <div class="char-list-info">
        <div class="char-list-name">${esc(c.name)}</div>
        <div class="char-list-sub">${esc(c.sub || '')}</div>
      </div>
      <div class="char-list-actions">
        ${c.id === currentCharId ? '<div class="char-list-check"><i class="ti ti-check"></i></div>' : ''}
        <button class="char-export-btn" data-id="${c.id}" aria-label="Export ${esc(c.name)}">
          <i class="ti ti-file-export"></i>
        </button>
        <button class="char-delete-btn" data-id="${c.id}" aria-label="Delete ${esc(c.name)}">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>`).join('');

  body.innerHTML += `
    <button class="new-char-btn" id="newCharBtn"><i class="ti ti-plus"></i> New Character</button>
    <button class="new-char-btn" id="importCharBtn"><i class="ti ti-file-import"></i> Import Character</button>`;

  // Select character
  body.querySelectorAll('.char-list-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.char-delete-btn') || e.target.closest('.char-export-btn')) return;
      currentCharId = item.dataset.id;
      save();
      renderHeader();
      renderAllSimpleTabs();
      closeOverlay('charOverlay');
    });
  });

  // Delete character
  body.querySelectorAll('.char-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id   = btn.dataset.id;
      const char = characters.find(c => c.id === id);
      if (!char) return;

      if (!confirm(`Delete "${char.name}"? This cannot be undone.`)) return;

      characters = characters.filter(c => c.id !== id);

      // If we deleted the active character, switch to first remaining
      if (currentCharId === id) {
        currentCharId = characters.length > 0 ? characters[0].id : null;
      }

      save();

      if (characters.length === 0) {
        closeOverlay('charOverlay');
        showWelcome(true);
      } else {
        renderHeader();
        renderAllSimpleTabs();
        renderCharSwitcher(); // refresh the list in place
      }
    });
  });

  // Export character
  body.querySelectorAll('.char-export-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openExportSheet(btn.dataset.id);
    });
  });

  document.getElementById('newCharBtn').addEventListener('click', () => {
    closeOverlay('charOverlay');
    openNewCharSheet(false);
  });

  document.getElementById('importCharBtn').addEventListener('click', () => {
    closeOverlay('charOverlay');
    openImportSheet();
  });
}

document.getElementById('heroClose').addEventListener('click',       () => closeOverlay('heroOverlay'));
document.getElementById('charClose').addEventListener('click',       () => closeOverlay('charOverlay'));
document.getElementById('exportCharClose').addEventListener('click', () => closeOverlay('exportCharOverlay'));
document.getElementById('importCharClose').addEventListener('click', () => closeOverlay('importCharOverlay'));
document.getElementById('header').addEventListener('click', openHeroSummary);

// ── PARCHMENT TEXTURE ────────────────────────────────────────
(function () {
  const seed = Math.floor(Math.random() * 9999);
  const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="256" height="256" filter="url(#n)" opacity="0.20"/>
  </svg>`;
  document.documentElement.style.setProperty(
    '--parchment-texture',
    `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  );
})();

// ── INIT ──────────────────────────────────────────────────────
if (characters.length === 0) {
  showWelcome();
} else {
  if (!currentCharId || !characters.find(c => c.id === currentCharId)) {
    currentCharId = characters[0].id;
  }
  hideWelcome();
  renderHeader();
  renderAllSimpleTabs();
}

setTimeout(hideLoading, 1200);

// ── TOOLTIP ───────────────────────────────────────────────────
(function () {
  const tip = document.createElement('div');
  tip.className = 'ui-tooltip';
  document.body.appendChild(tip);

  let hideTimer = null;

  function tagTooltipText(text) {
    if (!text) return '';
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe.replace(/\b(advantage|disadvantage)\b/gi, match => {
      const isAdv = match.toLowerCase() === 'advantage';
      const cls    = isAdv ? 'adv-badge-adv' : 'adv-badge-disadv';
      const letter = isAdv ? 'A' : 'D';
      return `${match} <span class="adv-badge ${cls}">${letter}</span>`;
    });
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    clearTimeout(hideTimer);
    tip.innerHTML = tagTooltipText(el.dataset.tooltip);
    tip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const MARGIN = 8;
    const tipW = tip.offsetWidth;
    const idealLeft = r.left + r.width / 2;
    const clampedLeft = Math.max(MARGIN + tipW / 2, Math.min(window.innerWidth - MARGIN - tipW / 2, idealLeft));
    tip.style.left = clampedLeft + 'px';
    tip.style.top  = (r.top - tip.offsetHeight - 10) + 'px';
    requestAnimationFrame(() => tip.style.opacity = '1');
  });

  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    if (el.contains(e.relatedTarget)) return;
    hideTimer = setTimeout(() => {
      tip.style.opacity = '0';
      setTimeout(() => tip.style.display = 'none', 150);
    }, 150);
  });
})();

// ── HP TRACKER DOCUMENT LISTENERS ────────────────────────────
document.addEventListener('mousemove', e => {
  if (draggingHp && hpDragCallback) hpDragCallback(e.clientX);
});
document.addEventListener('touchmove', e => {
  if (draggingHp && hpDragCallback) hpDragCallback(e.touches[0].clientX);
}, { passive: false });
document.addEventListener('mouseup', () => {
  if (!draggingHp) return;
  draggingHp = false;
  const t = document.getElementById('hpThumb');
  if (t) t.classList.remove('dragging');
});
document.addEventListener('touchend', () => {
  if (!draggingHp) return;
  draggingHp = false;
  const t = document.getElementById('hpThumb');
  if (t) t.classList.remove('dragging');
});

// ── WELCOME DIE INTERACTION ───────────────────────────────────
(function () {
  const die = document.querySelector('.welcome-icon');
  if (!die) return;

  function spin() {
    die.classList.remove('spinning');
    void die.offsetWidth; // force reflow to restart animation
    die.classList.add('spinning');
  }

  die.addEventListener('animationend', () => die.classList.remove('spinning'));
  die.addEventListener('click', () => { if (!die.classList.contains('spinning')) spin(); });

  spin(); // play once on load
}());
