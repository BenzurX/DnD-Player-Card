// ── STATE ─────────────────────────────────────────────────────
let characters    = JSON.parse(localStorage.getItem('dnd_characters') || 'null') || [];
let currentCharId = localStorage.getItem('dnd_current_char') || null;

function currentChar() {
  return characters.find(c => c.id === currentCharId) || characters[0] || null;
}

function save() {
  localStorage.setItem('dnd_characters', JSON.stringify(characters));
  localStorage.setItem('dnd_current_char', currentCharId || '');
}

function blankAbilities() {
  return {
    attack_action: [], magic_action: [], items_action: [], features_action: [],
    attack_bonus:  [], magic_bonus: [], items_bonus: [], features_bonus: [],
    reaction: [], defense: [], explore: []
  };
}

// ── CATEGORY CONFIG ───────────────────────────────────────────
const CATEGORIES = {
  attack:   { icon: 'ti-sword',    color: 'c-red',    label: 'Attack' },
  magic:    { icon: 'ti-wand',     color: 'c-purple', label: 'Magic' },
  items:    { icon: 'ti-flask',    color: 'c-green',  label: 'Items' },
  features: { icon: 'ti-sparkles', color: 'c-amber',  label: 'Features' },
  reaction: { icon: 'ti-bolt',     color: 'c-purple', label: 'Reaction' },
  defense:  { icon: 'ti-shield-half', color: 'c-blue', label: 'Defense' },
  explore:  { icon: 'ti-map',      color: 'c-green',  label: 'Explore' },
};

// ── EXTRA ACTIONS ─────────────────────────────────────────────
const EXTRA_ACTIONS = {
  dash: {
    icon: 'ti-shoe', color: 'c-blue', label: 'Dash',
    desc: "Gain extra movement equal to your Speed for this turn. With a Speed of 30 ft., for example, you can move up to 60 ft. on your turn. Any increase or decrease to your Speed changes this additional movement by the same amount.",
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

function getSaveBonus(c, ability) {
  if (!c) return 0;
  const st      = (c.savingThrows || {})[ability] || { prof: false, override: null };
  if (st.override !== null && st.override !== undefined) return st.override;
  const mod     = getAbilityMod(c[ability] || 10);
  const profNum = parseInt(c.prof || '+2') || 2;
  return st.prof ? mod + profNum : mod;
}

// ── WELCOME SCREEN ────────────────────────────────────────────
function showWelcome() {
  document.getElementById('app').style.display     = 'none';
  document.getElementById('welcome').style.display = 'flex';
}

function hideWelcome() {
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('app').style.display     = 'flex';
}

document.getElementById('welcomeCreate').addEventListener('click', () => {
  openNewCharSheet(true);
});

// ── NEW CHARACTER FORM ────────────────────────────────────────
function openNewCharSheet(fromWelcome) {
  document.getElementById('newCharBody').innerHTML = `
    <div class="edit-form">

      <div class="form-row">
        <label class="form-label"><i class="ti ti-user"></i> Character Name</label>
        <input class="form-input" id="nc-name" placeholder="e.g. Amara Witchbane" autocomplete="off">
      </div>

      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-crown"></i> Level</label>
          <input class="form-input" id="nc-level" type="number" min="1" max="20" placeholder="5">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-award"></i> Proficiency Bonus</label>
          <input class="form-input" id="nc-prof" placeholder="+3">
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-wand"></i> Class</label>
          <input class="form-input" id="nc-class" placeholder="e.g. Fighter">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-dna"></i> Species</label>
          <input class="form-input" id="nc-species" placeholder="e.g. Human">
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-heart"></i> Max HP</label>
          <input class="form-input" id="nc-hp" type="number" min="1" placeholder="34">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-shield"></i> Armor Class</label>
          <input class="form-input" id="nc-ac" type="number" min="1" placeholder="15">
        </div>
      </div>

      <div class="form-row">
        <label class="form-label"><i class="ti ti-shoe"></i> Movement Speed</label>
        <input class="form-input" id="nc-speed" placeholder="e.g. 30ft">
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
      str, dex, con, int: intScore, wis, cha,
      skills: blankSkills(),
      savingThrows: blankSavingThrows(),
      resistances: [],
      immunities: [],
      abilities: blankAbilities()
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
  } else {
    badgeLabel = a.badge === 'action' ? 'Action' : a.badge === 'bonus' ? 'Bonus' : 'Passive';
  }

  let statsHTML = '';
  if (category === 'attack') {
    const chips = [
      a.toHit  ? `<span class="ability-chip">${a.toHit} to hit</span>` : '',
      a.damage ? `<span class="ability-chip">${a.damage}</span>` : '',
      a.range  ? `<span class="ability-chip">${a.range}</span>` : '',
    ].filter(Boolean);
    if (chips.length) statsHTML = `<div class="ability-chips">${chips.join('')}</div>`;
  } else if (category === 'magic') {
    const chips = [
      a.spellLevel   ? `<span class="ability-chip ability-chip-purple">${a.spellLevel}</span>` : '',
      a.saveOrAttack ? `<span class="ability-chip">${a.saveOrAttack}</span>` : '',
      a.damage       ? `<span class="ability-chip">${a.damage}</span>` : '',
      a.range        ? `<span class="ability-chip">${a.range}</span>` : '',
    ].filter(Boolean);
    if (chips.length) statsHTML = `<div class="ability-chips">${chips.join('')}</div>`;
  } else if (a.stat) {
    statsHTML = `<span class="ability-stat">${a.stat}</span>`;
  }

  return `
    <div class="ability-card" data-id="${a.id}" data-key="${key}">
      <div class="ability-top">
        <span class="ability-name">${a.name}</span>
        ${category !== 'reaction' ? `<span class="ability-badge badge-${a.badge}">${badgeLabel}</span>` : ''}
      </div>
      ${a.desc ? `<p class="ability-desc">${a.desc}</p>` : ''}
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
      if (ability) openEditSheet(ability, abilityKey);
    });
  });
}

