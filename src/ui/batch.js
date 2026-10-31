/**
 * batch.js — aba Orçamento: monta um lote de pratos e soma tudo.
 *
 * A lista é a fonte da verdade; o resultado é sempre recalculado a partir dela,
 * da quantidade, das cores marcadas e da configuração de custos.
 */

import { EVENTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { addBatchItems, calculateBatch, removeBatchItem } from '../core/batch.js';
import { ImportRequestError, fetchImport, formatGrams, sourceLabel } from '../core/importer.js';
import { parseQuantity } from '../core/parser.js';
import { formatBRL, formatDuration, formatWeight } from '../core/format.js';
import { emit, on } from '../core/bus.js';
import { openImportSheet } from './import-sheet.js';
import { toast } from './notice.js';
import { saveBatch } from './history.js';
import { openExportSheet } from './export.js';

/** @type {ReturnType<typeof setTimeout> | null} */
let clearTimer = null;
let busy = false;
/** @type {any} */
let lastImportResult = null;

const element = (id) => document.getElementById(id);

function quantityValue() {
	const input = /** @type {HTMLInputElement} */ (element('batchQuantity'));
	return input?.value ?? state.batch.quantity;
}

function recalculate() {
	const batch = state.batch;
	batch.quantity = quantityValue();
	batch.result = calculateBatch({
		items: batch.items,
		quantity: parseQuantity(batch.quantity),
		filaments: state.filaments,
		selected: [...state.selected],
		config: state.config,
	});
}

/* -------------------------------------------------------------------- resumo */

function renderProfileSummary() {
	const container = element('batchProfileSummary');
	if (!container) return;

	container.replaceChildren();

	const batch = state.batch;
	if (batch.items.length === 0) {
		container.hidden = true;
		return;
	}

	container.hidden = false;
	container.className = 'batch-profile';

	if (batch.profileCover) {
		const image = document.createElement('img');
		image.className = 'batch-profile-cover';
		image.src = batch.profileCover;
		image.alt = '';
		image.loading = 'lazy';
		image.decoding = 'async';
		image.addEventListener('error', () => image.remove());
		container.append(image);
	}

	const info = document.createElement('div');
	info.className = 'batch-profile-info';

	const title = document.createElement('span');
	title.className = 'batch-profile-title';
	title.textContent = batch.profileTitle || batch.title;

	const meta = document.createElement('span');
	meta.className = 'batch-profile-meta';
	meta.textContent = [
		`${batch.items.length} ${batch.items.length === 1 ? 'item' : 'itens'}`,
		sourceLabel(batch.source),
	].join(' · ');

	info.append(title, meta);

	const change = document.createElement('button');
	change.type = 'button';
	change.className = 'btn';
	change.textContent = 'Trocar';
	change.addEventListener('click', () => {
		if (lastImportResult?.source === 'makerworld') showSheet(lastImportResult);
		else element('batchImportUrl')?.focus();
	});

	container.append(info, change);
}

/* --------------------------------------------------------------------- lista */

function renderItems() {
	const list = element('batchItems');
	const empty = element('batchEmpty');
	const clear = element('batchClear');
	const count = element('batchCount');
	if (!list || !empty || !clear) return;

	const batch = state.batch;
	const result = batch.result;
	const quantity = parseQuantity(batch.quantity);

	empty.hidden = batch.items.length > 0;
	clear.hidden = batch.items.length === 0;
	if (count) {
		count.textContent =
			batch.items.length === 0
				? ''
				: `${batch.items.length} ${batch.items.length === 1 ? 'item' : 'itens'}`;
	}

	list.replaceChildren();

	for (const item of batch.items) {
		const line = document.createElement('article');
		line.className = 'batch-item';

		if (item.thumbnail) {
			const image = document.createElement('img');
			image.className = 'batch-item-thumb';
			image.src = item.thumbnail;
			image.alt = '';
			image.loading = 'lazy';
			image.decoding = 'async';
			image.addEventListener('error', () => image.remove());
			line.append(image);
		} else {
			const placeholder = document.createElement('span');
			placeholder.className = 'batch-item-thumb';
			placeholder.setAttribute('aria-hidden', 'true');
			line.append(placeholder);
		}

		const body = document.createElement('div');
		body.className = 'batch-item-body';

		const title = document.createElement('span');
		title.className = 'batch-item-title';
		title.textContent = item.title;

		const meta = document.createElement('span');
		meta.className = 'batch-item-meta';
		meta.textContent = [
			item.subtitle,
			`${formatGrams(item.weightG)} · ${formatDuration(item.minutes)}`,
			quantity > 1 ? `${quantity} un` : '',
		]
			.filter(Boolean)
			.join(' · ');

		body.append(title, meta);

		const quoted = result?.items.find((entry) => entry.id === item.id);
		const price = document.createElement('span');
		price.className = 'batch-item-price';
		price.textContent = quoted ? formatBRL(quoted.quote.total) : '—';
		if (!quoted) price.classList.add('is-empty');

		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'btn btn-icon batch-item-remove';
		remove.setAttribute('aria-label', `Remover ${item.title}`);
		remove.innerHTML =
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
		remove.addEventListener('click', () => {
			state.batch.items = removeBatchItem(state.batch.items, item.id);
			emit(EVENTS.BATCH_CHANGED);
		});

		line.append(body, price, remove);
		list.append(line);
	}
}

/* ------------------------------------------------------------------ resultado */

function renderResult() {
	const card = element('batchResult');
	const placeholder = element('batchPlaceholder');
	const result = state.batch.result;
	if (!card) return;

	if (!result) {
		card.hidden = true;
		if (placeholder) placeholder.hidden = false;
		return;
	}

	card.hidden = false;
	if (placeholder) placeholder.hidden = true;

	const set = (id, value) => {
		const node = element(id);
		if (node) node.textContent = value;
	};

	set('batchWeight', formatWeight(result.weightGrams));
	set('batchTime', formatDuration(result.minutes));
	set('batchPieces', String(result.pieces));
	set('batchSubtotal', formatBRL(result.subtotal));

	const discountRow = element('batchDiscountRow');
	if (discountRow) discountRow.hidden = !result.showDiscount;
	if (result.showDiscount) set('batchDiscount', `-${formatBRL(result.discount)}`);

	const total = element('batchTotal');
	if (total) {
		const formatted = formatBRL(result.total);
		if (total.textContent !== formatted) {
			total.textContent = formatted;
			total.classList.remove('is-updated');
			void total.offsetWidth;
			total.classList.add('is-updated');
		}
	}
}

function render() {
	recalculate();
	renderProfileSummary();
	renderItems();
	renderResult();
}

/* --------------------------------------------------------------- importação */

/**
 * @param {any} payload
 */
function applySelection(payload) {
	const batch = state.batch;
	const isMakerworld = payload.source === 'makerworld';

	let base = batch.items;
	let notice = null;

	if (base.length > 0 && batch.source !== payload.source) {
		base = [];
		notice = 'Orçamento anterior substituído: um orçamento por site.';
	} else if (
		isMakerworld &&
		base.length > 0 &&
		batch.profileId &&
		batch.profileId !== payload.profileId
	) {
		base = [];
		notice = 'Orçamento atualizado com o novo perfil.';
	}

	const { items, added, duplicates, limitReached } = addBatchItems(base, payload.items);

	if (items.length > 0) {
		batch.items = items;
		batch.source = payload.source;
		batch.url = payload.url;
		batch.title = payload.title;
		batch.profileId = payload.profileId;
		batch.profileTitle = payload.profileTitle;
		batch.profileCover = payload.profileCover;
		batch.lastResult = lastImportResult;
	}

	emit(EVENTS.BATCH_CHANGED);

	if (notice) toast(notice);
	else if (limitReached) toast('Limite de 20 itens por orçamento.');
	else if (added > 0) {
		const noun = isMakerworld ? (added === 1 ? 'prato' : 'pratos') : added === 1 ? 'item' : 'itens';
		toast(`${added} ${noun} adicionado${added === 1 ? '' : 's'} ao orçamento.`);
	} else if (duplicates.length > 0) toast('Esse prato já está no orçamento.');
}

/**
 * @param {any} imported
 */
function showSheet(imported) {
	openImportSheet({
		result: imported,
		getQuantity: quantityValue,
		onAdd: applySelection,
		onRefresh:
			imported.source === 'makerworld'
				? async () => {
						try {
							const fresh = await fetchImport(imported.url, { refresh: true });
							lastImportResult = fresh;
							showSheet(fresh);
						} catch (error) {
							toast(
								error instanceof ImportRequestError
									? error.message
									: 'Não consegui atualizar os dados do MakerWorld.',
							);
						}
					}
				: undefined,
	});
}

/** @param {SubmitEvent} event */
async function onSubmit(event) {
	event.preventDefault();
	if (busy) return;

	const input = /** @type {HTMLInputElement} */ (element('batchImportUrl'));
	const button = /** @type {HTMLButtonElement} */ (element('batchImportSubmit'));
	const form = /** @type {HTMLFormElement} */ (element('batchImportForm'));
	if (!input || !button || !form) return;

	const raw = input.value.trim();
	if (!raw) {
		toast('Cole o link do modelo ou do drop.');
		input.focus();
		return;
	}

	busy = true;
	button.disabled = true;
	button.textContent = 'Importando…';
	form.setAttribute('aria-busy', 'true');

	try {
		const imported = await fetchImport(raw);
		lastImportResult = imported;

		if (
			imported.source === 'makerworld' &&
			!imported.profiles.some((profile) => profile.plates.length > 0)
		) {
			toast('Esse modelo não tem perfis de impressão com peso e tempo.');
			return;
		}

		input.blur();
		showSheet(imported);
	} catch (error) {
		if (error instanceof ImportRequestError) toast(error.message);
		else {
			console.error('import:', error);
			toast('Não consegui importar esse link.');
		}
	} finally {
		busy = false;
		button.disabled = false;
		button.textContent = 'Importar';
		form.removeAttribute('aria-busy');
	}
}

/* -------------------------------------------------------------------- ações */

function clearBatch(event) {
	const button = /** @type {HTMLButtonElement} */ (event.currentTarget);

	if (button.dataset.confirming !== 'true') {
		button.dataset.confirming = 'true';
		button.textContent = 'Confirmar limpeza do orçamento';

		if (clearTimer) clearTimeout(clearTimer);
		clearTimer = setTimeout(() => {
			button.dataset.confirming = 'false';
			button.textContent = 'Limpar orçamento';
		}, 4000);
		return;
	}

	if (clearTimer) clearTimeout(clearTimer);
	button.dataset.confirming = 'false';
	button.textContent = 'Limpar orçamento';

	state.batch = {
		...state.batch,
		source: null,
		url: '',
		title: '',
		profileId: null,
		profileTitle: '',
		profileCover: null,
		items: [],
		result: null,
		lastResult: undefined,
	};
	lastImportResult = null;
	emit(EVENTS.BATCH_CHANGED);
	toast('Orçamento limpo.');
}

function save() {
	if (!state.batch.result) {
		toast('Monte um orçamento antes de salvar.');
		return;
	}
	saveBatch();
}

function exportPdf() {
	if (!state.batch.result) {
		toast('Monte um orçamento antes de gerar o PDF.');
		return;
	}
	openExportSheet();
}

function onQuantityInput() {
	const input = /** @type {HTMLInputElement} */ (element('batchQuantity'));
	state.batch.quantity = input?.value ?? '1';
	emit(EVENTS.BATCH_CHANGED);
}

export function initBatch() {
	element('batchImportForm')?.addEventListener('submit', onSubmit);
	element('batchQuantity')?.addEventListener('input', onQuantityInput);
	element('batchClear')?.addEventListener('click', clearBatch);
	element('batchSaveHistory')?.addEventListener('click', save);
	element('batchExportPdf')?.addEventListener('click', exportPdf);

	for (const event of [
		EVENTS.CONFIG_CHANGED,
		EVENTS.FILAMENTS_CHANGED,
		EVENTS.SELECTION_CHANGED,
		EVENTS.BATCH_CHANGED,
	]) {
		on(event, render);
	}

	render();
}
