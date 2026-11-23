import { savePlayer, loadPlayer } from "./storage.js";
import {UNIVERSES} from "../data/data.js";


const main = document.querySelector("main");

if (!main) {
  throw new Error('The game page needs a <main> element.');
}

main.hidden = true;

const menu = document.createElement("section");
menu.id = "start-menu";
menu.innerHTML = `
  <form id="start-form">
    <h1>Start your game</h1>

    <label for="player-name">Name</label>
    <input
      id="player-name"
      name="playerName"
      type="text"
      maxlength="30"
      required
      autocomplete="nickname"
      placeholder="Enter your name"
    >

    <label for="universe-select">Universe</label>
    <select id="universe-select" name="universe" required></select>

    <span id="clan-label">Choose a clan</span>
    <div id="clan-options" role="group" aria-labelledby="clan-label"></div>

    <p id="start-error" role="alert" aria-live="polite"></p>
    <button id="start-button" type="submit" disabled>Start game</button>
  </form>
`;

document.body.prepend(menu);

const form = menu.querySelector("#start-form");
const nameInput = menu.querySelector("#player-name");
const universeSelect = menu.querySelector("#universe-select");
const clanOptions = menu.querySelector("#clan-options");
const startButton = menu.querySelector("#start-button");
const errorMessage = menu.querySelector("#start-error");

let selectedUniverseData = null;
let selectedClan = null;
let clanChoiceMade = false;
let loadSequence = 0;

for (const universe of UNIVERSES) {
  universeSelect.add(new Option(universe.label, universe.id));
}

function setSelectedButton(selectedButton) {
  for (const button of clanOptions.querySelectorAll(".clan-choice")) {
    button.setAttribute("aria-pressed", String(button === selectedButton));
  }
}

function makeClanButton(name, description, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "clan-choice";
  button.setAttribute("aria-pressed", "false");

  const title = document.createElement("span");
  title.className = "clan-choice-name";
  title.textContent = name;

  const details = document.createElement("span");
  details.className = "clan-choice-description";
  details.textContent = description || "No description provided.";

  button.append(title, details);
  button.addEventListener("click", () => onSelect(button));

  return button;
}

function renderClanChoices(clans, preferredClanId = null) {
  clanOptions.replaceChildren();
  selectedClan = null;
  clanChoiceMade = false;

  for (const clan of clans) {
    const button = makeClanButton(clan.name, clan.description, clickedButton => {
      selectedClan = clan;
      clanChoiceMade = true;
      setSelectedButton(clickedButton);
    });

    clanOptions.append(button);

    if (clan.id === preferredClanId) {
      selectedClan = clan;
      clanChoiceMade = true;
      setSelectedButton(button);
    }
  }

  const noClanButton = makeClanButton(
    "No clan",
    "Play without choosing a clan.",
    clickedButton => {
      selectedClan = null;
      clanChoiceMade = true;
      setSelectedButton(clickedButton);
    }
  );

  clanOptions.append(noClanButton);

  if (preferredClanId === "none") {
    clanChoiceMade = true;
    setSelectedButton(noClanButton);
  }
}

async function loadUniverse(preferredClanId = null) {
  const requestId = ++loadSequence;

  selectedUniverseData = null;
  selectedClan = null;
  clanChoiceMade = false;
  startButton.disabled = true;
  errorMessage.textContent = "";

  const loadingMessage = document.createElement("p");
  loadingMessage.textContent = "Loading clans…";
  clanOptions.replaceChildren(loadingMessage);

  const universe = UNIVERSES.find(
    item => item.id === universeSelect.value
  );

  if (!universe) {
    errorMessage.textContent = "Choose a universe.";
    return;
  }

  try {
    const module = await import(universe.path);

    // A newer universe selection was made while this one was loading.
    if (requestId !== loadSequence) return;

    const universeData = module.default;

    if (!Array.isArray(universeData?.GAME_DATA)) {
      throw new Error("The universe file has no GAME_DATA array.");
    }

    selectedUniverseData = universeData;

    const clanCategory = universeData.GAME_DATA.find(
      category => category.id === "clan" || category.kind === "clan"
    );

    const clans = Array.isArray(clanCategory?.entries)
      ? clanCategory.entries
      : [];

    renderClanChoices(clans, preferredClanId);
    startButton.disabled = false;
  } catch (error) {
    if (requestId !== loadSequence) return;

    clanOptions.replaceChildren();
    errorMessage.textContent =
      "Could not load this universe. Check its data-file path and format.";
    console.error("Universe loading failed:", error);
  }
}

async function launchGame(profile, universeData) {
  window.GAME_START = {
    ...profile,
    universeData
  };

  try {
    await import("./spin.js");
    main.hidden = false;
    menu.remove();
    return true;
  } catch (error) {
    errorMessage.textContent =
      "The game could not be started. Check the browser console.";
    console.error("Game startup failed:", error);
    return false;
  }
}

async function startFromSavedProfile() {
  let profile = null;

  try {
    profile = loadPlayer();
  } catch (error) {
    console.error("Could not read the saved player profile:", error);
  }

  const universe = UNIVERSES.find(
    item => item.id === profile?.universeId
  );

  const playerName = profile?.playerName?.trim();
  const clanId = profile?.clanId;

  if (playerName && universe && typeof clanId === "string") {
    try {
      const module = await import(universe.path);
      const universeData = module.default;

      if (!Array.isArray(universeData?.GAME_DATA)) {
        throw new Error("The universe file has no GAME_DATA array.");
      }

      const clanCategory = universeData.GAME_DATA.find(
        category => category.id === "clan" || category.kind === "clan"
      );

      const clans = Array.isArray(clanCategory?.entries)
        ? clanCategory.entries
        : [];

      const savedClan =
        clanId === "none"
          ? null
          : clans.find(clan => clan.id === clanId);

      // A saved clan must still exist in the selected universe.
      if (clanId === "none" || savedClan) {
        const savedProfile = {
          playerName,
          universeId: universe.id,
          universeLabel: universe.label,
          clanId: savedClan?.id ?? "none",
          clanName: savedClan?.name ?? "No clan"
        };

        const started = await launchGame(savedProfile, universeData);
        if (started) return;
      }
    } catch (error) {
      console.error("Could not start from the saved profile:", error);
    }
  }

  // If auto-start isn't possible, use saved details to prefill the menu.
  if (playerName) {
    nameInput.value = playerName;
  }

  if (universe) {
    universeSelect.value = universe.id;
  }

  await loadUniverse(profile?.clanId ?? null);
}

universeSelect.addEventListener("change", () => loadUniverse());

form.addEventListener("submit", async event => {
  event.preventDefault();
  errorMessage.textContent = "";

  const playerName = nameInput.value.trim();
  const universe = UNIVERSES.find(
    item => item.id === universeSelect.value
  );

  if (!playerName || !universe || !selectedUniverseData || !clanChoiceMade) {
    errorMessage.textContent =
      "Enter your name, choose a universe, and choose a clan or No clan.";
    return;
  }

  const profile = {
    playerName,
    universeId: universe.id,
    universeLabel: universe.label,
    clanId: selectedClan?.id ?? "none",
    clanName: selectedClan?.name ?? "No clan"
  };

  try {
    savePlayer(profile);
  } catch (error) {
    console.error("Could not save the player profile:", error);
    errorMessage.textContent =
      "Your profile could not be saved, but the game will still try to start.";
  }

  startButton.disabled = true;
  const started = await launchGame(profile, selectedUniverseData);

  if (!started) {
    startButton.disabled = false;
  }
});

startFromSavedProfile();
