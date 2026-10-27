/**
 * presets.js — configurações salvas com nome.
 * Um preset é a fotografia de filamentos + custos, útil para quem atende mais
 * de um tipo de trabalho (loja, pessoal, cliente X).
 */

import { EVENTS, STORAGE_KEYS } from '../core/constants.js';
import { state } from '../core/state.js';
import * as storage from '../core/storage.js';
import { emit } from '../core/bus.js';
import { applyConfigToDom, applySnapshot, getSnapshot, saveSettings } from './settings.js';
import { render as renderFilaments } from './filaments.js';
import { toast } from './notice.js';

/** @type {ReturnType<typeof setTimeout> | null} */
let resetTimer = null;

function loadStoredPresets() {
	const saved = storage.readJSON(STORAGE_KEYS.presets, null);
	state.presets = saved && typeof saved === 'object' ? saved : {};
}

function persistPresets() {
	storage.writeJSON(STORAGE_KEYS.presets, state.presets);
}

export function renderPresetOptions() {
	const select = /** @type {HTMLSelectElement} */ (document.getElementById('presetSelect'));
	if (!select) return;

	select.replaceChildren(new Option('Selecione…', ''));

	for (const name of Object.keys(state.presets)) {
		select.append(new Option(name, name));
	}
}

function savePreset() {
	const input = /** @type {HTMLInputElement} */ (document.getElementById('presetName'));
	const name = input?.value.trim();

	if (!name) {
		toast('Dê um nome ao preset antes de salvar.');
		input?.focus();
		return;
	}

	const replacing = Boolean(state.presets[name]);
	state.presets[name] = getSnapshot();
	persistPresets();
	renderPresetOptions();

	if (input) input.value = '';
	toast(replacing ? `Preset "${name}" atualizado.` : `Preset "${name}" salvo.`);
}

function loadPreset(name) {
	const snapshot = state.presets[name];
	if (!snapshot) return;

	applySnapshot(snapshot);
	applyConfigToDom();
	renderFilaments();
	saveSettings();

	emit(EVENTS.CONFIG_CHANGED);
	emit(EVENTS.FILAMENTS_CHANGED);
	toast(`Preset "${name}" carregado.`);
}

/**
 * Exclusão em dois toques: o primeiro pede confirmação no próprio botão,
 * evitando a caixa de diálogo do navegador.
 */
function deletePreset(event) {
	const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
	const select = /** @type {HTMLSelectElement} */ (document.getElementById('presetSelect'));
	const name = select?.value;

	if (!name) {
		toast('Selecione um preset para excluir.');
		return;
	}

	if (button.dataset.confirming !== 'true') {
		button.dataset.confirming = 'true';
		button.textContent = `Confirmar exclusão de "${name}"`;

		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = setTimeout(() => {
			button.dataset.confirming = 'false';
			button.textContent = 'Excluir preset selecionado';
		}, 4000);
		return;
	}

	if (resetTimer) clearTimeout(resetTimer);
	button.dataset.confirming = 'false';
	button.textContent = 'Excluir preset selecionado';

	delete state.presets[name];
	persistPresets();
	renderPresetOptions();
	toast(`Preset "${name}" excluído.`);
}

export function initPresets() {
	loadStoredPresets();
	renderPresetOptions();

	document.getElementById('presetSave')?.addEventListener('click', savePreset);
	document.getElementById('presetDelete')?.addEventListener('click', deletePreset);
	document
		.getElementById('presetSelect')
		?.addEventListener('change', (event) => loadPreset(/** @type {HTMLSelectElement} */ (event.target).value));
}
