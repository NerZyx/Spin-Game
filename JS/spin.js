// Total spin duration range (unchanged).
const SPIN_MIN_MS = 2200;
const SPIN_MAX_MS = 2800;

// Tick interval range: a shorter opening and a longer, heavier drag.
const FAST_DELAY = 35;
const SLOW_DELAY = 800;
const SLOWDOWN_START = 0.15;
const SLOW_CURVE = 3.5;

// Mid-spin teasing: occasional rare-or-better flickers.
const TEASE_START = 0.6;
const TEASE_CHANCE = 0.2;

// Late teasing: frequent rare-or-better flickers just before the reveal.
const TEASE_LATE_START = 0.88;
const TEASE_LATE_CHANCE = 0.5;
const TEASE_MIN_RARITY = "rare";

// Hesitations: longer, more frequent freezes near the end.
const HESITATION_START = 0.7;
const HESITATION_CHANCE = 0.25;
const HESITATION_MAX_COUNT = 3;
const HESITATION_MIN_MS = 300;
const HESITATION_MAX_MS = 700;



// Rarity keys in their defined order (common to supreme).
const RARITY_KEYS = Object.keys(RARITIES);

// Check whether the user has requested reduced motion in their system settings.
const REDUCE_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// Linearly blend between two values.
function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

// Stay fast for the opening, then ease into a long, gradual slowdown.
function tickDelay(progress) {
  if (progress <= SLOWDOWN_START) return FAST_DELAY;

  const t = (progress - SLOWDOWN_START) / (1 - SLOWDOWN_START);
  return lerp(FAST_DELAY, SLOW_DELAY, Math.pow(t, SLOW_CURVE));
}

// Add random variation to each tick. The fast phase is livelier, while the
// slow phase is steadier so each tick feels deliberate.
function jitter(delay, progress) {
  const amount = progress < SLOWDOWN_START ? 0.3 : 0.1;
  const factor = 1 - amount + Math.random() * amount * 2;
  return delay * factor;
}

// Return the display name of a rolled result.
function formatResult(result) {
  return result.name;
}

// Update a reel's displayed text and apply the CSS class for its rarity.
function showEntry(element, text, rarity) {
  element.textContent = text;
  element.className = `value ${RARITIES[rarity].label}`;
}

// Pick a flicker, with more rare-or-better names as the reveal approaches.
function randomFlash(category, progress) {
  let teaseChance = 0;
  if (progress >= TEASE_LATE_START) {
    teaseChance = TEASE_LATE_CHANCE;
  } else if (progress >= TEASE_START) {
    teaseChance = TEASE_CHANCE;
  }

  if (teaseChance > 0 && Math.random() < teaseChance) {
    const startIndex = RARITY_KEYS.indexOf(TEASE_MIN_RARITY);
    const teaseKeys = RARITY_KEYS.slice(startIndex);
    const teaseEntries = category.entries.filter(entry =>
      teaseKeys.includes(entry.rarity)
    );

    if (teaseEntries.length > 0) {
      const entry = pickRandom(teaseEntries);
      return { text: entry.name, rarity: entry.rarity };
    }
  }

  const rarity = weightedPick(
    RARITY_KEYS,
    key => RARITIES[key].weight
  );

  const entries = category.entries.filter(entry => entry.rarity === rarity);

  // This rarity has no entry in the category, so show nothing for this flicker.
  if (entries.length === 0) {
    return { text: "Nothing", rarity: null };
  }

  const entry = pickRandom(entries);
  return {
    text: entry.name,
    rarity: entry.rarity
  };
}

// Display the final result, stop the animation, and re-enable the button.
function revealResult(reel, result) {
  if (result === null) {
    reel.valueEl.textContent = "Nothing";
    reel.valueEl.className = "value";
  } else {
    showEntry(reel.valueEl, formatResult(result), result.rarity);
  }

  reel.card.classList.remove("spinning");
  reel.button.disabled = false;
}

