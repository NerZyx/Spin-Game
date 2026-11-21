const TURN_KEY = "turn-state";
const LAST_RESULTS_KEY = "last-results";

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

export function resultKey(universeId, categoryId) {
  return `${universeId}:${categoryId}`;
}
