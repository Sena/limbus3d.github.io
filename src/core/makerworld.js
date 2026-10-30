/**
 * makerworld.js — link do MakerWorld vira perfis e pratos.
 *
 * O servidor (minicommerce) consulta a API do MakerWorld e devolve peso e
 * tempo já em gramas e minutos. Aqui ficam a validação do link, o recorte do
 * perfil indicado na URL e a defesa contra dados fora do contrato.
 */

import { ImportRequestError } from './import-error.js';

const HOSTS = new Set(['makerworld.com', 'www.makerworld.com']);

/** `makerworld.com/pt/models/2834113-alien-...` (locale e slug opcionais). */
const PATH_PATTERN =
	/^\/(?:(?<locale>[a-z]{2}(?:[-_][a-z]{2})?)\/)?models\/(?<id>\d+)(?:-(?<slug>[a-z0-9][a-z0-9-]*))?\/?$/i;

const PROFILE_ANCHOR = /^profileId-(\d+)$/i;

/**
 * Valida e canonicaliza um link do MakerWorld.
 * @param {unknown} raw
 * @returns {{designId: string, slug: string|null, locale: string, profileId: string|null, url: string} | null}
 */
export function parseMakerworldLink(raw) {
	let url;
	try {
		url = new URL(String(raw ?? '').trim());
	} catch {
		return null;
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (!HOSTS.has(url.hostname.toLowerCase())) return null;

	const groups = PATH_PATTERN.exec(url.pathname)?.groups;
	if (!groups?.id) return null;

	const locale = localeOf(groups.locale);
	const slug = groups.slug ? groups.slug.toLowerCase() : null;
	const profileId =
		digits(url.searchParams.get('profiled')) ??
		digits(PROFILE_ANCHOR.exec(url.hash.replace(/^#/, ''))?.[1]);

	return {
		designId: groups.id,
		slug,
		locale,
		profileId,
		url: `https://makerworld.com/${locale}/models/${groups.id}${slug ? `-${slug}` : ''}`,
	};
}

/**
 * @param {string|undefined} raw
 * @returns {string}
 */
function localeOf(raw) {
	const value = String(raw ?? 'pt').toLowerCase();
	return value === 'pt-br' ? 'pt' : value;
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function digits(raw) {
	const text = String(raw ?? '').trim();
	return /^\d+$/.test(text) ? text : null;
}

/**
 * Confere o contrato do MakerWorld e deixa perfis e pratos prontos para a tela.
 * @param {any} payload
 */
export function hydrateMakerworldPayload(payload) {
	if (!payload || typeof payload !== 'object' || !Array.isArray(payload.profiles)) {
		throw new ImportRequestError(
			'invalid_response',
			'O importador devolveu uma resposta inesperada.',
		);
	}

	const profiles = payload.profiles
		.map((profile, index) => normalizeProfile(profile, index))
		.filter(Boolean);

	if (profiles.length === 0) {
		throw new ImportRequestError(
			'empty',
			'Esse modelo não tem perfis de impressão com peso e tempo.',
		);
	}

	const selectedProfileId = text(payload.selectedProfileId);

	return {
		source: 'makerworld',
		kind: 'model',
		title: text(payload.title) ?? 'Importar do MakerWorld',
		url: httpsUrl(payload.url) ?? '',
		selectedProfileId,
		profiles,
	};
}

/**
 * @param {any} value
 * @param {number} index
 */
function normalizeProfile(value, index) {
	if (!value || typeof value !== 'object') return null;

	const id = text(value.id);
	if (!id) return null;

	const plates = Array.isArray(value.plates)
		? value.plates.map(normalizePlate).filter(Boolean).sort((a, b) => a.index - b.index)
		: [];

	const weight = positive(value.weightG);
	const minutes = positive(value.minutes);

	return {
		id,
		title: text(value.title) ?? `Perfil ${index + 1}`,
		cover: httpsUrl(value.cover),
		weightG: weight,
		minutes: minutes === null ? null : Math.round(minutes),
		needAms: value.needAms === true,
		colorCount: Math.max(0, Math.round(positive(value.colorCount) ?? 0)),
		plates,
	};
}

/**
 * @param {any} value
 */
function normalizePlate(value) {
	if (!value || typeof value !== 'object') return null;

	const index = Math.round(positive(value.index) ?? 0);
	if (index <= 0) return null;

	const weight = positive(value.weightG);
	const minutes = positive(value.minutes);
	if (weight === null || minutes === null) return null;

	return {
		index,
		title: text(value.title) ?? `Prato ${index}`,
		weightG: weight,
		minutes: Math.round(minutes),
		thumbnail: httpsUrl(value.thumbnail),
	};
}

/**
 * Item do orçamento correspondente a um prato.
 * @param {ReturnType<typeof hydrateMakerworldPayload>} result
 * @param {any} profile
 * @param {any} plate
 */
export function makerworldItem(result, profile, plate) {
	return {
		id: `mw:${profile.id}:${plate.index}`,
		source: 'makerworld',
		title: plate.title,
		subtitle: profile.title,
		weightG: plate.weightG,
		minutes: plate.minutes,
		thumbnail: plate.thumbnail,
		profileId: profile.id,
		plateIndex: plate.index,
		url: result.url,
	};
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function text(value) {
	if (typeof value !== 'string' && typeof value !== 'number') return null;
	const trimmed = String(value).trim();
	return trimmed ? trimmed : null;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function positive(value) {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function httpsUrl(value) {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}
