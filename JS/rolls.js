// Return one randomly selected item from an array.
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Select an item at random, giving items with higher weights a greater chance.
function weightedPick(items, getWeight) {
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
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Roll a rarity, entry, and (for stats) numeric value for one category.
// Returns a "Nothing" result when the category has no entry for the rolled rarity.
function rollCategory(category) {
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
    cssClass: rarity, // The rarity key doubles as the CSS class name.
    value: null       // Fill in later with randInt() for numeric stats.
  };
}

// Roll each game category and return the results keyed by category ID.
function rollCharacter() {
  return Object.fromEntries(
    GAME_DATA.map(category => [category.id, rollCategory(category)])
  );
}