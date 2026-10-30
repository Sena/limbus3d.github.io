/**
 * importer.js — link externo vira peso e tempo.
 *
 * O servidor (minicommerce) só busca e normaliza o drop/produto; a extração de
 * peso e tempo vive aqui, junto dos testes da calculadora. A descrição do
 * STLFlix é HTML em português e traz as versões assim:
 *
 *   Tempo de Impressão: Monocolor - 07 Horas 22 Minutos
 *   Consumo de filamento: Monocolor - 137,41 gramas
 */

import { IMPORT_ENDPOINT } from './config.js';
import { ImportRequestError } from './import-error.js';
import { hydrateMakerworldPayload, parseMakerworldLink } from './makerworld.js';

export { ImportRequestError } from './import-error.js';

const STLFLIX_HOST = 'platform.stlflix.com';

/** `platform.stlflix.com/pt-BR/drops/drop-378` ou `.../product/kitten-...`. */
const STLFLIX_PATH =
	/^\/(?:(?<locale>[a-z]{2}(?:[-_][a-z]{2})?)\/)?(?<kind>drops|product)\/(?<slug>[a-z0-9][a-z0-9-]*)\/?$/i;

const HEADING_PATTERN =
	/(tempo de impress[ãa]o|printing time|tiempo de impresi[óo]n|consumo de filamento|filament consumption|altura aproximada|approximate height)/giu;

const TIME_ENTRY_PATTERN =
	/([\p{L}][\p{L}\s-]{0,30}?)\s*[-–—]\s*((?:\d+\s*(?:dias?|days?)\s*,?\s*)?\d+\s*(?:horas?|hours?|hrs?)(?:\s*\d+\s*(?:minutos?|minutes?|mins?))?|\d+\s*(?:minutos?|minutes?|mins?))/giu;

const WEIGHT_ENTRY_PATTERN =
	/([\p{L}][\p{L}\s-]{0,30}?)\s*[-–—]\s*([\d.,]+)\s*(?:gramas?|grams?|g)\b/giu;

/**
 * Diz de qual site é o link e devolve o alvo já validado.
 * @param {unknown} raw
 * @returns {{source: 'stlflix', target: NonNullable<ReturnType<typeof parseStlflixLink>>}
 *   | {source: 'makerworld', target: NonNullable<ReturnType<typeof parseMakerworldLink>>} | null}
 */
export function detectImportSource(raw) {
	const stlflix = parseStlflixLink(raw);
	if (stlflix) return { source: 'stlflix', target: stlflix };

	const makerworld = parseMakerworldLink(raw);
	if (makerworld) return { source: 'makerworld', target: makerworld };

	return null;
}

/**
 * Valida e canonicaliza um link do STLFlix.
 * @param {unknown} raw
 * @returns {{kind: 'drop'|'product', slug: string, locale: string, url: string} | null}
 */
