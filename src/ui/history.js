/**
 * history.js — histórico dos últimos cálculos.
 * Mostra o preço e um resumo do que foi informado, para conferir um orçamento
 * passado sem refazer a conta.
 */

import { MAX_HISTORY, STORAGE_KEYS } from '../core/constants.js';
import { state } from '../core/state.js';
import * as storage from '../core/storage.js';
import { formatBRL, formatDateTime, formatDuration, formatWeight } from '../core/format.js';
import { parseTime, parseWeight } from '../core/parser.js';
import { toast } from './notice.js';

/** @type {ReturnType<typeof setTimeout> | null} */
let resetTimer = null;

/**
 * Converte registros do formato antigo (preço já formatado, campos soltos)
 * para o formato atual, para quem já tinha histórico não perder nada.
 * @param {any} entry
 * @returns {any | null}
 */
function normalizeEntry(entry) {
	if (!entry || typeof entry !== 'object') return null;
	if (typeof entry.total === 'number') return entry;

	const legacyPrice = parseFloat(
		String(entry.price ?? '')
			.replace(/[^\d,.-]/g, '')
			.replace(/\./g, '')
			.replace(',', '.'),
	);

	return {
		id: Number(entry.id) || Date.now(),
		createdAt: String(entry.date ?? ''),
		quantity: Number(entry.qty) || 1,
		weightGrams: parseWeight(entry.weight),
		minutes: parseTime(entry.time),
		total: Number.isFinite(legacyPrice) ? legacyPrice : 0,
	};
}

function loadStoredHistory() {
	const saved = storage.readJSON(STORAGE_KEYS.history, null);
	if (!Array.isArray(saved)) {
		state.history = [];
		return;
	}
	state.history = saved.map(normalizeEntry).filter(Boolean);
}

function persistHistory() {
	storage.writeJSON(STORAGE_KEYS.history, state.history);
}

export function renderHistory() {
	const container = document.getElementById('historyList');
	if (!container) return;

	container.replaceChildren();

	if (state.history.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'chips-empty';
		empty.textContent = 'Nenhum cálculo salvo ainda.';
		container.append(empty);
		return;
	}

	for (const entry of state.history) {
		const item = document.createElement('article');
		item.className = 'history-item';

		const price = document.createElement('span');
		price.className = 'history-price';
		price.textContent = formatBRL(entry.total);

		const meta = document.createElement('span');
		meta.className = 'history-meta';
		meta.textContent = [
			formatDateTime(entry.createdAt),
			`${entry.quantity} un`,
			formatWeight(entry.weightGrams),
			formatDuration(entry.minutes),
		].join(' · ');

		item.append(price, meta);
		container.append(item);
	}
}

/** Guarda o cálculo que está na tela. */
export function saveCurrent() {
	const quote = state.quote;

	if (!quote) {
		toast('Informe peso e tempo antes de salvar.');
		return;
	}

	state.history.unshift({
		id: Date.now(),
		createdAt: new Date().toISOString(),
		quantity: quote.quantity,
		weightGrams: quote.weightGrams,
		minutes: quote.minutes,
		total: quote.total,
	});

	state.history = state.history.slice(0, MAX_HISTORY);
	persistHistory();
	renderHistory();
	toast('Cálculo salvo no histórico.');
}

export function openHistory() {
	const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('historySheet'));
	if (!dialog) return;

	renderHistory();
	if (typeof dialog.showModal === 'function') dialog.showModal();
	else dialog.setAttribute('open', '');
}

export function closeHistory() {
	const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('historySheet'));
	if (!dialog) return;

	if (typeof dialog.close === 'function') dialog.close();
	else dialog.removeAttribute('open');
}

function clearHistory(event) {
	const button = /** @type {HTMLButtonElement} */ (event.currentTarget);

	if (button.dataset.confirming !== 'true') {
		button.dataset.confirming = 'true';
		button.textContent = 'Confirmar limpeza do histórico';

		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = setTimeout(() => {
			button.dataset.confirming = 'false';
			button.textContent = 'Limpar histórico';
		}, 4000);
		return;
	}

	if (resetTimer) clearTimeout(resetTimer);
	button.dataset.confirming = 'false';
	button.textContent = 'Limpar histórico';

	state.history = [];
	persistHistory();
	renderHistory();
	toast('Histórico limpo.');
}

export function initHistory() {
	loadStoredHistory();

	const dialog = document.getElementById('historySheet');

	document.getElementById('historyToggle')?.addEventListener('click', openHistory);
	document.getElementById('historyClose')?.addEventListener('click', closeHistory);
	document.getElementById('historyClear')?.addEventListener('click', clearHistory);
	document.getElementById('saveHistory')?.addEventListener('click', saveCurrent);

	// Clique no fundo escurecido (que conta como clique no próprio diálogo).
	dialog?.addEventListener('click', (event) => {
		if (event.target === dialog) closeHistory();
	});
}
