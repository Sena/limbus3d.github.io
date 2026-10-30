/**
 * import-sheet.js — a folha que escolhe o que entra no orçamento.
 *
 * MakerWorld: dois passos, perfis e depois pratos, com imagem em ambos.
 * STLFlix: os mesmos cartões de modelo/versão de antes, agora adicionando um
 * item ao orçamento em vez de preencher os campos da Calculadora.
 */

import { calculateQuote } from '../core/pricing.js';
import { formatGrams, sourceLabel, variantValues } from '../core/importer.js';
import { makerworldItem } from '../core/makerworld.js';
import { parseQuantity, parseTime, parseWeight } from '../core/parser.js';
import { state } from '../core/state.js';
import { formatBRL, formatDuration, formatWeight } from '../core/format.js';

/** @type {any} */
let result = null;
/** @type {'stlflix'|'makerworld'|null} */
let mode = null;
/** @type {string|null} */
let selectedProfileId = null;
/** @type {any} */
let currentProfile = null;
/** @type {Set<number>} */
let selectedPlates = new Set();
/** @type {((payload: any) => void)|null} */
let onAdd = null;
/** @type {(() => number)|null} */
let getQuantity = null;
/** @type {(() => Promise<void>)|null} */
let onRefresh = null;

const element = (id) => document.getElementById(id);

/** @param {number} grams */
function weightLabel(grams) {
	return Number(grams) > 0 ? formatGrams(grams) : '—';
}

/** @param {number} minutes */
function timeLabel(minutes) {
	return Number(minutes) > 0 ? formatDuration(minutes) : '—';
}

function scopeLabel() {
	const quantity = parseQuantity(getQuantity?.() ?? 1);
	return quantity > 1 ? `Preço para ${quantity} un` : 'Preço por peça';
}

function summary(count, one, many) {
	return count === 1 ? one : `${count} ${many}`;
}

/**
 * @param {{weightG: number|null, minutes: number|null}} variant
 */
function quoteFor(variant) {
	const values = variantValues(variant);

	return calculateQuote({
		weightGrams: parseWeight(values.weight),
		minutes: parseTime(values.time),
		quantity: parseQuantity(getQuantity?.() ?? 1),
		filaments: state.filaments,
		selected: [...state.selected],
		config: state.config,
	});
}

/* ------------------------------------------------------------------ STLFlix */

/**
 * @param {any} item
 * @param {any} variant
 * @param {number} index
 */
function stlflixVariantRow(item, variant, index) {
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

	const ready = Boolean(variantValues(variant).weight && variantValues(variant).time);
	button.disabled = !ready;
	if (!ready) button.title = 'Não encontrei peso e tempo desta versão.';

	button.addEventListener('click', () => {
		const values = variantValues(variant);
		addToBatch({
			source: 'stlflix',
			url: result.url,
			title: result.title,
			profileId: null,
			profileTitle: '',
			profileCover: null,
			items: [
				{
					id: `stlflix:${item.id}:${index}`,
					source: 'stlflix',
					title: `${item.title} — ${variant.label}`,
					subtitle: sourceLabel(result.source),
					weightG: parseWeight(values.weight),
					minutes: parseTime(values.time),
					thumbnail: item.thumbnail,
					profileId: null,
					plateIndex: null,
					url: item.url,
				},
			],
		});
	});

	return button;
}

/** @param {any} item */
function stlflixItemCard(item) {
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
	meta.textContent = item.multipart
		? `Multipartes · ${summary(item.variants.length, '1 versão', 'versões')}`
		: summary(item.variants.length, '1 versão', 'versões');

	heading.append(title, meta);
	head.append(heading);

	const list = document.createElement('div');
	list.className = 'variant-list';
	item.variants.forEach((variant, index) =>
		list.append(stlflixVariantRow(item, variant, index)),
	);

	card.append(head, list);
	return card;
}

function renderStlflix() {
	const list = element('importItems');
	const plates = element('importPlates');
	const footer = element('importFooter');
	const refresh = element('importRefresh');
	const title = element('importTitle');
	const subtitle = element('importSubtitle');
	const hint = element('importHint');
	if (!list || !plates || !footer || !title || !subtitle || !hint) return;

	plates.hidden = true;
	plates.replaceChildren();
	footer.hidden = true;
	if (refresh) refresh.hidden = true;

	const total = result.items.reduce((count, item) => count + item.variants.length, 0);

	title.textContent = result.kind === 'drop' ? 'Escolha o modelo' : 'Escolha a versão';
	subtitle.textContent = `${result.title} · ${summary(total, '1 versão', 'versões')}`;
	hint.textContent = `${scopeLabel()} · ${sourceLabel(result.source)}`;

	list.hidden = false;
	list.className = 'import-items';
	list.replaceChildren(...result.items.map(stlflixItemCard));
}

