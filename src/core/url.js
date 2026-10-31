/**
 * url.js — link compartilhável e parâmetros de URL.
 *
 * Dois formatos convivem:
 *   ?data=<base64 do JSON>   configuração completa (filamentos + custos)
 *   ?q= &w= &t=              atalhos para quantidade, peso e tempo
 */

/**
 * Codifica um objeto em base64 seguro para UTF-8.
 * O btoa puro quebra em qualquer caractere fora do latin-1, e nome de
 * filamento com emoji é perfeitamente possível.
 * @param {unknown} data
 * @returns {string}
 */
export function encodeSettings(data) {
	const bytes = new TextEncoder().encode(JSON.stringify(data));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * Decodifica o que sai de `encodeSettings`.
 * Links gerados pela versão antiga passaram pelo btoa direto (latin-1); quando
 * a decodificação UTF-8 não fecha, o texto cru é o valor correto.
 * @param {string} encoded
 * @returns {any}
 */
export function decodeSettings(encoded) {
	const binary = atob(encoded);
	const text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
	const data = JSON.parse(text.includes('\uFFFD') ? binary : text);
	if (data && typeof data === 'object' && data._compact) {
		return data;
	}
	return data;
}

/**
 * Monta o link que carrega esta configuração.
 * @param {{origin: string, pathname: string}} location
 * @param {unknown} settings
 * @returns {string}
 */
export function buildShareUrl(location, settings) {
	return `${location.origin}${location.pathname}?data=${encodeSettings(settings)}`;
}

/**
 * Lê os parâmetros aceitos na URL.
 * @param {string} search string de busca, com ou sem "?"
 * @returns {{settings: any, quantity: string|null, weight: string|null, time: string|null}}
 */
export function readUrlInputs(search) {
	const params = new URLSearchParams(search ?? '');
	const result = {
		settings: null,
		quantity: null,
		weight: null,
		time: null,
	};

	const raw = params.get('data');
	if (raw) {
		try {
			result.settings = decodeSettings(raw);
		} catch {
			console.warn('Link de configuração inválido, seguindo com os valores salvos.');
		}
	}

	const read = (key) => {
		const value = params.get(key);
		return value === null || value === '' ? null : value;
	};

	result.quantity = read('q');
	result.weight = read('w');
	result.time = read('t');

	return result;
}
