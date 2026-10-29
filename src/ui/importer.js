/**
 * importer.js — link do STLFlix vira peso, tempo e preço.
 *
 * Um link de drop abre a folha com todos os modelos e versões; um link de
 * produto com uma única versão preenche os campos direto. O preço de cada
 * versão usa a quantidade, as cores e os custos que já estão na tela.
 */

import { ImportRequestError, fetchImport, formatGrams, sourceLabel, variantValues } from '../core/importer.js';
import { parseQuantity, parseTime, parseWeight } from '../core/parser.js';
import { calculateQuote } from '../core/pricing.js';
import { state } from '../core/state.js';
import { formatBRL, formatDuration } from '../core/format.js';
import { toast } from './notice.js';

/** @type {ReturnType<typeof fetchImport>|null} */
let pending = null;
let busy = false;

const element = (id) => document.getElementById(id);

/** @param {number} grams */
function weightLabel(grams) {
	return Number(grams) > 0 ? formatGrams(grams) : '—';
}

/** @param {number} minutes */
function timeLabel(minutes) {
	return Number(minutes) > 0 ? formatDuration(minutes) : '—';
}

/**
 * Preço da versão com o que está configurado agora.
 * Devolve `null` quando ainda não há filamento utilizável.
 * @param {{weightG: number|null, minutes: number|null}} variant
 */
function quoteFor(variant) {
	const values = variantValues(variant);

	return calculateQuote({
		weightGrams: parseWeight(values.weight),
		minutes: parseTime(values.time),
		quantity: parseQuantity(/** @type {HTMLInputElement} */ (element('quantity'))?.value),
		filaments: state.filaments,
		selected: [...state.selected],
		config: state.config,
	});
}

/**
 * @param {number} count
 * @returns {string}
 */
function summary(count) {
	return count === 1 ? '1 versão' : `${count} versões`;
}

/**
 * @param {ReturnType<typeof fetchImport>} result
 * @returns {string}
 */
function hintFor(result) {
	const quantity = parseQuantity(/** @type {HTMLInputElement} */ (element('quantity'))?.value);
	const scope = quantity > 1 ? `Preço para ${quantity} un` : 'Preço por peça';
	return `${scope} · ${sourceLabel(result.source)}`;
}

/**
 * @param {import('../core/importer.js').ImportItem} item
 * @param {{label: string, weightG: number|null, minutes: number|null}} variant
 * @param {number} index
 */
function variantRow(item, variant, index) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'variant-option';
	button.dataset.itemId = item.id;
	button.dataset.variantIndex = String(index);

	const name = document.createElement('span');
	name.className = 'variant-name';
	name.textContent = variant.label;

	const meta = document.createElement('span');
	meta.className = 'variant-meta';
	meta.textContent = `${weightLabel(variant.weightG)} · ${timeLabel(variant.minutes)}`;

	const price = document.createElement('span');
	price.className = 'variant-price';
	const quote = quoteFor(variant);
	price.textContent = quote ? formatBRL(quote.total) : '—';
	if (!quote) price.classList.add('is-empty');

	button.append(name, meta, price);

	const values = variantValues(variant);
	const ready = Boolean(values.weight && values.time);
	button.disabled = !ready;
	if (!ready) button.title = 'Não encontrei peso e tempo desta versão.';

	button.addEventListener('click', () => applyVariant(variant));
	return button;
}

/**
 * @param {import('../core/importer.js').ImportItem} item
 */
function itemCard(item) {
	const card = document.createElement('article');
	card.className = 'import-item';

	const head = document.createElement('div');
	head.className = 'import-item-head';

	if (item.thumbnail) {
		const image = document.createElement('img');
		image.className = 'import-thumb';
		image.src = item.thumbnail;
		image.alt = '';
		image.loading = 'lazy';
		image.decoding = 'async';
		image.addEventListener('error', () => image.remove());
		head.append(image);
	}

	const heading = document.createElement('div');
	heading.className = 'import-item-heading';

	const title = document.createElement('h3');
	title.className = 'import-item-title';
	title.textContent = item.title;

	const meta = document.createElement('span');
	meta.className = 'import-item-meta';
	meta.textContent = item.multipart ? `Multipartes · ${summary(item.variants.length)}` : summary(item.variants.length);

	heading.append(title, meta);
	head.append(heading);

	const list = document.createElement('div');
	list.className = 'variant-list';
	item.variants.forEach((variant, index) => list.append(variantRow(item, variant, index)));

	card.append(head, list);
	return card;
}

