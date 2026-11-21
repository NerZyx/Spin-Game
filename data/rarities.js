// chance is weight: 1 ==> 1%
export const RARITIES = {
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
