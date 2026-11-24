//this is spin.js
import { RARITIES } from "../data/data.js";

import {
  pickRandom,
  rollRarity,
  rollCategory,
  rollChance,
  entriesForRarity,
  entriesAtOrAbove
} from "./rolls.js";

import {
  loadTurnState,
  saveTurnState,
  loadLastResults,
  saveLastResult,
  resultKey
} from "./storage.js";

const UNRANKED_TEXT = "Unranked";

const SPIN_MIN_MS = 2200;
const SPIN_MAX_MS = 2800;

const FAST_DELAY = 35;
const SLOW_DELAY = 800;
const SLOWDOWN_START = 0.15;
const SLOW_CURVE = 3.5;

const TEASE_START = 0.6;
const TEASE_CHANCE = 0.2;

const TEASE_LATE_START = 0.88;
const TEASE_LATE_CHANCE = 0.5;
const TEASE_MIN_RARITY = "rare";

const HESITATION_START = 0.7;
const HESITATION_CHANCE = 0.25;
const HESITATION_MAX_COUNT = 3;
const HESITATION_MIN_MS = 300;
const HESITATION_MAX_MS = 700;

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function tickDelay(progress) {
  if (progress <= SLOWDOWN_START) return FAST_DELAY;

  const t = (progress - SLOWDOWN_START) / (1 - SLOWDOWN_START);
  return lerp(FAST_DELAY, SLOW_DELAY, Math.pow(t, SLOW_CURVE));
}

function jitter(delay, progress) {
  const amount = progress < SLOWDOWN_START ? 0.3 : 0.1;
  const factor = 1 - amount + Math.random() * amount * 2;
  return delay * factor;
}

function showEntry(element, text, rarity) {
  element.textContent = text;
  const details = rarity ? RARITIES[rarity] : undefined;
  element.className = details ? `value ${details.label}` : "value";
}

// Convert a rolled result into the shape saved in storage.
function toSavedResult(result) {
  const hasResult = Boolean(result?.rarity);
  return {
    name: hasResult ? result.name : "Nothing",
    rarity: hasResult ? result.rarity : null,
    savedAt: new Date().toISOString()
  };
}

// Pick a flicker, with more rare-or-better names as the reveal approaches.
// Flickers are cosmetic: they never change the committed result.
function randomFlash(reel, teaseEntries, progress, fromIndex) {
  if (isStatReel(reel)) {
    return statFlash(reel, progress, fromIndex);
  }

  let teaseChance = 0;
  if (progress >= TEASE_LATE_START) {
    teaseChance = TEASE_LATE_CHANCE;
  } else if (progress >= TEASE_START) {
    teaseChance = TEASE_CHANCE;
  }

  if (teaseChance > 0 && teaseEntries.length > 0 && Math.random() < teaseChance) {
    const entry = pickRandom(teaseEntries);
    return { text: entry.name, rarity: entry.rarity };
  }

  const rarity = rollRarity();
  const entries = entriesForRarity(reel.category, rarity);

  if (entries.length === 0) {
    return { text: "Nothing", rarity: null };
  }

  const entry = pickRandom(entries);
  return { text: entry.name, rarity: entry.rarity };
}


// Show the final result for a reel. The result was already saved when the spin started.
function revealResult(reel, saved) {
  showEntry(reel.valueEl, saved.name, saved.rarity);

  spinsInProgress--;
  reel.card.classList.remove("spinning");
  renderTurn();
}

