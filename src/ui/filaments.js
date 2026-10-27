/**
 * filaments.js — cadastro de filamentos e as cores da peça.
 * Só mexe no estado e publica o que mudou; quem grava é o módulo de
 * configurações, para existir um único escritor no armazenamento.
 */

import { EVENTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { emit } from '../core/bus.js';

const DEFAULT_PRICE = 100;
const DEFAULT_WEIGHT = 1000;

const listElement = () => document.getElementById('filamentList');
const chipsElement = () => document.getElementById('colorChoices');

/**
 * @param {'text'|'number'} type
 * @param {string|number} value
 * @param {string} label
 * @param {(value: string) => void} onChange
 * @returns {HTMLInputElement}
 */
function createInput(type, value, label, onChange) {
	const input = document.createElement('input');
	input.className = 'input';
	input.type = type;
	input.value = String(value ?? '');
	input.setAttribute('aria-label', label);
	if (type === 'number') {
		input.min = '0';
		input.step = 'any';
		input.inputMode = 'decimal';
	}
	input.addEventListener('input', () => onChange(input.value));
	return input;
}

/**
 * @param {number} index
 * @returns {HTMLButtonElement}
 */
function createRemoveButton(index) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'btn btn-icon';
	button.setAttribute('aria-label', `Remover filamento ${index + 1}`);
	button.innerHTML =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
	button.addEventListener('click', () => removeFilament(index));
	return button;
}

export function renderList() {
	const container = listElement();
	if (!container) return;

	container.replaceChildren();

	if (state.filaments.length === 0) {
		const empty = document.createElement('p');
		empty.className = 'chips-empty';
		empty.textContent = 'Nenhum filamento cadastrado ainda.';
		container.append(empty);
		return;
	}

	state.filaments.forEach((filament, index) => {
		const row = document.createElement('div');
		row.className = 'filament-row';
		row.append(
			createInput('text', filament.name, 'Nome do filamento', (value) => updateFilament(index, 'name', value)),
			createInput('number', filament.price, 'Preço do rolo em reais', (value) => updateFilament(index, 'price', value)),
			createInput('number', filament.weight, 'Peso do rolo em gramas', (value) => updateFilament(index, 'weight', value)),
			createRemoveButton(index),
		);
		container.append(row);
	});
}

export function renderChips() {
	const container = chipsElement();
	if (!container) return;

	container.replaceChildren();

	const named = state.filaments
		.map((filament, index) => ({ filament, index }))
		.filter(({ filament }) => String(filament.name ?? '').trim() !== '');

	if (named.length === 0) {
		const empty = document.createElement('span');
		empty.className = 'chips-empty';
		empty.textContent = 'Cadastre um filamento para escolher a cor.';
		container.append(empty);
		return;
	}

	for (const { filament, index } of named) {
		const chip = document.createElement('button');
		chip.type = 'button';
		chip.className = 'chip';
		chip.textContent = filament.name;
		chip.setAttribute('aria-pressed', String(state.selected.has(index)));
		chip.addEventListener('click', () => toggleSelection(index));
		container.append(chip);
	}
}

export function render() {
	renderList();
	renderChips();
}

/**
 * @param {string} [name]
 * @param {string|number} [price]
 * @param {string|number} [weight]
 */
export function addFilament(name = '', price = DEFAULT_PRICE, weight = DEFAULT_WEIGHT) {
	state.filaments.push({ name, price, weight });
	render();
	emit(EVENTS.FILAMENTS_CHANGED);
}

/**
 * Remove o filamento e reindexa a seleção: sem isso, tirar o primeiro item
 * faria as cores marcadas apontarem para o filamento errado.
 * @param {number} index
 */
export function removeFilament(index) {
	if (index < 0 || index >= state.filaments.length) return;
	state.filaments.splice(index, 1);

	const reindexed = new Set();
	for (const selected of state.selected) {
		if (selected < index) reindexed.add(selected);
		else if (selected > index) reindexed.add(selected - 1);
	}
	state.selected = reindexed;

	render();
	emit(EVENTS.FILAMENTS_CHANGED);
	emit(EVENTS.SELECTION_CHANGED);
}

/**
 * @param {number} index
 * @param {'name'|'price'|'weight'} field
 * @param {string} value
 */
export function updateFilament(index, field, value) {
	const filament = state.filaments[index];
	if (!filament) return;

	filament[field] = value;

	// O nome aparece no chip: só ele precisa de redesenho a cada tecla, e
	// redesenhar a lista inteira faria o campo perder o foco.
	if (field === 'name') renderChips();

	emit(EVENTS.FILAMENTS_CHANGED);
}

/**
 * @param {number} index
 */
export function toggleSelection(index) {
	if (state.selected.has(index)) state.selected.delete(index);
	else state.selected.add(index);

	renderChips();
	emit(EVENTS.SELECTION_CHANGED);
}

/**
 * @param {import('../core/pricing.js').Filament[]} filaments
 */
export function setFilaments(filaments) {
	state.filaments = Array.isArray(filaments) ? filaments : [];
	state.selected = new Set();
}

export function initFilaments() {
	document.getElementById('addFilament')?.addEventListener('click', () => addFilament());
	render();
}
