/**
 * main.js — ponto de entrada.
 * Só costura as peças: carrega as tabelas, hidrata o estado, inicializa os
 * módulos na ordem certa e aplica os parâmetros da URL. A regra de negócio
 * vive em src/core e a interface em src/ui.
 */

import { EVENTS, STORAGE_KEYS, TABS } from './core/constants.js';
import { state } from './core/state.js';
import * as storage from './core/storage.js';
import { readUrlInputs } from './core/url.js';
import { emit, on } from './core/bus.js';

import * as theme from './ui/theme.js';
import * as tabs from './ui/tabs.js';
import * as settings from './ui/settings.js';
import * as filaments from './ui/filaments.js';
import * as presets from './ui/presets.js';
import * as history from './ui/history.js';
import * as importSheet from './ui/import-sheet.js';
import * as batch from './ui/batch.js';
import * as calculator from './ui/calculator.js';
import * as share from './ui/share.js';
import * as exports from './ui/export.js';

/**
 * Carrega as tabelas de tarifas e de impressoras.
 * Se falhar, o app segue funcionando: os campos numéricos aceitam valor manual.
 */
async function loadTables() {
	try {
		const [energy, printers] = await Promise.all([
			fetch('src/data/energy.json').then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json();
			}),
			fetch('src/data/printers.json').then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.json();
			}),
		]);

		state.energy = energy;
		state.printers = printers;
	} catch (error) {
		console.warn('Tabelas de tarifas e impressoras indisponíveis. Seguindo no modo manual.', error);
	}
}

/** Aplica ?data= (configuração) e ?q= / ?w= / ?t= (dados da peça). */
function applyUrlInputs() {
	const input = readUrlInputs(globalThis.location.search);

	if (input.settings) {
		settings.applySnapshot(input.settings);
		settings.applyConfigToDom();
		filaments.render();
	}

	const quantity = /** @type {HTMLInputElement} */ (document.getElementById('quantity'));
	const weight = /** @type {HTMLInputElement} */ (document.getElementById('weight'));
	const minutes = /** @type {HTMLInputElement} */ (document.getElementById('minutes'));

	if (quantity && input.quantity !== null) quantity.value = input.quantity;
	if (weight && input.weight !== null) weight.value = input.weight;
	if (minutes && input.time !== null) minutes.value = input.time;
}

/** O ponto na aba some assim que o usuário olha as configurações uma vez. */
function updateSettingsDot() {
	const dot = document.getElementById('settingsDot');
	if (dot) dot.hidden = state.settingsSeen;
}

function markSettingsSeen() {
	if (state.settingsSeen) return;
	state.settingsSeen = true;
	storage.write(STORAGE_KEYS.settingsSeen, 'true');
	updateSettingsDot();
	calculator.recalculate();
}

async function init() {
	state.settingsSeen = storage.read(STORAGE_KEYS.settingsSeen, 'false') === 'true';

	theme.initTheme();

	tabs.initTabs();
	updateSettingsDot();

	settings.hydrate();
	filaments.initFilaments();

	await loadTables();

	settings.initSettings();

	presets.initPresets();
	history.initHistory();

	// Se o histórico abrir em tela cheia ou sobreposto, o painel atual continua
	// visível; então invalide a visibilidade dos painéis assim que possível.
	requestAnimationFrame(() => tabs.refreshPanelVisibility());

	calculator.initCalculator();
	importSheet.initImportSheet();
	batch.initBatch();
	share.initShare();
	exports.initExport();

	document.getElementById('historyExport')?.addEventListener('click', () => exports.openExportSheet());
	document.getElementById('batchHistory')?.addEventListener('click', () => history.openHistory());

	// A primeira visita às configurações desliga o convite para refinar.
	on(EVENTS.TAB_CHANGED, ({ tab }) => {
		if (tab === TABS.SETTINGS) markSettingsSeen();
	});

	document.getElementById('refineLink')?.addEventListener('click', (event) => {
		event.preventDefault();
		tabs.switchTab(TABS.SETTINGS);
	});

	applyUrlInputs();

	calculator.recalculate();
	share.refreshLink();

	// Ao voltar para a aba, o preço é recalculado por garantia.
	globalThis.addEventListener('pageshow', () => calculator.recalculate());
}

init();