// Spin one reel and reveal its preselected result when the animation ends.
function spinReel(reel) {
  // Only one spin per category per turn, and none once the top rank is reached.
  if (hasSpun(reel) || isMaxedStat(reel)) return;

  const fromIndex = isStatReel(reel) ? currentStatIndex(reel) : -1;
  // Select the outcome before anything visible happens, then commit it immediately.
  const saved = isStatReel(reel)
    ? rollStatResult(reel)
    : toSavedResult(rollCategory(reel.category));
  saveLastResult(resultKey(reel.universeId, reel.category.id), saved);
  markSpun(reel);

  reel.button.disabled = true;
  reel.card.classList.add("spinning");
  spinsInProgress++;
  renderTurn();

  const duration = lerp(SPIN_MIN_MS, SPIN_MAX_MS, Math.random());
  const teaseEntries = isStatReel(reel)
    ? []
    : entriesAtOrAbove(reel.category, TEASE_MIN_RARITY);
  const start = performance.now();
  let hesitationCount = 0;

  function tick() {
    const elapsed = performance.now() - start;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      revealResult(reel, saved);
      return;
    }

    const flash = randomFlash(reel, teaseEntries, progress, fromIndex);
    showEntry(reel.valueEl, flash.text, flash.rarity);

    let delay = jitter(tickDelay(progress), progress);

    if (
      progress >= HESITATION_START &&
      hesitationCount < HESITATION_MAX_COUNT &&
      Math.random() < HESITATION_CHANCE
    ) {
      hesitationCount++;
      delay += lerp(HESITATION_MIN_MS, HESITATION_MAX_MS, Math.random());
    }

    setTimeout(tick, Math.max(Math.min(delay, duration - elapsed), 0));
  }

  tick();
}


// Find the page elements.
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

