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
	const shell = document.getElementById('historyList');
	if (!shell) return;

	updateStat();
	shell.replaceChildren();

	if (state.history.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'history-empty';
		const icon = document.createElement('svg');
		icon.setAttribute('class', 'history-empty-icon');
		icon.setAttribute('viewBox', '0 0 24 24');
		icon.setAttribute('fill', 'none');
		icon.setAttribute('stroke', 'currentColor');
		icon.setAttribute('stroke-width', '1.8');
		icon.setAttribute('stroke-linecap', 'round');
		icon.setAttribute('aria-hidden', 'true');
		icon.innerHTML = `<circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path>`;
		const title = document.createElement('p');
		title.className = 'history-empty-title';
		title.textContent = 'Nenhum cálculo salvo ainda.';
		const note = document.createElement('p');
		note.className = 'history-empty-note';
		note.textContent = 'Use a calculadora ou o orçamento para salvar.';
		empty.append(icon, title, note);
		shell.append(empty);
		return;
	}

	for (const entry of state.history) {
		const item = document.createElement('article');
		item.className = 'history-item';

		const title = document.createElement('div');
		title.className = 'history-item-title';
		const tilt = document.createElement('span');
		tilt.className = 'history-title';
		tilt.textContent = sourceLabel(entry);
		const price = document.createElement('span');
		price.className = 'history-item-price';
		price.textContent = formatBRL(entry.total);
		title.append(tilt, price);

		const meta = document.createElement('p');
		meta.className = 'history-item-meta';
		meta.textContent = [
			formatDateTime(entry.createdAt),
			entry.itemsCount && entry.itemsCount > 0
				? `${entry.itemsCount} itens`
				: `${entry.quantity} un`,
			formatWeight(entry.weightGrams),
			formatDuration(entry.minutes),
		].join(' · ');

		item.append(title, meta);
		shell.append(item);
	}
}

function sourceLabel(entry) {
	if (entry.source) return `Orçamento · ${entry.source}`;
	return 'Calculadora';
}

/** Linha do cabeçalho: quantos cálculos estão guardados e quanto somam. */
function updateStat() {
	const stat = document.getElementById('historyStat');
	if (!stat) return;

	const entries = state.history;

	if (entries.length === 0) {
		stat.textContent = 'Nada salvo ainda.';
		return;
	}

	const total = entries.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0);
	stat.textContent = `${entries.length} ${entries.length === 1 ? 'cálculo' : 'cálculos'} · ${formatBRL(total)} no total`;
}

/** Guarda o orçamento de vários itens, com a quebra por prato. */
export function saveBatch() {
	const result = state.batch.result;

	if (!result) {
		toast('Monte um orçamento antes de salvar.');
		return;
	}

	const items = result.items.map((line) => ({
		title: line.title,
		weightGrams: line.weightG,
		minutes: line.minutes,
		total: Math.round(line.quote.total * 100) / 100,
	}));

	state.history.unshift({
		id: Date.now(),
		createdAt: new Date().toISOString(),
		quantity: result.quantity,
		weightGrams: result.weightGrams,
		minutes: result.minutes,
		total: result.total,
		itemsCount: items.length,
		source: state.batch.source,
		items,
		subtotal: result.subtotal,
		discount: result.discount,
	});

	state.history = state.history.slice(0, MAX_HISTORY);
	persistHistory();
	renderHistory();
	toast('Orçamento salvo no histórico.');
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
	document.getElementById('historySaveCurrent')?.addEventListener('click', saveCurrent);

	for (const button of document.querySelectorAll('[data-open-history]')) {
		button.addEventListener('click', openHistory);
	}

	// Clique no fundo escurecido (que conta como clique no próprio diálogo).
	dialog?.addEventListener('click', (event) => {
		if (event.target === dialog) closeHistory();
	});
}