function renderAllSimpleTabs() {
  renderSimpleTab('reaction', 'reaction', 'Reaction');
  renderDefenseTab();
  renderExploreTab();
}

// ── RENDER EXPLORE TAB ────────────────────────────────────────
function renderExploreTab() {
  const tab = document.getElementById('tab-explore');
  const c   = currentChar();

  const skillData     = (c && c.skills)         || {};
  const skillOverrides = (c && c.skillOverrides) || {};

  function calcBonus(skill) {
    const over = skillOverrides[skill.key];
    if (over !== null && over !== undefined) return over;
    const state   = skillData[skill.key] || 'none';
    const score   = c ? (c[skill.ability] || 10) : 10;
    const mod     = getAbilityMod(score);
    const profNum = parseInt(c ? (c.prof || '+2') : '+2') || 2;
    if (state === 'expert') return mod + profNum * 2;
    if (state === 'prof')   return mod + profNum;
    return mod;
  }

  function profIcon(state) {
    if (state === 'expert') return 'ti-star-filled';
    if (state === 'prof')   return 'ti-circle-filled';
    return 'ti-circle';
  }

  const skillsHTML = SKILLS.map(skill => {
    const state    = skillData[skill.key] || 'none';
    const hasOver  = skillOverrides[skill.key] !== null && skillOverrides[skill.key] !== undefined;
    const bonus    = calcBonus(skill);
    const bonusStr = (bonus >= 0 ? '+' : '') + bonus;
    return `
      <div class="skill-row" data-skill="${skill.key}">
        <button class="prof-toggle ${state}" data-skill="${skill.key}" aria-label="Toggle ${skill.name} proficiency">
          <i class="ti ${profIcon(state)}"></i>
        </button>
        <div class="skill-info">
          <span class="skill-name">${skill.name}</span>
          <span class="skill-ability">${abilityIcon(skill.ability)}${skill.ability.toUpperCase()}</span>
        </div>
        <div class="skill-bonus${state !== 'none' && !hasOver ? ' is-prof' : ''}${hasOver ? ' is-override' : ''}">${bonusStr}${hasOver ? '*' : ''}</div>
      </div>`;
  }).join('');

  tab.innerHTML = `
    <div class="section-hdr">Skills</div>
    <div class="skill-grid">${skillsHTML}</div>
    <div style="font-family:'Cinzel',serif;font-size:var(--text-2xs);color:var(--ink-faint);letter-spacing:0.5px;text-align:center;margin-top:10px;">Tap the circles to mark Proficiency or Expertise</div>`;

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
  const ABILITY_NAMES = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };

  const saveRows = ['str','dex','con','int','wis','cha'].map(ab => {
    const st      = saves[ab] || { prof: false, override: null };
    const isProf  = !!st.prof;
    const hasOver = st.override !== null && st.override !== undefined;
    const bonus   = getSaveBonus(c, ab);
    const bStr    = (bonus >= 0 ? '+' : '') + bonus;
    return `
      <div class="skill-row save-row" data-ability="${ab}">
        <button class="prof-toggle${isProf ? ' prof' : ''}" data-save="${ab}" aria-label="Toggle ${ABILITY_NAMES[ab]} save proficiency">
          <i class="ti ${isProf ? 'ti-circle-filled' : 'ti-circle'}"></i>
        </button>
        <div class="skill-info">
          <span class="skill-name">${abilityIcon(ab)} ${ABILITY_NAMES[ab]}</span>
        </div>
        <div class="skill-bonus${isProf ? ' is-prof' : ''}${hasOver ? ' is-override' : ''}">${bStr}${hasOver ? '*' : ''}</div>
      </div>`;
  }).join('');

  const resistances = (c && c.resistances) || [];
  const immunities  = (c && c.immunities)  || [];

  function chipsHTML(arr, type) {
    if (arr.length === 0) return `<p style="color:var(--ink-faint);font-style:italic;padding:8px 0 4px;font-size:var(--text-base);">None added yet.</p>`;
    return `<div class="resist-chips">${arr.map((r, i) =>
      `<div class="resist-chip"><span>${r}</span><button class="resist-chip-remove" data-type="${type}" data-index="${i}" aria-label="Remove ${r}"><i class="ti ti-x"></i></button></div>`
    ).join('')}</div>`;
  }

  const resistTags = resistances.map(r => `<div class="def-tag def-tag-resist">${r}</div>`).join('');
  const immuneTags = immunities.map(im => `<div class="def-tag def-tag-immune">${im}</div>`).join('');
  const noTags     = !resistances.length && !immunities.length;

  tab.innerHTML = `
    <div class="defense-summary">
      <div class="defense-ac">
        <i class="ti ti-shield-half"></i>
        <div class="defense-ac-val">${c && c.ac ? c.ac : '—'}</div>
        <div class="defense-ac-lbl">AC</div>
      </div>
      <div class="defense-tags-col">
        ${noTags ? `<span style="color:var(--ink-faint);font-style:italic;font-size:var(--text-sm);">No resistances<br>or immunities.</span>` : ''}
        ${resistTags ? `<div><div class="defense-tags-section-lbl">Resist</div><div class="defense-tags">${resistTags}</div></div>` : ''}
        ${immuneTags ? `<div><div class="defense-tags-section-lbl">Immune</div><div class="defense-tags">${immuneTags}</div></div>` : ''}
      </div>
    </div>

    <div class="section-hdr">Saving Throws</div>
    <div class="skill-grid" id="saveList">${saveRows}</div>

    <div class="section-hdr section-gap">Resistances</div>
    <div id="resistList">${chipsHTML(resistances, 'resistances')}</div>
    <button class="add-btn" id="addResistBtn"><i class="ti ti-plus"></i> Add Resistance</button>

    <div class="section-hdr section-gap">Immunities</div>
    <div id="immunityList">${chipsHTML(immunities, 'immunities')}</div>
    <button class="add-btn" id="addImmunityBtn"><i class="ti ti-plus"></i> Add Immunity</button>`;

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

  tab.querySelectorAll('.resist-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!c) return;
      const type  = btn.dataset.type;
      const index = parseInt(btn.dataset.index);
      if (!c[type]) c[type] = [];
      c[type].splice(index, 1);
      save();
      renderDefenseTab();
    });
  });

  document.getElementById('addResistBtn').addEventListener('click', () => openAddResistanceSheet('resistances'));
  document.getElementById('addImmunityBtn').addEventListener('click', () => openAddResistanceSheet('immunities'));
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