/**
 * @param {ReturnType<typeof fetchImport>} result
 */
function renderPicker(result) {
	const list = element('importItems');
	const title = element('importTitle');
	const subtitle = element('importSubtitle');
	const hint = element('importHint');
	if (!list || !title || !subtitle || !hint) return;

	title.textContent = result.kind === 'drop' ? 'Escolha o modelo' : 'Escolha a versão';
	subtitle.textContent = `${result.title} · ${summary(
		result.items.reduce((total, item) => total + item.variants.length, 0),
	)}`;
	hint.textContent = hintFor(result);

	list.replaceChildren(...result.items.map(itemCard));
}

function openPicker() {
	const dialog = /** @type {HTMLDialogElement} */ (element('importSheet'));
	if (!dialog) return;

	if (typeof dialog.showModal === 'function') dialog.showModal();
	else dialog.setAttribute('open', '');
}

function closePicker() {
	const dialog = /** @type {HTMLDialogElement} */ (element('importSheet'));
	if (!dialog) return;

	if (typeof dialog.close === 'function') dialog.close();
	else dialog.removeAttribute('open');
}

/**
 * @param {{label: string, weightG: number|null, minutes: number|null}} variant
 */
function applyVariant(variant) {
	const values = variantValues(variant);
	const weight = /** @type {HTMLInputElement} */ (element('weight'));
	const minutes = /** @type {HTMLInputElement} */ (element('minutes'));
	if (!weight || !minutes) return;

	weight.value = values.weight;
	minutes.value = values.time;

	// O mesmo evento do formulário: o cálculo e o estado acompanham.
	weight.dispatchEvent(new Event('input', { bubbles: true }));

	closePicker();
	toast(`Importado: ${variant.label} — ${weightLabel(variant.weightG)}, ${timeLabel(variant.minutes)}.`);
}

/**
 * @param {ReturnType<typeof fetchImport>} result
 */
function applyIfSingle(result) {
	const options = result.items.flatMap((item) =>
		item.variants.map((variant) => ({ item, variant })),
	);

	if (options.length !== 1) {
		renderPicker(result);
		openPicker();
		return;
	}

	const [{ variant }] = options;
	applyVariant(variant);
}

/** @param {SubmitEvent} event */
async function onSubmit(event) {
	event.preventDefault();
	if (busy) return;

	const input = /** @type {HTMLInputElement} */ (element('importUrl'));
	const button = /** @type {HTMLButtonElement} */ (element('importSubmit'));
	const form = /** @type {HTMLFormElement} */ (element('importForm'));
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
		pending = await fetchImport(raw);

		const hasVariant = pending.items.some((item) => item.variants.length > 0);
		if (!hasVariant) {
			toast('Não encontrei peso e tempo nesse link.');
			return;
		}

		input.blur();
		applyIfSingle(pending);
	} catch (error) {
		if (error instanceof ImportRequestError) {
			toast(error.message);
		} else {
			console.error('import:', error);
			toast('Não consegui importar esse link.');
		}
	} finally {
		busy = false;
		button.disabled = false;
		button.textContent = 'Importar';
		form.removeAttribute('aria-busy');
		pending = null;
	}
}

export function initImporter() {
	const form = element('importForm');
	const dialog = element('importSheet');

	form?.addEventListener('submit', onSubmit);
	element('importClose')?.addEventListener('click', closePicker);

	// Clique no fundo escurecido (que conta como clique no próprio diálogo).
	dialog?.addEventListener('click', (event) => {
		if (event.target === dialog) closePicker();
	});
}
