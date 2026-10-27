/**
 * storage.js — acesso ao localStorage que nunca derruba o app.
 * Navegação privada e cota cheia fazem o localStorage lançar; aqui isso vira
 * um valor de fallback.
 */

/**
 * @returns {Storage | null}
 */
function store() {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

/**
 * @param {string} key
 * @param {string|null} [fallback]
 * @returns {string|null}
 */
export function read(key, fallback = null) {
	try {
		const value = store()?.getItem(key);
		return value === null || value === undefined ? fallback : value;
	} catch {
		return fallback;
	}
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {boolean} se conseguiu gravar
 */
export function write(key, value) {
	try {
		store()?.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} key
 */
export function remove(key) {
	try {
		store()?.removeItem(key);
	} catch {
	}
}

/**
 * @param {string} key
 * @param {unknown} fallback
 * @returns {unknown}
 */
export function readJSON(key, fallback) {
	const raw = read(key, null);
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean}
 */
export function writeJSON(key, value) {
	try {
		return write(key, JSON.stringify(value));
	} catch {
		return false;
	}
}
