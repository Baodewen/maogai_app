const SESSION_KEY = 'maogai_session_v1';
const USERNAME = 'admin';
const PASSWORD_SALT = 'maogai_app_v1_2026_06_03';
const PASSWORD_HASH = '1d22df0bb192d9661abd161508a520b1380ac0e0fa04e01bad4d58f444971afb';

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password) {
  if (!globalThis.crypto?.subtle) return false;
  const payload = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return bytesToHex(new Uint8Array(digest)) === PASSWORD_HASH;
}

export function verifyUsername(username) {
  return username.trim() === USERNAME;
}

export function getSession() {
  return safeParse(localStorage.getItem(SESSION_KEY), null);
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export const AUTH_CONFIG = {
  username: USERNAME,
  displayName: '毛概学习账号'
};
