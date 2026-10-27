/**
 * settings.js — aba de configurações e dono da persistência.
 * Todo salvamento no armazenamento passa por aqui, para que duas partes do app
 * nunca sobrescrevam o registro uma da outra.
 */

import { EVENTS, STORAGE_KEYS } from '../core/constants.js';
import { CONFIG_FIELDS, DEFAULT_FILAMENT } from '../core/config.js';
import { state } from '../core/state.js';
import * as storage from '../core/storage.js';
import { formatBRL } from '../core/format.js';
import { emit, on } from '../core/bus.js';

/**
 * @param {string} id
 * @returns {HTMLInputElement | HTMLSelectElement | null}
 */
const field = (id) => /** @type {any} */ (document.getElementById(id));

/**
 * @param {string} id
 * @param {string} value
 */
function setFieldValue(id, value) {
	const element = field(id);
	if (element) element.value = value;
}

/** Preenche os seletores com as tabelas carregadas dos JSON. */
export function populateSelects() {
	const stateSelect = field('selEst');
	if (stateSelect) {
		for (const item of Object.values(state.energy)) {
			stateSelect.append(new Option(`${item.name} (${formatBRL(item.value)})`, String(item.value)));
		}
	}

	const printerSelect = field('selImp');
	if (printerSelect) {
		for (const [brand, models] of Object.entries(state.printers)) {
			const group = document.createElement('optgroup');
			group.label = brand;
			for (const printer of models) {
				group.append(new Option(`${printer.model} (${Math.round(printer.watts * 1000)} W)`, String(printer.watts)));
			}
			printerSelect.append(group);
		}
	}
}

/** Leva a configuração do estado para os campos da tela. */
export function applyConfigToDom() {
	for (const id of CONFIG_FIELDS) setFieldValue(id, state.config[id]);
}

/** Grava configuração e filamentos de uma vez só. */
export function saveSettings() {
	storage.writeJSON(STORAGE_KEYS.settings, {
		filaments: state.filaments,
		...state.config,
	});
}

/**
 * Carrega o que estava salvo. Sem nada salvo, deixa um filamento padrão para
 * que a ferramenta já funcione sem nenhuma configuração.
 * @returns {boolean} se havia algo salvo
 */
export function applyStoredSettings() {
	const saved = /** @type {any} */ (storage.readJSON(STORAGE_KEYS.settings, null));

	if (!saved) {
		state.filaments = [{ ...DEFAULT_FILAMENT }];
		return false;
	}

	if (Array.isArray(saved.filaments)) state.filaments = saved.filaments;

	for (const id of CONFIG_FIELDS) {
		const value = saved[id];
		if (value !== undefined && value !== null) state.config[id] = String(value);
	}

	return true;
}

/**
 * Fotografia da configuração inteira, usada pelos presets e pelo link.
 * @returns {{filaments: import('../core/pricing.js').Filament[]} & Record<string, string>}
 */
export function getSnapshot() {
	return { filaments: state.filaments, ...state.config };
}

/**
 * Aplica uma configuração vinda de preset, link ou armazenamento.
 * @param {any} data
 */
export function applySnapshot(data) {
	if (!data || typeof data !== 'object') return;

	if (Array.isArray(data.filaments)) {
		state.filaments = data.filaments;
		state.selected = new Set();
	}

	for (const id of CONFIG_FIELDS) {
		if (data[id] !== undefined && data[id] !== null) state.config[id] = String(data[id]);
	}
}

/**
 * @param {Event} event
 */
function onInput(event) {
	const target = /** @type {HTMLInputElement} */ (event.target);
	const id = target?.id;
	if (!id || !CONFIG_FIELDS.includes(id)) return;

	state.config[id] = target.value;

	// Escolher estado ou impressora preenche o número correspondente, mas
	// continua sendo possível ajustar o valor na mão depois.
	if (id === 'selEst' && target.value !== 'outros') {
		state.config.energyKwh = target.value;
		setFieldValue('energyKwh', target.value);
	}

	if (id === 'selImp' && target.value !== 'outros') {
		state.config.consumoKw = target.value;
		setFieldValue('consumoKw', target.value);
	}

	saveSettings();
	emit(EVENTS.CONFIG_CHANGED);
}

export function initSettings() {
	populateSelects();
	applyStoredSettings();
	applyConfigToDom();

	document.getElementById('panel-settings')?.addEventListener('input', onInput);

	// O módulo de filamentos não grava: ele avisa, e a gravação acontece aqui.
	on(EVENTS.FILAMENTS_CHANGED, saveSettings);
}