// ── ACTION BUTTON TAPS ────────────────────────────────────────
document.querySelectorAll('.act-btn:not(.extra-act)').forEach(btn => {
  btn.addEventListener('click', () => openCategorySheet(btn.dataset.category, btn.dataset.type));
});

document.querySelectorAll('.extra-act').forEach(btn => {
  btn.addEventListener('click', () => openExtraActionSheet(btn.dataset.extra));
});

// ── OPEN CATEGORY SHEET ───────────────────────────────────────
function openCategorySheet(category, type) {
  const cfg       = CATEGORIES[category];
  const key       = category + '_' + type;
  const c         = currentChar();
  const abilities = (c && c.abilities[key]) || [];

  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ${cfg.icon} ${cfg.color}"></i> ${cfg.label}`;

  const body = document.getElementById('sheetBody');
  body.innerHTML = abilities.length === 0
    ? `<div class="empty-state">No abilities added here yet.</div>`
    : abilities.map(a => renderAbilityCard(a, key)).join('');

  body.innerHTML += `<button class="add-btn" id="sheetAddBtn"><i class="ti ti-plus"></i> Add ${cfg.label} ability</button>`;

  body.querySelectorAll('.ability-card').forEach(card => {
    card.addEventListener('click', () => {
      const ability = c.abilities[key].find(a => a.id === card.dataset.id);
      if (ability) openEditSheet(ability, key);
    });
  });

  document.getElementById('sheetAddBtn').addEventListener('click', () => openAddSheet(key, category));
  openOverlay('overlay');
}

