const TURN_KEY = "turn-state";
const LAST_RESULTS_KEY = "last-results";
const PLAYER_KEY = "player-profile";

export function loadTurnState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TURN_KEY));
    if (saved && Number.isInteger(saved.turn) && Array.isArray(saved.spent)) {
      return saved;
    }
  } catch {
    // Start a fresh turn if saved data is invalid.
  }

  return { turn: 1, spent: [] };
}

export function saveTurnState(state) {
  try {
    localStorage.setItem(TURN_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or blocked.
  }
}

export function loadLastResults() {
  try {
    return JSON.parse(localStorage.getItem(LAST_RESULTS_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function saveLastResult(key, record) {
  const results = loadLastResults();
  results[key] = record;

  try {
    localStorage.setItem(LAST_RESULTS_KEY, JSON.stringify(results));
  } catch {
    // Storage may be full or blocked.
  }
}

export function loadPlayer() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_KEY));

    if (
      saved &&
      typeof saved.playerName === "string" &&
      typeof saved.universeId === "string" &&
      typeof saved.universeLabel === "string" &&
      typeof saved.clanId === "string" &&
      typeof saved.clanName === "string"
    ) {
      return saved;
    }
  } catch {
    // Return no saved profile if the data is invalid.
  }

  return null;
}

export function savePlayer(player) {
  const profile = {
    playerName: String(player.playerName ?? "").trim(),
    universeId: String(player.universeId ?? ""),
    universeLabel: String(player.universeLabel ?? ""),
    clanId: String(player.clanId ?? ""),
    clanName: String(player.clanName ?? "")
  };

  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(profile));
  } catch {
    // Storage may be full or blocked.
  }
}

export function resultKey(universeId, categoryId) {
  return `${universeId}:${categoryId}`;
}