function populateInfoDialog(category) {
  dialogTitle.textContent = `${category.label} results`;
  resultsList.replaceChildren();

  if (kindForCategory(category) === "stat") {
    dialogTitle.textContent = `${category.label} chances`;

    category.entries.forEach(entry => {
      const item = document.createElement("li");
      item.className = "possible-result";

      const heading = document.createElement("strong");
      heading.className = RARITIES[entry.rarity]?.label ?? "";
      heading.textContent = `${entry.name} - ${entry.chance}%`;

      item.append(heading);
      resultsList.append(item);
    });
  } else {
    // Show "Nothing" first, using the weights of rarities this category lacks.
    const nothingChance = Object.entries(RARITIES)
      .filter(([rarity]) => entriesForRarity(category, rarity).length === 0)
      .reduce((total, [, details]) => total + details.weight, 0);

    if (nothingChance > 0) {
      const item = document.createElement("li");
      item.textContent = `Nothing - ${nothingChance}%`;
      item.className = "possible-result nothing-result";
      resultsList.append(item);
    }

    // Show each available rarity's total chance, then its possible results.
    Object.entries(RARITIES).forEach(([rarityKey, rarity]) => {
      const entries = entriesForRarity(category, rarityKey);
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
  }

  infoDialog.showModal();
  requestAnimationFrame(() => {
    dialogTitle.focus({ preventScroll: true });
    infoDialog.scrollTop = 0;
    dialogContent.scrollTop = 0;
    resultsList.scrollTop = 0;
  });
}

// The reels currently shown on the page.
let reels = [];

// The id of the universe whose reels are currently shown.
let currentUniverseId = null;

// Build one card for a category, showing its last saved result if there is one.
function buildReelCard(category, savedResults) {
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
  infoButton.addEventListener("click", () => populateInfoDialog(category));

  header.append(title, infoButton);

  // Show this category's last saved result, or a placeholder if there is none.
  const valueEl = document.createElement("div");
  valueEl.className = "value";

  const saved = savedResults[resultKey(currentUniverseId, category.id)];
  if (saved) {
    showEntry(valueEl, saved.name, saved.rarity);
  } else {
    valueEl.textContent = kindForCategory(category) === "stat" ? UNRANKED_TEXT : "--";
  }

  // Add a button that starts a spin for this category.
  const button = document.createElement("button");
  button.type = "button";
  button.className = "spin-button";
  button.textContent = "SPIN";
  button.setAttribute("aria-label", `Spin ${category.label}`);

  const hintEl = document.createElement("div");
  hintEl.className = "next-rank-hint";

  card.append(header, valueEl, hintEl, button);

  return { category, card, valueEl, hintEl, button, universeId: currentUniverseId };
}

// Return the kind of a category, or "other" if it has none.
function kindForCategory(category) {
  return typeof category.kind === "string" && category.kind.trim()
    ? category.kind.trim()
    : "other";
}

// Whether a reel uses the stat mechanic (a chance to move up one rank).
function isStatReel(reel) {
  return kindForCategory(reel.category) === "stat";
}

// Index of the reel's current rank in its ladder. -1 means no rank yet.
function currentStatIndex(reel) {
  const saved = loadLastResults()[resultKey(reel.universeId, reel.category.id)];
  if (!saved?.entryId) return -1;
  return reel.category.entries.findIndex(entry => entry.id === saved.entryId);
}

// One roll to reach the next rank. The chance belongs to the rank being reached.
function rollStatResult(reel) {
  const ladder = reel.category.entries;
  const index = currentStatIndex(reel);
  const next = ladder[index + 1];
  const evolved = Boolean(next) && rollChance(next.chance);
  const target = evolved ? next : ladder[index];

  return {
    name: target?.name ?? UNRANKED_TEXT,
    entryId: target?.id ?? null,
    rarity: target?.rarity ?? null,
    evolved,
    savedAt: new Date().toISOString()
  };
}

// True when a stat reel is on the last rank, so no evolution is possible.
function isMaxedStat(reel) {
  if (!isStatReel(reel)) return false;
  return currentStatIndex(reel) >= reel.category.entries.length - 1;
}

// Flicker between the rank held before the spin and the next rank.
function statFlash(reel, progress, fromIndex) {
  const ladder = reel.category.entries;
  const current = ladder[fromIndex];
  const next = ladder[fromIndex + 1];

  const showNext = Boolean(next) && Math.random() < 0.3 + 0.4 * progress;
  if (showNext) return { text: next.name, rarity: next.rarity };
  if (current) return { text: current.name, rarity: current.rarity };
  return { text: UNRANKED_TEXT, rarity: null };
}

// Show the next rank and its chance under a stat reel's current rank.
// While spinning, keep the existing text so the saved outcome isn't revealed early.
function updateStatHint(reel) {
  if (!isStatReel(reel)) {
    reel.hintEl.textContent = "";
    return;
  }
  if (reel.card.classList.contains("spinning")) return;

  const next = reel.category.entries[currentStatIndex(reel) + 1];
  reel.hintEl.textContent = next
    ? `Next: ${next.name} (${next.chance}%)`
    : "Max rank";
}

// Build the category-kind tabs and show the first kind.
function buildTabs(reelList) {
  const kinds = [...new Set(reelList.map(reel => kindForCategory(reel.category)))];

  categoryTabs.setAttribute("role", "tablist");
  categoryTabs.setAttribute("aria-label", "Category kinds");
  categoryTabs.replaceChildren();

  function selectKind(selectedKind) {
    reelList.forEach(reel => {
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
}

// Remove the old reels and create one card per category in the given list.
function buildReels(categories) {
  reelsContainer.replaceChildren();

  const savedResults = loadLastResults();

  reels = categories.map(category => {
    const reel = buildReelCard(category, savedResults);
    reelsContainer.append(reel.card);
    return reel;
  });

  buildTabs(reels);

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

const nextTurnButton = document.createElement("button");
nextTurnButton.type = "button";
nextTurnButton.className = "next-turn-button";
nextTurnButton.textContent = "Next turn";

turnBar.append(turnLabel, nextTurnButton);

function renderTurn() {
  turnLabel.textContent = `Turn ${turnState.turn}`;

  reels.forEach(reel => {
    reel.button.disabled =
      hasSpun(reel) ||
      reel.card.classList.contains("spinning") ||
      isMaxedStat(reel);
    updateStatHint(reel);
  });
  nextTurnButton.disabled = spinsInProgress > 0;
}

function nextTurn() {
  if (spinsInProgress > 0) return;

  const remaining = reels.filter(reel => !hasSpun(reel) && !isMaxedStat(reel));

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