// ── OPEN EXTRA ACTION SHEET ───────────────────────────────────
function openExtraActionSheet(key) {
  const cfg = EXTRA_ACTIONS[key];
  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ${cfg.icon} ${cfg.color}"></i> ${cfg.label}`;
  document.getElementById('sheetBody').innerHTML =
    `<p class="ability-desc" style="padding-top:4px;">${cfg.desc}</p>`;
  openOverlay('overlay');
}

// ── OPEN SAVE OVERRIDE SHEET ──────────────────────────────────
function openSaveOverrideSheet(ability) {
  const ABILITY_NAMES = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };
  const c       = currentChar();
  const st      = (c && c.savingThrows && c.savingThrows[ability]) || { prof: false, override: null };
  const hasOver = st.override !== null && st.override !== undefined;
  const mod     = getAbilityMod((c && c[ability]) || 10);
  const profNum = parseInt((c && c.prof) || '+2') || 2;
  const autoVal = st.prof ? mod + profNum : mod;
  const autoStr = (autoVal >= 0 ? '+' : '') + autoVal;

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
        <label class="form-label">Override Bonus</label>
        <input class="form-input" id="save-override-input" type="number" value="${hasOver ? st.override : ''}" placeholder="Auto (${autoStr})">
        <div style="font-family:'Cinzel',serif;font-size:var(--text-2xs);color:var(--ink-faint);letter-spacing:0.5px;margin-top:2px;">Leave blank to auto-calculate from proficiency</div>
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

  document.getElementById('save-override-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('save-override-save').addEventListener('click', () => {
    if (!c) { closeOverlay('overlay'); return; }
    if (!c.savingThrows) c.savingThrows = blankSavingThrows();
    if (!c.savingThrows[ability]) c.savingThrows[ability] = { prof: false, override: null };
    const selectedState = document.querySelector('#save-prof-seg .prof-seg-btn.active')?.dataset.state || 'none';
    c.savingThrows[ability].prof = selectedState === 'prof';
    const raw = document.getElementById('save-override-input').value.trim();
    c.savingThrows[ability].override = raw === '' ? null : parseInt(raw);
    save();
    closeOverlay('overlay');
    renderDefenseTab();
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
        <label class="form-label">Override Bonus</label>
        <input class="form-input" id="skill-override-input" type="number" value="${hasOver ? overrides[skillKey] : ''}" placeholder="Auto (${autoStr})">
        <div style="font-family:'Cinzel',serif;font-size:var(--text-2xs);color:var(--ink-faint);letter-spacing:0.5px;margin-top:2px;">Leave blank to auto-calculate from proficiency</div>
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

  document.getElementById('skill-override-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('skill-override-save').addEventListener('click', () => {
    if (!c) { closeOverlay('overlay'); return; }
    const selectedState = document.querySelector('#prof-seg .prof-seg-btn.active')?.dataset.state || 'none';
    if (!c.skills) c.skills = {};
    c.skills[skillKey] = selectedState;
    if (!c.skillOverrides) c.skillOverrides = {};
    const raw = document.getElementById('skill-override-input').value.trim();
    c.skillOverrides[skillKey] = raw === '' ? null : parseInt(raw);
    save();
    closeOverlay('overlay');
    renderExploreTab();
  });

  openOverlay('overlay');
}

