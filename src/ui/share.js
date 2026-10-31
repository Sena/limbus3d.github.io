/**
 * share.js — link da configuração, cópia e QR Code.
 */

import { EVENTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { buildShareUrl } from '../core/url.js';
import { on } from '../core/bus.js';
import { getSnapshot } from './settings.js';
import { toast } from './notice.js';

/* O gerador de QR Code só é baixado quando alguém pede um QR — no telefone ele
 * não entra no carregamento inicial. */
const QRCODE_SRC = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
/** @type {Promise<void> | null} */
let qrPromise = null;

function ensureQrCode() {
	if (globalThis.QRCode) return Promise.resolve();

	qrPromise ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = QRCODE_SRC;
		script.addEventListener('load', () => {
			if (globalThis.QRCode) resolve();
			else reject(new Error('QRCode indisponível'));
		});
		script.addEventListener('error', () => reject(new Error('QRCode não carregou')));
		document.head.append(script);
	}).catch((error) => {
		qrPromise = null;
		throw error;
	});

	return qrPromise;
}

/** Reconstrói o link a partir da configuração atual. */
export function refreshLink() {
	const output = /** @type {HTMLTextAreaElement} */ (document.getElementById('linkOutput'));
	state.shareUrl = buildShareUrl(globalThis.location, getSnapshot());
	if (output) output.value = state.shareUrl;
}

async function copyLink() {
	const output = /** @type {HTMLTextAreaElement} */ (document.getElementById('linkOutput'));

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(state.shareUrl);
		} else if (output) {
			output.select();
			document.execCommand('copy');
		}
		toast('Link copiado.');
	} catch {
		output?.select();
		toast('Não foi possível copiar. Selecione o link e copie à mão.');
	}
}

async function showQrCode() {
	const container = document.getElementById('qrContainer');
	if (!container) return;

	try {
		await ensureQrCode();
	} catch {
		toast('O gerador de QR Code não carregou. Verifique a conexão.');
		return;
	}

	if (!state.shareUrl) refreshLink();

	container.replaceChildren();
	new globalThis.QRCode(container, {
		text: state.shareUrl,
		width: 168,
		height: 168,
		correctLevel: globalThis.QRCode.CorrectLevel?.M,
	});

	container.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function initShare() {
	const copyRef = document.getElementById('copyLink') || document.getElementById('mobileCopyLink');
	const qrRef = document.getElementById('qrButton') || document.getElementById('mobileQrButton');

	copyRef?.addEventListener('click', copyLink);
	qrRef?.addEventListener('click', showQrCode);

	for (const event of [EVENTS.CONFIG_CHANGED, EVENTS.FILAMENTS_CHANGED]) {
		on(event, refreshLink);
	}

	refreshLink();
}
