/**
 * notice.js — avisos breves no rodapé da tela.
 * Substitui o alert() nativo: informa sem travar a interação.
 */

/** @type {ReturnType<typeof setTimeout> | null} */
let timer = null;

/**
 * @param {string} message
 * @param {number} [duration] em milissegundos
 */
export function toast(message, duration = 2800) {
	const element = document.getElementById('toast');
	if (!element) return;

	element.textContent = message;
	element.hidden = false;

	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		element.hidden = true;
	}, duration);
}
