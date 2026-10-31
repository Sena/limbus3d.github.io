/**
 * tabs.js — navegação entre Calculadora, Orçamento e Configurações.
 * A aba aberta fica salva, então quem volta ao site cai onde parou.
 */

import { EVENTS, STORAGE_KEYS, TABS } from '../core/constants.js';
import * as storage from '../core/storage.js';
import { emit } from '../core/bus.js';

const TAB_IDS = {
	[TABS.CALC]: 'tab-calc',
	[TABS.BATCH]: 'tab-batch',
	[TABS.SETTINGS]: 'tab-settings',
};

const PANEL_IDS = {
	[TABS.CALC]: 'panel-calc',
	[TABS.BATCH]: 'panel-batch',
	[TABS.SETTINGS]: 'panel-settings',
};

/**
 * @param {unknown} value
 * @returns {'calc'|'orcamento'|'settings'}
 */
function normalize(value) {
	if (value === TABS.SETTINGS) return TABS.SETTINGS;
	if (value === TABS.BATCH) return TABS.BATCH;
	return TABS.CALC;
}

/**
 * @param {string} tab
 */
export function switchTab(tab) {
	const target = normalize(tab);

	for (const [key, id] of Object.entries(PANEL_IDS)) {
		const panel = document.getElementById(id);
		if (panel) panel.hidden = key !== target;
	}

	for (const [key, id] of Object.entries(TAB_IDS)) {
		const button = document.getElementById(id);
		if (!button) continue;
		const active = key === target;
		button.setAttribute('aria-selected', String(active));
		button.tabIndex = active ? 0 : -1;
	}

	document.documentElement.dataset.tab = target;
	storage.write(STORAGE_KEYS.tab, target);
	emit(EVENTS.TAB_CHANGED, { tab: target });
}

export function initTabs() {
	const buttons = Array.from(document.querySelectorAll('.tab[data-tab]'));

	for (const button of buttons) {
		button.addEventListener('click', () => switchTab(button.dataset.tab));
		button.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
			event.preventDefault();
			const index = buttons.indexOf(button);
			const step = event.key === 'ArrowRight' ? 1 : -1;
			const next = buttons[(index + step + buttons.length) % buttons.length];
			next.focus();
			switchTab(next.dataset.tab);
		});
	}

	switchTab(storage.read(STORAGE_KEYS.tab, TABS.CALC));
}

export function refreshPanelVisibility() {
	const current = storage.read(STORAGE_KEYS.tab, TABS.CALC);
	if (current) switchTab(current);
}
