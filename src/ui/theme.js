/**
 * theme.js — tema claro e escuro.
 * Sem escolha salva, segue a preferência do sistema; a partir do primeiro
 * clique, a escolha do usuário manda.
 */

import { STORAGE_KEYS } from '../core/constants.js';
import * as storage from '../core/storage.js';

const DARK = 'dark';
const LIGHT = 'light';

/**
 * @returns {'light'|'dark'}
 */
export function resolveTheme() {
	const saved = storage.read(STORAGE_KEYS.theme, '');
	if (saved === DARK || saved === LIGHT) return saved;

	const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
	return prefersDark ? DARK : LIGHT;
}

/**
 * @param {'light'|'dark'} theme
 */
export function applyTheme(theme) {
	document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme() {
	const current = document.documentElement.getAttribute('data-theme');
	const next = current === DARK ? LIGHT : DARK;
	applyTheme(next);
	storage.write(STORAGE_KEYS.theme, next);
}

export function initTheme() {
	applyTheme(resolveTheme());
	document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
}