/* ---------------------------------------------------------------- MakerWorld */

/**
 * @param {any} profile
 */
function profileRow(profile) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'profile-option';
	button.dataset.profileId = profile.id;

	const image = document.createElement('img');
	image.className = 'profile-thumb';
	image.alt = '';
	image.loading = 'lazy';
	image.decoding = 'async';
	if (profile.cover) {
		image.src = profile.cover;
		image.addEventListener('error', () => image.remove());
		button.append(image);
	}

	const info = document.createElement('span');
	info.className = 'profile-info';

	const title = document.createElement('span');
	title.className = 'profile-title';
	title.textContent = profile.title;

	const meta = document.createElement('span');
	meta.className = 'profile-meta';
	meta.textContent =
		profile.plates.length === 0
			? 'Sem dados de prato'
			: [
					summary(profile.plates.length, '1 prato', 'pratos'),
					formatWeight(profile.weightG),
					formatDuration(profile.minutes),
				].join(' · ');

	info.append(title, meta);
	button.append(info);

	const disabled = profile.plates.length === 0;
	button.disabled = disabled;
	if (disabled) {
		button.title = 'Esse perfil não informa peso e tempo dos pratos.';
	}

	if (profile.id === selectedProfileId) {
		button.classList.add('is-selected');
		button.setAttribute('aria-current', 'true');
	}

	button.addEventListener('click', () => renderPlates(profile));
	return button;
}

function renderProfiles() {
	const list = element('importItems');
	const plates = element('importPlates');
	const footer = element('importFooter');
	const refresh = element('importRefresh');
	const title = element('importTitle');
	const subtitle = element('importSubtitle');
	const hint = element('importHint');
	if (!list || !plates || !footer || !title || !subtitle || !hint) return;

	currentProfile = null;
	plates.hidden = true;
	plates.replaceChildren();
	footer.hidden = true;

	if (refresh) {
		refresh.hidden = !onRefresh;
		refresh.disabled = false;
		refresh.textContent = 'Atualizar dados';
	}

	title.textContent = 'Escolha o perfil';
	subtitle.textContent = `${result.title} · ${summary(
		result.profiles.length,
		'1 perfil',
		'perfis',
	)}`;
	hint.textContent = `${scopeLabel()} · MakerWorld`;

	list.hidden = false;
	list.className = 'import-items profile-list';
	list.replaceChildren(...result.profiles.map(profileRow));

	scrollToSelected();
}

function scrollToSelected() {
	const selected = document.querySelector('.profile-option.is-selected');
	if (selected instanceof HTMLElement) {
		requestAnimationFrame(() => selected.scrollIntoView({ block: 'nearest' }));
	}
}

/**
 * @param {any} profile
 */
function renderPlates(profile) {
	const list = element('importItems');
	const plates = element('importPlates');
	const footer = element('importFooter');
	const refresh = element('importRefresh');
	const title = element('importTitle');
	const subtitle = element('importSubtitle');
	const hint = element('importHint');
	if (!list || !plates || !footer || !title || !subtitle || !hint) return;

	currentProfile = profile;
	selectedPlates = new Set();

	title.textContent = 'Escolha os pratos';
	subtitle.textContent = profile.title;
	hint.textContent = [
		summary(profile.plates.length, '1 prato', 'pratos'),
		formatWeight(profile.weightG),
		formatDuration(profile.minutes),
	]
		.filter((part) => part && part !== '—')
		.join(' · ');

	if (refresh) refresh.hidden = true;

	list.hidden = true;
	list.replaceChildren();

	plates.hidden = false;
	plates.replaceChildren(...profile.plates.map(plateCard));

	footer.hidden = false;
	updateAddButton();

	if (profile.plates.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'chips-empty';
		empty.textContent = 'Esse perfil não informa peso e tempo dos pratos.';
		plates.append(empty);
	}
}

/**
 * @param {any} plate
 */
