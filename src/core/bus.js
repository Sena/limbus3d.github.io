/**
 * bus.js — barramento de eventos minúsculo.
 * Evita que os módulos de UI se importem em cadeia: quem muda algo publica,
 * quem depende reage.
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * Assina um evento.
 * @param {string} event
 * @param {Function} handler
 * @returns {() => void} função para cancelar a assinatura
 */
export function on(event, handler) {
	if (!listeners.has(event)) listeners.set(event, new Set());
	listeners.get(event).add(handler);
	return () => off(event, handler);
}

/**
 * Cancela a assinatura de um evento.
 * @param {string} event
 * @param {Function} handler
 */
export function off(event, handler) {
	listeners.get(event)?.delete(handler);
}

/**
 * Publica um evento.
 * @param {string} event
 * @param {unknown} [detail]
 */
export function emit(event, detail) {
	const handlers = listeners.get(event);
	if (!handlers) return;
	for (const handler of [...handlers]) {
		try {
			handler(detail);
		} catch (error) {
			console.error(`Falha ao tratar "${event}"`, error);
		}
	}
}

/** Remove todas as assinaturas. Usado pelos testes. */
export function clear() {
	listeners.clear();
}
