/**
 * calculator.js — o simulador em si.
 * Reage a qualquer mudança de entrada, de filamento ou de configuração e
 * recalcula o preço. Não guarda estado próprio: lê do estado compartilhado.
 */

import { EVENTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { calculateQuote } from '../core/pricing.js';
import { parseQuantity, parseTime, parseWeight } from '../core/parser.js';
import { formatBRL } from '../core/format.js';
import { on } from '../core/bus.js';

const amount = (id) => document.getElementById(id);

/** Lê os campos e mantém o estado alinhado com o que está na tela. */
export function readInputs() {
	state.inputs = {
		quantity: /** @type {HTMLInputElement} */ (amount('quantity'))?.value ?? '1',
		weight: /** @type {HTMLInputElement} */ (amount('weight'))?.value ?? '',
		time: /** @type {HTMLInputElement} */ (amount('minutes'))?.value ?? '',
	};
	return state.inputs;
}

/**
 * @param {ReturnType<typeof calculateQuote>} quote
 */
function render(quote) {
	const empty = amount('calcEmpty');
	const result = amount('calcResult');
	const price = amount('finalPrice');
	if (!empty || !result || !price) return;

	if (!quote) {
		empty.hidden = false;
		result.hidden = true;
		state.quote = null;
		return;
	}

	empty.hidden = true;
	result.hidden = false;

	const formatted = formatBRL(quote.total);
	if (price.textContent !== formatted) {
		price.textContent = formatted;
		// Reinicia a animação só quando o número muda de verdade.
		price.classList.remove('is-updated');
		void price.offsetWidth;
		price.classList.add('is-updated');
	}

	const hint = amount('refineHint');
	if (hint) hint.hidden = state.clientMode || state.settingsSeen;
}

export function recalculate() {
	const inputs = readInputs();

	state.quote = calculateQuote({
		weightGrams: parseWeight(inputs.weight),
		minutes: parseTime(inputs.time),
		quantity: parseQuantity(inputs.quantity),
		filaments: state.filaments,
		selected: [...state.selected],
		config: state.config,
	});

	render(state.quote);
}

export function initCalculator() {
	const form = document.getElementById('panel-calc');
	form?.addEventListener('input', recalculate);

	for (const event of [EVENTS.CONFIG_CHANGED, EVENTS.FILAMENTS_CHANGED, EVENTS.SELECTION_CHANGED]) {
		on(event, recalculate);
	}

	recalculate();
}