export function parseStlflixLink(raw) {
	let url;
	try {
		url = new URL(String(raw ?? '').trim());
	} catch {
		return null;
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	if (url.hostname.toLowerCase() !== STLFLIX_HOST) return null;

	const groups = STLFLIX_PATH.exec(url.pathname)?.groups;
	if (!groups?.kind || !groups.slug) return null;

	const kind = groups.kind.toLowerCase() === 'drops' ? 'drop' : 'product';
	const locale = localeOf(groups.locale);

	return {
		kind,
		slug: groups.slug,
		locale,
		url: `https://${STLFLIX_HOST}/${locale}/${kind === 'drop' ? 'drops' : 'product'}/${groups.slug}`,
	};
}

/**
 * @param {string|undefined} raw
 * @returns {string}
 */
function localeOf(raw) {
	const language = String(raw ?? 'pt').split(/[-_]/)[0]?.toLowerCase();
	if (language === 'en') return 'en';
	if (language === 'es') return 'es';
	return 'pt-BR';
}

/**
 * Busca o link no resolvedor e devolve os itens já com as versões extraídas.
 * @param {string} raw
 * @param {{fetchImpl?: typeof fetch, signal?: AbortSignal, refresh?: boolean}} [options]
 * @returns {Promise<ReturnType<typeof hydrateImportResult>>}
 */
export async function fetchImport(
	raw,
	{ fetchImpl = globalThis.fetch, signal, refresh = false } = {},
) {
	const detected = detectImportSource(raw);
	if (!detected) {
		throw new ImportRequestError(
			'invalid_url',
			'Cole um link do STLFlix ou do MakerWorld.',
		);
	}

	if (typeof fetchImpl !== 'function') {
		throw new ImportRequestError('network', 'Não consegui falar com o importador.');
	}

	const timeout =
		!signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
			? AbortSignal.timeout(15_000)
			: undefined;

	const refreshSuffix = refresh ? '&refresh=1' : '';

	let response;
	try {
		response = await fetchImpl(
			`${IMPORT_ENDPOINT}?url=${encodeURIComponent(detected.target.url)}${refreshSuffix}`,
			{
				headers: { accept: 'application/json' },
				signal: signal ?? timeout,
			},
		);
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') throw error;
		if (error instanceof Error && error.name === 'TimeoutError') {
			throw new ImportRequestError('timeout', 'O importador demorou demais. Tente de novo.');
		}
		throw new ImportRequestError(
			'network',
			'Não consegui falar com o importador. Tente de novo.',
		);
	}

	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throw new ImportRequestError(
			typeof payload?.error === 'string' ? payload.error : 'http_error',
			typeof payload?.message === 'string'
				? payload.message
				: 'Não consegui importar esse link.',
			response.status,
		);
	}

	return hydrateImportResult(payload);
}

/**
 * Confere o contrato, extrai as versões e deixa tudo pronto para a tela.
 * @param {any} payload
 */
export function hydrateImportResult(payload) {
	if (
		payload &&
		typeof payload === 'object' &&
		(payload.source === 'makerworld' || Array.isArray(payload.profiles))
	) {
		return hydrateMakerworldPayload(payload);
	}

	if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
		throw new ImportRequestError(
			'invalid_response',
			'O importador devolveu uma resposta inesperada.',
		);
	}

	const items = payload.items
		.map((item, index) => normalizeItem(item, index))
		.filter(Boolean);

	if (items.length === 0) {
		throw new ImportRequestError('empty', 'Não encontrei modelos nesse link.');
	}

	return {
		source: typeof payload.source === 'string' ? payload.source : 'stlflix',
		kind: payload.kind === 'drop' ? 'drop' : 'product',
		title: text(payload.title) ?? 'Importar do STLFlix',
		url: httpsUrl(payload.url),
		items,
	};
}

/**
 * @param {any} item
 * @param {number} index
 */
function normalizeItem(item, index) {
	if (!item || typeof item !== 'object') return null;

	const url = httpsUrl(item.url);
	if (!url) return null;

	const description = typeof item.descriptionHtml === 'string' ? item.descriptionHtml : '';
	const declared = Array.isArray(item.variants)
		? item.variants.map(normalizeVariant).filter(Boolean)
		: [];
	const variants = declared.length > 0 ? declared : parseStlflixDescription(description);

	return {
		id: String(item.id ?? index),
		title: text(item.title) ?? 'Modelo sem nome',
		url,
		thumbnail: httpsUrl(item.thumbnail),
		multipart: item.multipart === true,
		descriptionHtml: description,
		variants,
	};
}

/**
 * @param {any} value
 */
function normalizeVariant(value) {
	if (!value || typeof value !== 'object') return null;

	const label = text(value.label);
	if (!label) return null;

	const weightG = Number(value.weightG);
	const minutes = Number(value.minutes);

	return {
		label,
		weightG: Number.isFinite(weightG) && weightG > 0 ? weightG : null,
		minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
	};
}

/**
 * Extrai as versões (Monocolor, Multiparts, Multicolor…) de uma descrição.
 * @param {string} html
 * @returns {Array<{label: string, weightG: number|null, minutes: number|null}>}
 */