// ── OPEN ADD RESISTANCE / IMMUNITY SHEET ──────────────────────
function openAddResistanceSheet(type) {
  const label = type === 'resistances' ? 'Resistance' : 'Immunity';
  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ti-plus c-blue"></i> Add ${label}`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label">${label} Type</label>
        <input class="form-input" id="resist-input" placeholder="e.g. Fire damage" autocomplete="off">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" id="resist-cancel">Cancel</button>
        <button class="btn-save" id="resist-save">Add</button>
      </div>
    </div>`;

  document.getElementById('resist-cancel').addEventListener('click', () => closeOverlay('overlay'));
  document.getElementById('resist-save').addEventListener('click', () => {
    const val = document.getElementById('resist-input').value.trim();
    if (!val) { document.getElementById('resist-input').focus(); return; }
    const c = currentChar();
    if (!c) return;
    if (!c[type]) c[type] = [];
    c[type].push(val);
    save();
    closeOverlay('overlay');
    renderDefenseTab();
  });

  openOverlay('overlay');
}

// ── OPEN ADD SHEET ────────────────────────────────────────────
function openAddSheet(key, category) {
  const cfg = CATEGORIES[category];
  document.getElementById('sheetTitle').innerHTML =
    `<i class="ti ti-plus ${cfg.color}"></i> Add ${cfg.label}`;
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
    : [
        { value: 'action',  label: 'Action' },
        { value: 'bonus',   label: 'Bonus' },
        { value: 'passive', label: 'Passive' },
      ];

  let extraFields = '';
  if (category === 'attack') {
    extraFields = `
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">To Hit</label>
          <input class="form-input" id="f-toHit" value="${v('toHit')}" placeholder="+8">
        </div>
        <div class="form-row">
          <label class="form-label">Range</label>
          <input class="form-input" id="f-range" value="${v('range')}" placeholder="5 ft.">
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Damage</label>
        <input class="form-input" id="f-damage" value="${v('damage')}" placeholder="2d6+4 slashing">
      </div>`;
  } else if (category === 'magic') {
    extraFields = `
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Spell Level</label>
          <input class="form-input" id="f-spellLevel" value="${v('spellLevel')}" placeholder="Cantrip">
        </div>
        <div class="form-row">
          <label class="form-label">Range</label>
          <input class="form-input" id="f-range" value="${v('range')}" placeholder="60 ft.">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label class="form-label">Attack / Save</label>
          <input class="form-input" id="f-saveOrAttack" value="${v('saveOrAttack')}" placeholder="DEX Save DC 15">
        </div>
        <div class="form-row">
          <label class="form-label">Damage / Effect</label>
          <input class="form-input" id="f-damage" value="${v('damage')}" placeholder="3d6 fire">
        </div>
      </div>`;
  } else {
    extraFields = `
      <div class="form-row">
        <label class="form-label">Stats / Damage (optional)</label>
        <input class="form-input" id="f-stat" value="${v('stat')}" placeholder="e.g. 1d6+8 slashing · +8 to hit">
      </div>`;
  }

  return `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label">Name</label>
        <input class="form-input" id="f-name" value="${v('name')}" placeholder="e.g. Handaxe Throw">
      </div>
      ${category !== 'reaction' ? `
      <div class="form-row">
        <label class="form-label">${category === 'attack' ? 'Weapon Type' : 'Type'}</label>
        <select class="form-select" id="f-badge">
          ${badges.map(b => `<option value="${b.value}" ${v('badge') === b.value ? 'selected' : ''}>${b.label}</option>`).join('')}
        </select>
      </div>` : ''}
      ${extraFields}
      <div class="form-row">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="f-desc" placeholder="What does this ability do?">${v('desc')}</textarea>
      </div>
      <div class="form-actions">
        ${ability ? `<button class="btn-delete" id="f-delete"><i class="ti ti-trash"></i></button>` : ''}
        <button class="btn-cancel" id="f-cancel">Cancel</button>
        <button class="btn-save"   id="f-save">Save</button>
      </div>
    </div>`;
}

// ── ATTACH ABILITY FORM LISTENERS ─────────────────────────────
function attachFormListeners(ability, key) {
  const category = key.split('_')[0];

  document.getElementById('f-cancel').addEventListener('click', () => closeOverlay('overlay'));

  document.getElementById('f-save').addEventListener('click', () => {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { document.getElementById('f-name').focus(); return; }

    const badgeEl = document.getElementById('f-badge');
    const entry = {
      id:    ability ? ability.id : 'ab_' + Date.now(),
      name,
      badge: badgeEl ? badgeEl.value : 'reaction',
      desc:  document.getElementById('f-desc').value.trim(),
    };

    if (category === 'attack') {
      entry.toHit  = document.getElementById('f-toHit').value.trim();
      entry.damage = document.getElementById('f-damage').value.trim();
      entry.range  = document.getElementById('f-range').value.trim();
    } else if (category === 'magic') {
      entry.spellLevel   = document.getElementById('f-spellLevel').value.trim();
      entry.range        = document.getElementById('f-range').value.trim();
      entry.saveOrAttack = document.getElementById('f-saveOrAttack').value.trim();
      entry.damage       = document.getElementById('f-damage').value.trim();
    } else {
      entry.stat = document.getElementById('f-stat').value.trim();
    }

    const c = currentChar();
    if (!c.abilities[key]) c.abilities[key] = [];

    if (ability) {
      const idx = c.abilities[key].findIndex(a => a.id === ability.id);
      if (idx !== -1) c.abilities[key][idx] = entry;
    } else {
      c.abilities[key].push(entry);
    }

    save();
    renderAllSimpleTabs();
    closeOverlay('overlay');
  });

  const delBtn = document.getElementById('f-delete');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const c = currentChar();
      c.abilities[key] = c.abilities[key].filter(a => a.id !== ability.id);
      save();
      renderAllSimpleTabs();
      closeOverlay('overlay');
    });
  }
}

// ── OVERLAY HELPERS ───────────────────────────────────────────
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay(overlay.id);
  });
});

document.getElementById('sheetClose').addEventListener('click', () => closeOverlay('overlay'));

// ── ADD BUTTONS (simple tabs) ─────────────────────────────────
document.querySelectorAll('.add-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => openAddSheet(btn.dataset.tab, btn.dataset.tab));
});

// ── STAT EDIT ─────────────────────────────────────────────────
function openStatSheet() {
  const c = currentChar();
  if (!c) return;
  document.getElementById('statBody').innerHTML = `
    <div class="edit-form">
      <div class="form-row">
        <label class="form-label"><i class="ti ti-user"></i> Character Name</label>
        <input class="form-input" id="s-name" value="${c.name}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">
        <div class="form-row">
          <label class="form-label"><i class="ti ti-crown"></i> Level</label>
          <input class="form-input" id="s-level" type="number" min="1" max="20" value="${c.level || ''}">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-wand"></i> Class</label>
          <input class="form-input" id="s-cls" value="${c.cls || ''}">
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
          <input class="stat-edit-input" id="s-speed" value="${c.speed || '30ft'}">
        </div>
        <div class="form-row">
          <label class="form-label"><i class="ti ti-star"></i> Prof. Bonus</label>
          <input class="stat-edit-input" id="s-prof" value="${c.prof || '+2'}">
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
      <div class="form-actions" style="margin-top:4px;">
        <button class="btn-cancel" id="s-cancel">Cancel</button>
        <button class="btn-save"   id="s-save">Save</button>
      </div>
    </div>`;

  document.getElementById('s-cancel').addEventListener('click', () => closeOverlay('statOverlay'));
  document.getElementById('s-save').addEventListener('click', () => {
    c.name    = document.getElementById('s-name').value.trim()  || c.name;
    c.level   = document.getElementById('s-level').value.trim();
    c.cls     = document.getElementById('s-cls').value.trim();
    const subParts = [
      c.level ? `Lvl ${c.level}` : null,
      c.species || null,
      c.cls || null,
    ].filter(Boolean);
    if (subParts.length) c.sub = subParts.join(' · ');
    c.hp    = parseInt(document.getElementById('s-hp').value)  || c.hp;
    c.ac    = parseInt(document.getElementById('s-ac').value)  || c.ac;
    c.speed = document.getElementById('s-speed').value.trim() || c.speed;
    c.prof  = document.getElementById('s-prof').value.trim()  || c.prof;
    c.str   = parseInt(document.getElementById('s-str').value) || c.str || 10;
    c.dex   = parseInt(document.getElementById('s-dex').value) || c.dex || 10;
    c.con   = parseInt(document.getElementById('s-con').value) || c.con || 10;
    c.int   = parseInt(document.getElementById('s-int').value) || c.int || 10;
    c.wis   = parseInt(document.getElementById('s-wis').value) || c.wis || 10;
    c.cha   = parseInt(document.getElementById('s-cha').value) || c.cha || 10;
    save();
    renderHeader();
    closeOverlay('statOverlay');
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
          <input type="file" id="heroAvatarInput" accept="image/*" style="display:none;">
        </div>
        <div class="hero-ident">
          <div class="hero-name">${c.name}</div>
          ${sub ? `<div class="hero-sub">${sub}</div>` : ''}
        </div>
      </div>
      <div class="hero-pills">
        <div class="hero-pill"><i class="ti ti-heart c-red"></i><span>${c.hp || '—'}</span><div class="hero-pill-lbl">Max HP</div></div>
        <div class="hero-pill"><i class="ti ti-shield ac-i"></i><span>${c.ac || '—'}</span><div class="hero-pill-lbl">AC</div></div>
        <div class="hero-pill"><i class="ti ti-shoe speed-i"></i><span>${c.speed || '30ft'}</span><div class="hero-pill-lbl">Speed</div></div>
        <div class="hero-pill"><i class="ti ti-star prof-i"></i><span>${c.prof || '+2'}</span><div class="hero-pill-lbl">Prof</div></div>
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
    };
    reader.readAsDataURL(file);
  });

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

// ── CHARACTER SWITCHER ────────────────────────────────────────
function renderCharSwitcher() {
  const body = document.getElementById('charBody');

  body.innerHTML = characters.map(c => `
    <div class="char-list-item" data-id="${c.id}">
      <div class="char-list-avatar">${c.avatar
        ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<i class="ti ti-user"></i>`}</div>
      <div class="char-list-info">
        <div class="char-list-name">${c.name}</div>
        <div class="char-list-sub">${c.sub || ''}</div>
      </div>
      <div class="char-list-actions">
        ${c.id === currentCharId ? '<div class="char-list-check"><i class="ti ti-check"></i></div>' : ''}
        <button class="char-delete-btn" data-id="${c.id}" aria-label="Delete ${c.name}">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>`).join('');

  body.innerHTML += `<button class="new-char-btn" id="newCharBtn"><i class="ti ti-plus"></i> New Character</button>`;

  // Select character
  body.querySelectorAll('.char-list-item').forEach(item => {
    item.addEventListener('click', e => {
      // Don't trigger if delete button was clicked
      if (e.target.closest('.char-delete-btn')) return;
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
        showWelcome();
      } else {
        renderHeader();
        renderAllSimpleTabs();
        renderCharSwitcher(); // refresh the list in place
      }
    });
  });

  document.getElementById('newCharBtn').addEventListener('click', () => {
    closeOverlay('charOverlay');
    openNewCharSheet(false);
  });
}

document.getElementById('heroClose').addEventListener('click', () => closeOverlay('heroOverlay'));
document.getElementById('charClose').addEventListener('click', () => closeOverlay('charOverlay'));
document.getElementById('header').addEventListener('click', openHeroSummary);

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
