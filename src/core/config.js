/**
 * config.js — campos de configuração e valores padrão.
 * Os padrões precisam ser suficientes para calcular sem nenhum ajuste: quem
 * chega pela primeira vez informa peso e tempo e já recebe um preço.
 */

/** Campos que vivem na aba de configurações e são persistidos. */
export const CONFIG_FIELDS = Object.freeze([
	'energyKwh',
	'consumoKw',
	'margin',
	'machineCost',
	'hourRate',
	'selEst',
	'selImp',
	'failureRate',
	'postProcessing',
]);

/** Valores padrão, em string, como saem dos campos do formulário. */
export const DEFAULT_CONFIG = Object.freeze({
	energyKwh: '0.92',
	consumoKw: '0.07',
	margin: '2.0',
	machineCost: '8',
	hourRate: '2.00',
	selEst: 'outros',
	selImp: 'outros',
	failureRate: '5',
	postProcessing: '0',
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
 * Diz se a configuração ainda é a de fábrica.
 * É isso que decide se o convite para refinar continua aparecendo.
 * @param {Record<string, unknown>} config
 * @returns {boolean}
 */
export function isDefaultConfig(config) {
	if (!config) return true;
	return CONFIG_FIELDS.every((field) => String(config[field]) === DEFAULT_CONFIG[field]);
}