export function parseStlflixDescription(html) {
	const text = stripHtml(html);
	if (!text) return [];

	const sections = splitSections(text);
	const variants = new Map();

	/**
	 * @param {string} label
	 */
	const ensure = (label) => {
		const clean = label.replace(/\s+/g, ' ').trim();
		const key = clean
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]/g, '');

		if (!key) return null;
		if (!variants.has(key)) {
			variants.set(key, { label: clean, weightG: null, minutes: null });
		}
		return variants.get(key);
	};

	for (const match of sections.time.matchAll(TIME_ENTRY_PATTERN)) {
		const minutes = durationToMinutes(match[2]);
		if (!minutes) continue;
		const variant = ensure(match[1]);
		if (variant && variant.minutes === null) variant.minutes = minutes;
	}

	for (const match of sections.weight.matchAll(WEIGHT_ENTRY_PATTERN)) {
		const grams = parseGrams(match[2]);
		if (!grams) continue;
		const variant = ensure(match[1]);
		if (variant && variant.weightG === null) variant.weightG = grams;
	}

	return [...variants.values()];
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
	return String(html ?? '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/(p|li|ul|ol|h[1-6]|div|tr|td|th)>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&ndash;/gi, '–')
		.replace(/&mdash;/gi, '—')
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Separa o texto entre "Tempo de Impressão", "Consumo de filamento" e
 * "Altura Aproximada". A seção termina no próximo cabeçalho.
 * @param {string} text
 */
function splitSections(text) {
	const headings = [];

	for (const match of text.matchAll(HEADING_PATTERN)) {
		const kind = /tempo|printing|tiempo/i.test(match[0])
			? 'time'
			: /consumo|filament/i.test(match[0])
				? 'weight'
				: 'height';
		headings.push({ index: match.index, end: match.index + match[0].length, kind });
	}

	/**
	 * @param {'time'|'weight'} kind
	 */
	const section = (kind) => {
		const index = headings.findIndex((heading) => heading.kind === kind);
		if (index < 0) return '';
		const start = headings[index].end;
		const end = headings[index + 1]?.index ?? text.length;
		return text.slice(start, end);
	};

	return { time: section('time'), weight: section('weight') };
}

/**
 * "1 Dia, 06 Horas 28 Minutos" → 1828
 * @param {string} value
 */
function durationToMinutes(value) {
	const days = Number((/(\d+)\s*(?:d[ií]as?|days?)/i.exec(value) ?? [])[1] ?? 0);
	const hours = Number((/(\d+)\s*(?:horas?|hours?|hrs?)/i.exec(value) ?? [])[1] ?? 0);
	const minutes = Number((/(\d+)\s*(?:minutos?|minutes?|mins?)/i.exec(value) ?? [])[1] ?? 0);
	return days * 1440 + hours * 60 + minutes;
}

/**
 * Aceita 137,41 · 1.234,56 · 1,234.56 · 137.41
 * @param {string} value
 */
function parseGrams(value) {
	let text = String(value ?? '').trim();
	if (!text) return 0;

	if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) {
		text = text.replace(/,/g, '');
	} else if (text.includes(',')) {
		text = text.replace(/\./g, '').replace(',', '.');
	} else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
		text = text.replace(/\./g, '');
	}

	const grams = Number(text);
	return Number.isFinite(grams) && grams > 0 ? grams : 0;
}

/**
 * Valores prontos para os campos #weight e #minutes.
 * @param {{weightG: number|null, minutes: number|null}} variant
 */
export function variantValues(variant) {
	const weight = Number(variant?.weightG);
	const minutes = Number(variant?.minutes);

	return {
		weight: Number.isFinite(weight) && weight > 0 ? formatWeightInput(weight) : '',
		time: Number.isFinite(minutes) && minutes > 0 ? formatTimeInput(minutes) : '',
	};
}

/**
 * @param {number} grams
 * @returns {string} ex.: "137,41 g"
 */
export function formatGrams(grams) {
	return `${Number(grams).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g`;
}

/**
 * @param {number} grams
 * @returns {string} ex.: "137,41g"
 */
function formatWeightInput(grams) {
	return `${Number(grams).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}g`;
}

/**
 * @param {number} minutes
 * @returns {string} ex.: "7:22", "30:28"
 */
export function formatTimeInput(minutes) {
	const total = Math.max(0, Math.round(Number(minutes)));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * @param {string} source
 */
export function sourceLabel(source) {
	if (source === 'stlflix') return 'STLFlix';
	if (source === 'makerworld') return 'MakerWorld';
	return 'Link';
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function text(value) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
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
