/**
 * settings.js — aba de configurações e dono da persistência.
 * Todo salvamento no armazenamento passa por aqui, para que duas partes do app
 * nunca sobrescrevam o registro uma da outra.
 */

import { EVENTS, STORAGE_KEYS } from '../core/constants.js';
import { CONFIG_FIELDS, DEFAULT_FILAMENT, readConfigField } from '../core/config.js';
import { state } from '../core/state.js';
import * as storage from '../core/storage.js';
import { formatBRL } from '../core/format.js';
import { emit, on } from '../core/bus.js';
import { createCombobox } from './combobox.js';

/** Valor usado quando o usuário prefere digitar o número na mão. */
const MANUAL = 'outros';

const SELECT_FIELDS = ['selEst', 'selImp'];

/** @type {Record<string, ReturnType<typeof createCombobox>>} */
const combos = {};

/**
 * @param {string} id
 * @returns {any}
 */
const field = (id) => document.getElementById(id);

/**
 * @param {string} id
 * @param {string} value
 */
function setFieldValue(id, value) {
	const element = field(id);
	if (element) element.value = value;
}

/** @returns {import('./combobox.js').ComboOption[]} */
function energyOptions() {
	const options = Object.entries(state.energy).map(([key, item]) => ({
		value: key,
		label: item.name,
		group: formatBRL(item.value),
	}));

	return [{ value: MANUAL, label: 'Manual', group: '' }, ...options];
}

/** @returns {import('./combobox.js').ComboOption[]} */
function printerOptions() {
	const options = [{ value: MANUAL, label: 'Personalizado', group: '' }];

	for (const [brand, models] of Object.entries(state.printers)) {
		for (const printer of models) {
			options.push({
				value: `${brand}|${printer.model}`,
				label: `${brand} · ${printer.model}`,
				group: `${Math.round(printer.watts * 1000)} W`,
			});
		}
	}

	return options;
}

/**
 * @param {string} value
 * @returns {{watts: number, model: string, brand: string} | null}
 */
function findPrinter(value) {
	const [brand, model] = String(value).split('|');
	if (!brand || !model) return null;
	const found = (state.printers[brand] ?? []).find((printer) => printer.model === model);
	return found ? { ...found, brand } : null;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeEnergyKey(value) {
	if (!value || value === MANUAL) return MANUAL;
	if (state.energy[value]) return value;

	const found = Object.entries(state.energy).find(([, item]) => String(item.value) === String(value));
	return found ? found[0] : MANUAL;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePrinterKey(value) {
	if (!value || value === MANUAL) return MANUAL;
	if (String(value).includes('|')) return value;

	for (const [brand, models] of Object.entries(state.printers)) {
		const found = models.find((printer) => String(printer.watts) === String(value));
		if (found) return `${brand}|${found.model}`;
	}

	return MANUAL;
}

/** Leva a configuração do estado para os campos da tela. */
export function applyConfigToDom() {
	for (const id of CONFIG_FIELDS) {
		if (SELECT_FIELDS.includes(id)) continue;
		setFieldValue(id, state.config[id]);
	}

	state.config.selEst = normalizeEnergyKey(state.config.selEst);
	state.config.selImp = normalizePrinterKey(state.config.selImp);
	combos.selEst?.setValue(state.config.selEst);
	combos.selImp?.setValue(state.config.selImp);
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
		const value = readConfigField(saved, id);
		if (value !== undefined) state.config[id] = String(value);
	}

	return true;
}

/**
 * Fotografia da configuração inteira, usada pelos presets e pelo link.
 * @returns {{filaments: import('../core/pricing.js').Filament[]} & Record<string, string>}
 */
export function getSnapshot() {
	return { filaments: state.filaments, ...state.config, _compact: true };
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
		const value = readConfigField(data, id);
		if (value !== undefined) state.config[id] = String(value);
	}
}

/**
 * @param {string} id
 * @param {string} value
 */
function applyFieldValue(id, value) {
	state.config[id] = value;

	if (id === 'selEst' && value !== MANUAL) {
		const price = state.energy[value]?.value;
		if (price !== undefined) {
			state.config.energyKwh = String(price);
			setFieldValue('energyKwh', String(price));
		}
	}

	if (id === 'selImp' && value !== MANUAL) {
		const printer = findPrinter(value);
		if (printer) {
			state.config.consumoKw = String(printer.watts);
			setFieldValue('consumoKw', String(printer.watts));
		}
	}

	saveSettings();
	emit(EVENTS.CONFIG_CHANGED);
}

/**
 * @param {Event} event
 */
function onInput(event) {
	const target = /** @type {HTMLInputElement} */ (event.target);
	const id = target?.id;
	if (!id || !CONFIG_FIELDS.includes(id)) return;

	if (SELECT_FIELDS.includes(id)) return;

	applyFieldValue(id, target.value);
}

export function hydrate() {
	applyStoredSettings();
}

export function initSettings() {
	applyStoredSettings();

	combos.selEst = createCombobox('selEst', energyOptions(), (value) => applyFieldValue('selEst', value));
	combos.selImp = createCombobox('selImp', printerOptions(), (value) => applyFieldValue('selImp', value));

	applyConfigToDom();

	document.getElementById('panel-settings')?.addEventListener('input', onInput);

	// O módulo de filamentos não grava: ele avisa, e a gravação acontece aqui.
	on(EVENTS.FILAMENTS_CHANGED, saveSettings);
}