function plateCard(plate) {
	const label = document.createElement('label');
	label.className = 'plate-card';
	label.dataset.plateIndex = String(plate.index);

	const input = document.createElement('input');
	input.type = 'checkbox';
	input.className = 'plate-check';
	input.value = String(plate.index);
	input.setAttribute('aria-label', `${plate.title}, ${weightLabel(plate.weightG)}, ${timeLabel(plate.minutes)}`);

	const thumb = document.createElement('span');
	thumb.className = 'plate-thumb-wrap';
	if (plate.thumbnail) {
		const image = document.createElement('img');
		image.className = 'plate-thumb';
		image.src = plate.thumbnail;
		image.alt = '';
		image.loading = 'lazy';
		image.decoding = 'async';
		image.addEventListener('error', () => image.remove());
		thumb.append(image);
	}

	const body = document.createElement('span');
	body.className = 'plate-body';

	const title = document.createElement('span');
	title.className = 'plate-title';
	title.textContent = plate.title;

	const meta = document.createElement('span');
	meta.className = 'plate-meta';
	meta.textContent = `${weightLabel(plate.weightG)} · ${timeLabel(plate.minutes)}`;

	body.append(title, meta);
	label.append(input, thumb, body);

	input.addEventListener('change', () => {
		if (input.checked) selectedPlates.add(plate.index);
		else selectedPlates.delete(plate.index);
		label.classList.toggle('is-checked', input.checked);
		updateAddButton();
	});

	return label;
}

function updateAddButton() {
	const button = /** @type {HTMLButtonElement} */ (element('importAdd'));
	if (!button) return;

	const count = selectedPlates.size;
	button.disabled = count === 0;
	button.textContent =
		count === 0 ? 'Adicionar pratos' : `Adicionar ${count} ${count === 1 ? 'prato' : 'pratos'}`;
}

function addSelectedPlates() {
	if (!currentProfile || selectedPlates.size === 0) return;

	const items = currentProfile.plates
		.filter((plate) => selectedPlates.has(plate.index))
		.map((plate) => makerworldItem(result, currentProfile, plate));

	addToBatch({
		source: 'makerworld',
		url: result.url,
		title: result.title,
		profileId: currentProfile.id,
		profileTitle: currentProfile.title,
		profileCover: currentProfile.cover,
		profileLabel: currentProfile.title,
		items,
	});
}

/* --------------------------------------------------------------------- folha */

function addToBatch(payload) {
	onAdd?.(payload);
	closeSheet();
}

function openSheet() {
	const dialog = /** @type {HTMLDialogElement} */ (element('importSheet'));
	if (!dialog) return;
	if (dialog.open) return;

	if (typeof dialog.showModal === 'function') dialog.showModal();
	else dialog.setAttribute('open', '');
}

function closeSheet() {
	const dialog = /** @type {HTMLDialogElement} */ (element('importSheet'));
	if (!dialog) return;

	if (typeof dialog.close === 'function') dialog.close();
	else dialog.removeAttribute('open');
}

async function refresh() {
	if (!onRefresh) return;

	const button = /** @type {HTMLButtonElement} */ (element('importRefresh'));
	if (button) {
		button.disabled = true;
		button.textContent = 'Atualizando…';
	}

	try {
		await onRefresh();
	} finally {
		if (button) {
			button.disabled = false;
			button.textContent = 'Atualizar dados';
		}
	}
}

/**
 * @param {{
 *   result: any,
 *   onAdd: (payload: any) => void,
 *   getQuantity?: () => string|number,
 *   onRefresh?: () => Promise<void>,
 * }} options
 */
export function openImportSheet({ result: payload, onAdd: add, getQuantity: quantity, onRefresh: refreshHandler }) {
	result = payload;
	mode = payload.source === 'makerworld' ? 'makerworld' : 'stlflix';
	onAdd = add;
	getQuantity = quantity ?? (() => 1);
	onRefresh = refreshHandler ?? null;
	currentProfile = null;
	selectedPlates = new Set();

	if (mode === 'makerworld') {
		const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
		const preselected = profiles.find((profile) => profile.id === payload.selectedProfileId);
		selectedProfileId = preselected?.id ?? (profiles.length === 1 ? profiles[0].id : null);

		if (profiles.length === 1 && profiles[0].plates.length > 0) renderPlates(profiles[0]);
		else renderProfiles();
	} else {
		selectedProfileId = null;
		renderStlflix();
	}

	openSheet();
	if (mode === 'makerworld' && currentProfile === null) scrollToSelected();
}

export function initImportSheet() {
	element('importClose')?.addEventListener('click', closeSheet);
	element('importBack')?.addEventListener('click', () => {
		if (mode === 'makerworld') renderProfiles();
	});
	element('importAdd')?.addEventListener('click', addSelectedPlates);
	element('importRefresh')?.addEventListener('click', refresh);

	// Clique no fundo escurecido (que conta como clique no próprio diálogo).
	const dialog = element('importSheet');
	dialog?.addEventListener('click', (event) => {
		if (event.target === dialog) closeSheet();
	});
}
