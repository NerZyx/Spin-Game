import { RARITIES } from "../data/rarities.js";

// Return one randomly selected item from an array.
export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Select an item at random, giving items with higher weights a greater chance.
export function weightedPick(items, getWeight) {
  const total = items.reduce((sum, item) => sum + getWeight(item), 0);

  if (total <= 0) {
    throw new Error("No item has a positive weight.");
  }

  let roll = Math.random() * total;

  for (const item of items) {
    roll -= getWeight(item);
    if (roll < 0) return item;
  }

  return items[items.length - 1]; // Guards against floating-point rounding.
}

// Return a random whole number between min and max, including both endpoints.
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Roll a rarity and entry for one category.
// Returns a "Nothing" result when the category has no entry for the rolled rarity.
export function rollCategory(category) {
  const rarity = weightedPick(
    Object.keys(RARITIES),
    key => RARITIES[key].weight
  );

  const matchingEntries = category.entries.filter(
    entry => entry.rarity === rarity
  );

  if (matchingEntries.length === 0) {
    return {
      categoryId: category.id,
      label: category.label,
      name: "Nothing",
      rarity: null,
      cssClass: null,
      value: null
    };
  }

  const entry = pickRandom(matchingEntries);

  return {
    categoryId: category.id,
    label: category.label,
    name: entry.name,
    rarity,
    cssClass: rarity,
    value: null
  };
}

// Roll each category in the given list and return the results keyed by category ID.
export function rollCharacter(categories) {
  return Object.fromEntries(
    categories.map(category => [category.id, rollCategory(category)])
  );
}

// Group a category's entries by rarity once, instead of filtering on every tick.
export function groupByRarity(entries) {
  const groups = {};
  for (const entry of entries) {
    (groups[entry.rarity] ??= []).push(entry);
  }
  return groups;
}
