import { RARITIES } from "../data/data.js";
import { pickRandom, weightedPick, rollCategory } from "./rolls.js";
import {
  loadTurnState,
  saveTurnState,
  loadLastResults,
  saveLastResult,
  resultKey
} from "./storage.js";

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
  const details = rarity ? RARITIES[rarity] : undefined;
  element.className = details ? `value ${details.label}` : "value";
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

// Display the final result, save it, mark the spin as used, and refresh the turn display.
function revealResult(reel, result) {
  const hasResult = result !== null && Boolean(result.rarity);

  if (hasResult) {
    showEntry(reel.valueEl, formatResult(result), result.rarity);
  } else {
    reel.valueEl.textContent = "Nothing";
    reel.valueEl.className = "value";
  }

  saveLastResult(resultKey(reel.universeId, reel.category.id), {
    name: hasResult ? result.name : "Nothing",
    rarity: hasResult ? result.rarity : null,
    savedAt: new Date().toISOString()
  });

  spinsInProgress--;
  markSpun(reel);

  reel.card.classList.remove("spinning");
  renderTurn();
}

// Spin one reel and reveal its preselected result when the animation ends.
function spinReel(reel) {
  // Only one spin per category per turn.
  if (hasSpun(reel)) return;

  reel.button.disabled = true;
  reel.card.classList.add("spinning");
  spinsInProgress++;
  renderTurn();

  // Select the outcome before the visual flickering begins.
  const result = rollCategory(reel.category);

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
const categoryTabs = document.getElementById("category-tabs");

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

// The reels currently shown on the page.
let reels = [];

// The id of the universe whose reels are currently shown.
let currentUniverseId = null;


// Remove the old reels and create one card per category in the given list.
function buildReels(categories) {
  reelsContainer.replaceChildren();

  reels = categories.map(category => {
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
        item.textContent = `Nothing - ${nothingChance}%`;
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
        item.className = "possible-result";

        const heading = document.createElement("strong");
        heading.className = rarity.label;
        heading.textContent = `${rarity.label} - ${rarity.weight}%`;

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
      });
    });

    header.append(title, infoButton);

    // Show this category's last saved result, or a placeholder if there is none.
    const valueEl = document.createElement("div");
    valueEl.className = "value";

    const saved = loadLastResults()[resultKey(currentUniverseId, category.id)];

    if (saved) {
      showEntry(valueEl, saved.name, saved.rarity);
    } else {
      valueEl.textContent = "--";
    }

    // Add a button that starts a spin for this category.
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spin-button";
    button.textContent = "SPIN";
    button.setAttribute("aria-label", `Spin ${category.label}`);

   
    card.append(header, valueEl, button);
    reelsContainer.append(card);

   
        return { category, card, valueEl, button, universeId: currentUniverseId };
  });

  const kindForCategory = category =>
  typeof category.kind === "string" && category.kind.trim()
    ? category.kind.trim()
    : "other";

const kinds = [...new Set(reels.map(reel => kindForCategory(reel.category)))];

categoryTabs.setAttribute("role", "tablist");
categoryTabs.setAttribute("aria-label", "Category kinds");
categoryTabs.replaceChildren();

function selectKind(selectedKind) {
  reels.forEach(reel => {
    reel.card.style.display =
      kindForCategory(reel.category) === selectedKind ? "" : "none";
  });

  for (const tab of categoryTabs.children) {
    const selected = tab.dataset.kind === selectedKind;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

for (const kind of kinds) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
  tab.dataset.kind = kind;
  tab.setAttribute("role", "tab");
  tab.addEventListener("click", () => selectKind(kind));
  categoryTabs.append(tab);
}

if (kinds.length > 0) selectKind(kinds[0]);


  reels.forEach(reel => {
    reel.button.addEventListener("click", () => spinReel(reel));
  });
}

let turnState = loadTurnState();

let spinsInProgress = 0;

function hasSpun(reel) {
  return turnState.spent.includes(resultKey(reel.universeId, reel.category.id));
}

function markSpun(reel) {
  const key = resultKey(reel.universeId, reel.category.id);
  if (!turnState.spent.includes(key)) turnState.spent.push(key);
  saveTurnState(turnState);
}

const turnBar = document.getElementById("turn-bar");

const turnLabel = document.createElement("strong");

const turnWarning = document.createElement("p");
turnWarning.className = "turn-warning";
turnWarning.setAttribute("role", "status");

const nextTurnButton = document.createElement("button");
nextTurnButton.type = "button";
nextTurnButton.className = "next-turn-button";
nextTurnButton.textContent = "Next turn";

turnBar.append(turnLabel, turnWarning, nextTurnButton);

function renderTurn() {
  turnLabel.textContent = `Turn ${turnState.turn}`;

  const remaining = reels.filter(reel => !hasSpun(reel));

  if (remaining.length === 0) {
    turnWarning.textContent = "All categories have been spun this turn.";
    turnWarning.classList.remove("warning");
  } else {
    const names = remaining.map(reel => reel.category.label).join(", ");
    turnWarning.textContent = `Still to spin: ${names}.`;
    turnWarning.classList.add("warning");
  }

  reels.forEach(reel => {
    reel.button.disabled =
      hasSpun(reel) || reel.card.classList.contains("spinning");
  });
  nextTurnButton.disabled = spinsInProgress > 0;
}

function nextTurn() {
  if (spinsInProgress > 0) return;

  const remaining = reels.filter(reel => !hasSpun(reel));

  if (remaining.length > 0) {
    const names = remaining.map(reel => reel.category.label).join(", ");
    const proceed = window.confirm(
      `These categories haven't been spun this turn: ${names}.\n\nPass the turn anyway?`
    );
    if (!proceed) return;
  }

  turnState = { turn: turnState.turn + 1, spent: [] };
  saveTurnState(turnState);
  renderTurn();
}

nextTurnButton.addEventListener("click", nextTurn);

const gameStart = window.GAME_START;

if (!gameStart?.universeData?.GAME_DATA) {
  throw new Error("No starting-menu selection was provided to spin.js.");
}

currentUniverseId = gameStart.universeId;

const playerInfo = document.getElementById("player-info");
if (playerInfo) {
  playerInfo.textContent =
    `${gameStart.playerName} — ${gameStart.clanName} (${gameStart.universeLabel})`;
}

// Clan is chosen in the menu, so it isn't shown as a spin reel.
const spinCategories = gameStart.universeData.GAME_DATA.filter(
  category => category.id !== "clan" && category.kind !== "clan"
);

buildReels(spinCategories);
renderTurn();

