// display name is label:
// chance is weight: 1 ==> 1%
const RARITIES = {
  common:       { label: "Common",       weight: 31 },
  uncommon:     { label: "Uncommon",     weight: 22 },
  rare:         { label: "Rare",         weight: 16 },
  epic:         { label: "Epic",         weight: 11 },
  legendary:    { label: "Legendary",    weight: 8 },
  mythic:       { label: "Mythic",       weight: 5 },
  divine:       { label: "Divine",       weight: 3 },
  celestial:    { label: "Celestial",    weight: 2 },
  transcendent: { label: "Transcendent", weight: 1.5 },
  supreme:      { label: "Supreme",      weight: 0.5 }
};

for (const tier of Object.values(RARITIES)) Object.freeze(tier);
Object.freeze(RARITIES);

// Power tiers for stats
const POWER_TIERS = [
  { id: "academy",   name: "Academy",   rarity: "common" },
  { id: "genin",     name: "Genin",     rarity: "uncommon" },
  { id: "chunin",    name: "Chunin",    rarity: "rare" },
  { id: "low-jonin", name: "Low-Jonin", rarity: "epic" },
  { id: "jonin",     name: "Jonin",     rarity: "legendary" },
  { id: "low-kage",  name: "Low-Kage",  rarity: "mythic" },
  { id: "kage",      name: "Kage",      rarity: "divine" },
  { id: "legend",    name: "Legend",    rarity: "celestial" },
  { id: "demi-god",  name: "Demi-God",  rarity: "transcendent" },
  { id: "god",       name: "God",       rarity: "supreme" }
];

// Each category shown as a reel when spinning
const GAME_DATA = [
  { id: "strength",   label: "Strength",   kind: "stat", entries: POWER_TIERS },
  { id: "speed",      label: "Speed",      kind: "stat", entries: POWER_TIERS },
  { id: "durability", label: "Durability", kind: "stat", entries: POWER_TIERS },
  { id: "iq",         label: "IQ",         kind: "stat", entries: POWER_TIERS }
];