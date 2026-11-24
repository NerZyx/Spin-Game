//this is rolls.js
import { RARITIES } from "../data/data.js";

// Rarity keys in their defined order (common to supreme).
export const RARITY_KEYS = Object.keys(RARITIES);

// Cache of rarity groups per category, so each category is grouped only once.
const groupCache = new WeakMap();

// Return one randomly selected item from a non-empty array.
export function pickRandom(list, rng = Math.random) {
  if (list.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }
  return list[Math.floor(rng() * list.length)];
}

// Select an item at random, giving items with higher weights a greater chance.
export function weightedPick(items, getWeight, rng = Math.random) {
  const weights = items.map(getWeight);

  if (weights.some(w => !Number.isFinite(w) || w < 0)) {
    throw new Error("Weights must be finite and non-negative.");
  }

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    throw new Error("No item has a positive weight.");
  }

  let roll = rng() * total;

  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }

  // Guards against floating-point rounding: return the last item with weight.
  for (let i = items.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return items[i];
  }
}

// Return a random whole number between min and max, including both endpoints.
export function randInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Group a list of entries by rarity.
export function groupByRarity(entries) {
  const groups = {};
  for (const entry of entries) {
    (groups[entry.rarity] ??= []).push(entry);
  }
  return groups;
}

// Return a category's entries grouped by rarity, computed once per category.
function getRarityGroups(category) {
  let groups = groupCache.get(category);
  if (!groups) {
    groups = groupByRarity(category.entries);
    groupCache.set(category, groups);
  }
  return groups;
}

// Return the entries in a category that have exactly this rarity.
export function entriesForRarity(category, rarity) {
  return getRarityGroups(category)[rarity] ?? [];
}

// Return the entries in a category at or above a minimum rarity.
export function entriesAtOrAbove(category, minRarity) {
  const startIndex = RARITY_KEYS.indexOf(minRarity);
  if (startIndex === -1) {
    throw new Error(`Unknown rarity: ${minRarity}`);
  }
  const allowed = new Set(RARITY_KEYS.slice(startIndex));
  return category.entries.filter(entry => allowed.has(entry.rarity));
}

// Roll a rarity using the configured weights.
export function rollRarity(rng = Math.random) {
  return weightedPick(RARITY_KEYS, key => RARITIES[key].weight, rng);
}

// Roll a rarity and entry for one category.
// Returns a "Nothing" result when the category has no entry for the rolled rarity.
export function rollCategory(category, rng = Math.random) {
  const rarity = rollRarity(rng);
  const matches = entriesForRarity(category, rarity);

  if (matches.length === 0) {
    return {
      categoryId: category.id,
      label: category.label,
      name: "Nothing",
      rarity: null,
      cssClass: null
    };
  }

  const entry = pickRandom(matches, rng);

  return {
    categoryId: category.id,
    label: category.label,
    name: entry.name,
    rarity,
    cssClass: rarity
  };
}

// Roll each category in the given list and return the results keyed by category ID.
export function rollCharacter(categories, rng = Math.random) {
  return Object.fromEntries(
    categories.map(category => [category.id, rollCategory(category, rng)])
  );
}

// Return true with the given percentage chance (0 to 100).
export function rollChance(percent, rng = Math.random) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`Chance must be between 0 and 100, got ${percent}.`);
  }
  return rng() * 100 < percent;
}

// Roll a stat category: a base rarity, then a yes/no chance to move up one tier.
export function rollStat(category, rng = Math.random) {
  const base = rollCategory(category, rng);

  if (base.name === "Nothing") {
    return base;
  }

  const { evolved, rarity } = rollEvolution(base.rarity, rng);
  return {
    ...base,
    rarity,
    cssClass: rarity,
    evolved
  };
}
