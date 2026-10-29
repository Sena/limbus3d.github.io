/**
 * config.js — campos de configuração e valores padrão.
 * Os padrões precisam ser suficientes para calcular sem nenhum ajuste: quem
 * chega pela primeira vez informa peso e tempo e já recebe um preço.
 */

/** Rota do minicommerce que resolve links de modelo/drop do STLFlix. */
export const IMPORT_ENDPOINT = 'https://limbus.com.br/api/import';

/** Campos que vivem na aba de configurações e são persistidos. */
export const CONFIG_FIELDS = Object.freeze([
	'energyKwh',
	'consumoKw',
	'markup',
	'machineCost',
	'hourRate',
	'selEst',
	'selImp',
	'failureRate',
	'postProcessing',
	'taxRate',
	'cardFeeRate',
]);

/** @type {Record<string, string>} */
export const LEGACY_FIELD_ALIAS = Object.freeze({
	markup: 'margin',
});

/** Valores padrão, em string, como saem dos campos do formulário. */
export const DEFAULT_CONFIG = Object.freeze({
	energyKwh: '0.92',
	consumoKw: '0.07',
	markup: '2.0',
	machineCost: '8',
	hourRate: '2.00',
	selEst: 'outros',
	selImp: 'outros',
	failureRate: '5',
	postProcessing: '0',
	taxRate: '0',
	cardFeeRate: '0',
});

/** Filamento criado quando não há nada salvo, para o app nunca abrir vazio. */
export const DEFAULT_FILAMENT = Object.freeze({
	name: 'Cor padrão',
	price: 120,
	weight: 1000,
});

/** @returns {Record<string, string>} uma cópia limpa dos padrões. */
export function createDefaultConfig() {
	return { ...DEFAULT_CONFIG };
}

/**
 * @param {any} data
 * @param {string} field
 * @returns {unknown}
 */
export function readConfigField(data, field) {
	if (!data || typeof data !== 'object') return undefined;

	const value = data[field];
	if (value !== undefined && value !== null) return value;

	const legacy = LEGACY_FIELD_ALIAS[field];
	if (!legacy) return undefined;

	const legacyValue = data[legacy];
	return legacyValue === undefined || legacyValue === null ? undefined : legacyValue;
}

/**
 * Diz se a configuração ainda é a de fábrica.
 * É isso que decide se o convite para refinar continua aparecendo.
 * @param {Record<string, unknown>} config
 * @returns {boolean}
 */
export function isDefaultConfig(config) {
	if (!config) return true;
	return CONFIG_FIELDS.every((field) => String(config[field]) === DEFAULT_CONFIG[field]);
}