// Spin one reel and reveal its preselected result when the animation ends.
function spinReel(reel) {
  // Prevent another spin on this reel until the current one finishes.
  reel.button.disabled = true;
  reel.card.classList.add("spinning");

  // Select the outcome before the visual flickering begins.
  const result = rollCategory(reel.category);

  // Skip the animation when reduced motion is enabled.
  if (REDUCE_MOTION) {
    revealResult(reel, result);
    return;
  }

  // Pick a random length for this spin.
  const duration = lerp(SPIN_MIN_MS, SPIN_MAX_MS, Math.random());
  const start = performance.now();
  let hesitationCount = 0;

  // Update the temporary display until the spin duration has elapsed.
  function tick() {
    const elapsed = performance.now() - start;
    const progress = Math.min(elapsed / duration, 1);

    // Reveal the fixed result when the spin ends.
    if (progress >= 1) {
      revealResult(reel, result);
      return;
    }

    // Show a random entry as a visual effect; it does not change the result.
    const flash = randomFlash(reel.category, progress);

    if (flash.rarity === null) {
      reel.valueEl.textContent = flash.text;
      reel.valueEl.className = "value";
    } else {
      showEntry(reel.valueEl, flash.text, flash.rarity);
    }

    let delay = jitter(tickDelay(progress), progress);

    // Occasionally hold the current flicker for a moment near the end.
    if (
      progress >= HESITATION_START &&
      hesitationCount < HESITATION_MAX_COUNT &&
      Math.random() < HESITATION_CHANCE
    ) {
      hesitationCount++;
      delay += lerp(HESITATION_MIN_MS, HESITATION_MAX_MS, Math.random());
    }

    // Never overshoot the end of the spin, even after a hesitation.
    setTimeout(tick, Math.max(Math.min(delay, duration - elapsed), 0));
  }

  // Start the animation immediately.
  tick();
}

// Find the page element that will contain all reel cards.
const reelsContainer = document.getElementById("reels");

// Create one reusable dialog for showing a category's possible results.
const infoDialog = document.createElement("dialog");
infoDialog.className = "info-dialog";
infoDialog.addEventListener("click", event => {
  if (event.target === infoDialog) infoDialog.close();
});


const dialogContent = document.createElement("div");
dialogContent.className = "info-dialog-content";

const dialogTitle = document.createElement("h2");
dialogTitle.tabIndex = -1;
const resultsList = document.createElement("ul");
resultsList.className = "possible-results";

const closeButton = document.createElement("button");
closeButton.type = "button";
closeButton.className = "info-close";
closeButton.textContent = "Close";
closeButton.addEventListener("click", () => infoDialog.close());

dialogContent.append(dialogTitle, resultsList, closeButton);
infoDialog.append(dialogContent);
document.body.append(infoDialog);

// Create one card and button for each category in the game data.
const reels = GAME_DATA.map(category => {
  const card = document.createElement("div");
  card.className = "reel";

  // Put the category title and info button in a shared header row.
  const header = document.createElement("div");
  header.className = "reel-header";

  const title = document.createElement("h2");
  title.textContent = category.label;

  const infoButton = document.createElement("button");
  infoButton.type = "button";
  infoButton.className = "info-button";
  infoButton.textContent = "i";
  infoButton.setAttribute("aria-label", `Show possible ${category.label} results`);

  infoButton.addEventListener("click", () => {
    dialogTitle.textContent = `${category.label} results`;
    resultsList.replaceChildren();

    // Add "Nothing" first if this category is missing any rarities.
    const availableRarities = new Set(
      category.entries.map(entry => entry.rarity)
    );

    const nothingChance = Object.entries(RARITIES)
      .filter(([rarity]) => !availableRarities.has(rarity))
      .reduce((total, [, details]) => total + details.weight, 0);

    if (nothingChance > 0) {
      const item = document.createElement("li");
      item.textContent = `Nothing — ${nothingChance}%`;
      item.className = "possible-result nothing-result";
      resultsList.append(item);
    }

    // Show each available rarity's total chance, then its possible results.
    Object.entries(RARITIES).forEach(([rarityKey, rarity]) => {
      const entries = category.entries.filter(
        entry => entry.rarity === rarityKey
      );

      if (entries.length === 0) return;

      const item = document.createElement("li");
      item.className = `possible-result ${rarity.label}`;

      const heading = document.createElement("strong");
      heading.textContent = `${rarity.label} — ${rarity.weight}%`;

      const names = document.createElement("div");
      names.className = "possible-result-names";
      names.textContent = entries.map(entry => entry.name).join(", ");

      item.append(heading, names);
      resultsList.append(item);
    });

    infoDialog.showModal();

    requestAnimationFrame(() => {
      dialogTitle.focus({ preventScroll: true });
      infoDialog.scrollTop = 0;
      dialogContent.scrollTop = 0;
      resultsList.scrollTop = 0;
    })
  });

  header.append(title, infoButton);

  // Add the element that will show the current or final result.
  const valueEl = document.createElement("div");
  valueEl.className = "value";
  valueEl.textContent = "--";

  // Add a button that starts a spin for this category.
  const button = document.createElement("button");
  button.type = "button";
  button.className = "spin-button";
  button.textContent = "SPIN";
  button.setAttribute("aria-label", `Spin ${category.label}`);

  // Place the heading, value, and button inside the card, then add it to the page.
  card.append(header, valueEl, button);
  reelsContainer.append(card);

  // Keep references to the elements and category for the spin handler.
  return { category, card, valueEl, button };
});

// Connect each button to the spin function for its own reel.
reels.forEach(reel => {
  reel.button.addEventListener("click", () => spinReel(reel));
});
