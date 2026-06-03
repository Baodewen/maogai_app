const STORAGE_PREFIX = 'maogai_state_v1';

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function keyFor(username) {
  return `${STORAGE_PREFIX}_${username}`;
}

function uniqueArray(value) {
  return Array.isArray(value) ? Array.from(new Set(value.filter(Boolean))) : [];
}

export function normalizeState(raw = {}) {
  return {
    answered: raw.answered && typeof raw.answered === 'object' ? raw.answered : {},
    wrong: uniqueArray(raw.wrong),
    favorite: uniqueArray(raw.favorite),
    hard: uniqueArray(raw.hard),
    notes: raw.notes && typeof raw.notes === 'object' ? raw.notes : {},
    shortDrafts: raw.shortDrafts && typeof raw.shortDrafts === 'object' ? raw.shortDrafts : {}
  };
}

export function loadState(username) {
  return normalizeState(safeParse(localStorage.getItem(keyFor(username)), {}));
}

export function saveState(username, state) {
  localStorage.setItem(keyFor(username), JSON.stringify(normalizeState(state)));
}

export function clearState(username) {
  localStorage.removeItem(keyFor(username));
}
