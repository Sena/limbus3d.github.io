/**
 * export.js — orçamento em PDF.
 * Usa o jsPDF carregado por CDN; se ele não vier, avisa em vez de falhar mudo.
 */

import { state } from '../core/state.js';
import { formatBRL, formatDuration, formatWeight } from '../core/format.js';
import { toast } from './notice.js';

/* jsPDF vem por CDN sob demanda: o telefone não baixa nem executa a biblioteca
 * só porque abriu a calculadora. */
const JSPDF_SRC = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
/** @type {Promise<any> | null} */
let jspdfPromise = null;

function ensureJsPdf() {
	const ready = globalThis.jspdf?.jsPDF;
	if (ready) return Promise.resolve(ready);

	jspdfPromise ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = JSPDF_SRC;
		script.addEventListener('load', () => {
			const loaded = globalThis.jspdf?.jsPDF;
			if (loaded) resolve(loaded);
			else reject(new Error('jsPDF indisponível'));
		});
		script.addEventListener('error', () => reject(new Error('jsPDF não carregou')));
		document.head.append(script);
	}).catch((error) => {
		jspdfPromise = null;
		throw error;
	});

	return jspdfPromise;
}

/**
 * Cores que o cálculo usou. O filamento marcado vive em `state.selected` (índices
 * da lista), então o PDF precisa traduzir isso em nomes — a cotação só guarda o
 * preço por grama do filamento mais caro, não quais foram.
 */
function colorNames() {
	return [...state.selected]
		.map((index) => String(state.filaments[index]?.name ?? '').trim())
		.filter(Boolean);
}

/** Sem nenhuma marcada, o cálculo usa o primeiro filamento da lista. */
function colorLabel() {
	const names = colorNames();
	if (names.length > 0) return names.join(', ');

	const first = String(state.filaments[0]?.name ?? '').trim();
	if (!first) return '—';

	// Com um filamento só não há o que diferenciar; o sufixo só esclarece quando existe escolha.
	return state.filaments.length > 1 ? `${first} (padrão)` : first;
}

/** Texto que pode quebrar linha, com o cursor do PDF atualizado. */
function writeWrapped(document_, text, line) {
	const lines = document_.splitTextToSize(text, 182);
	document_.setFontSize(10);
	document_.text(lines, 14, line);
	return line + (lines.length - 1) * 5;
}

/** Abre a folha de PDF; só deixa generateBatchPdf rodar quando há orçamento. */
export function openExportSheet() {
	const sheet = /** @type {HTMLDialogElement} */ (document.getElementById('pdfSheet'));
	if (!sheet) return;

	const title = sheet.querySelector('#pdfTitle');
	const note = sheet.querySelector('#pdfNote');
	const download = sheet.querySelector('#pdfDownload');

	if (state.batch.result) {
		if (title) title.textContent = 'Exportar este orçamento';
		if (note) note.textContent = 'Um PDF com o resumo do lote fica pronto para download.';
		if (download) download.disabled = false;
	} else if (state.quote) {
		if (title) title.textContent = 'Exportar este cálculo';
		if (note) note.textContent = 'Um PDF com o cálculo fica pronto para download.';
		if (download) download.disabled = false;
	} else {
		if (title) title.textContent = 'Exportar este orçamento';
		if (note) note.textContent = 'Um PDF com o resumo fica pronto para download.';
		if (download) download.disabled = true;
	}

	fillPdfSummary();

	if (typeof sheet.showModal === 'function') sheet.showModal();
	else sheet.setAttribute('open', '');
}

/** Preenche a prévia do arquivo: o que o PDF vai levar e por quanto. */
function fillPdfSummary() {
	const result = state.batch.result;
	const quote = state.quote;
	const set = (id, text) => {
		const element_ = document.getElementById(id);
		if (element_) element_.textContent = text;
	};

	if (result) {
		set('pdfOrigin', state.batch.title || 'Link importado');
		set('pdfColors', colorLabel());
		set(
			'pdfItems',
			`${result.items.length} ${result.items.length === 1 ? 'prato' : 'pratos'} × ${result.quantity}`,
		);
		set('pdfWeight', formatWeight(result.weightGrams));
		set('pdfTime', formatDuration(result.minutes));
		set('pdfTotal', formatBRL(result.total));
		return;
	}

	if (quote) {
		set('pdfOrigin', 'Calculadora');
		set('pdfColors', colorLabel());
		set('pdfItems', `${quote.quantity} ${quote.quantity === 1 ? 'peça' : 'peças'}`);
		set('pdfWeight', formatWeight(quote.weightGrams * quote.quantity));
		set('pdfTime', formatDuration(quote.minutes * quote.quantity));
		set('pdfTotal', formatBRL(quote.total));
		return;
	}

	set('pdfOrigin', '—');
	set('pdfColors', '—');
	set('pdfItems', '—');
	set('pdfWeight', '—');
	set('pdfTime', '—');
	set('pdfTotal', formatBRL(0));
}

/** A função sempre tenta gerar o lote; quando só há cálculo simples, avisa e gera o cálculo. */
export async function generateBatchPdf() {
	const result = state.batch.result;
	const quote = state.quote;

	if (!result && !quote) {
		toast('Monte um orçamento antes de gerar o PDF.');
		return;
	}

	let jsPDF;
	try {
		jsPDF = await ensureJsPdf();
	} catch {
		toast('O gerador de PDF não carregou. Verifique a conexão.');
		return;
	}

	if (result) {
		doBatchPdf(result, jsPDF);
		return;
	}

	if (quote) {
		doCaclPdf(quote, jsPDF);
		return;
	}

	toast('Não há orçamento ou cálculo para exportar.');
}

function doBatchPdf(result, jsPDF) {
	const document_ = new jsPDF();
	let line = 18;

	document_.setFontSize(16);
	document_.text('Orçamento — impressão 3D', 14, line);

	line += 12;
	document_.setFontSize(11);
	document_.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 14, line);

	line += 8;
	document_.setFontSize(10);
	document_.text(`Origem: ${state.batch.title || 'Link'}`, 14, line, { maxWidth: 182 });

	if (state.batch.profileTitle) {
		line += 8;
		document_.text(`Perfil: ${state.batch.profileTitle}`, 14, line, { maxWidth: 182 });
	}

	line = writeWrapped(document_, `Cores: ${colorLabel()}`, line + 8);

	line += 10;
	document_.setFontSize(12);
	document_.text('Itens', 14, line);

	line += 8;
	document_.setFontSize(10);

	for (const item of result.items) {
		document_.text(
			`${item.title} - ${formatWeight(item.weightG)} · ${formatDuration(item.minutes)} - ${formatBRL(item.quote.total)}`,
			14,
			line,
			{ maxWidth: 182 },
		);
		line += 8;

		if (line > 268) {
			document_.addPage();
			line = 20;
		}
	}

	line += 6;
	document_.setFontSize(11);
	document_.text(`Quantidade: ${result.quantity} de cada`, 14, line);

	line += 8;
	document_.text(`Peso total: ${formatWeight(result.weightGrams)}`, 14, line);

	line += 8;
	document_.text(`Tempo total: ${formatDuration(result.minutes)}`, 14, line);

	line += 8;
	document_.text(`Subtotal: ${formatBRL(result.subtotal)}`, 14, line);

	if (result.showDiscount) {
		line += 8;
		document_.text(`Desconto em lote: -${formatBRL(result.discount)}`, 14, line);
	}

	line += 14;
	document_.setFontSize(14);
	document_.text(`Preço total: ${formatBRL(result.total)}`, 14, line);

	document_.save('orcamento-lote-impressao-3d.pdf');
}

function doCaclPdf(quote, jsPDF) {
	const document_ = new jsPDF();
	let line = 18;

	document_.setFontSize(16);
	document_.text('Cálculo — impressão 3D', 14, line);

	line += 12;
	document_.setFontSize(11);
	document_.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 14, line);

	line += 8;
	document_.text(`Quantidade: ${quote.quantity}`, 14, line);

	line += 8;
	document_.text(`Peso total: ${formatWeight(quote.weightGrams * quote.quantity)}`, 14, line);

	line += 8;
	document_.text(`Tempo total: ${formatDuration(quote.minutes * quote.quantity)}`, 14, line);

	line = writeWrapped(document_, `Cores: ${colorLabel()}`, line + 8);

	line += 14;
	document_.setFontSize(14);
	document_.text(`Preço total: ${formatBRL(quote.total)}`, 14, line);

	document_.save('orcamento-impressao-3d.pdf');
}

export function initExport() {
	document.getElementById('exportPdf')?.addEventListener('click', openExportSheet);

	for (const button of document.querySelectorAll('[data-open-export]')) {
		button.addEventListener('click', openExportSheet);
	}
	document.getElementById('pdfDownload')?.addEventListener('click', generateBatchPdf);
	document.getElementById('pdfClose')?.addEventListener('click', closeExportSheet);
	document.getElementById('pdfCancel')?.addEventListener('click', closeExportSheet);

	const sheet = document.getElementById('pdfSheet');
	if (sheet) {
		sheet.addEventListener('click', (event) => {
			if (event.target === sheet) closeExportSheet();
		});
	}
}

function closeExportSheet() {
	const sheet = /** @type {HTMLDialogElement} */ (document.getElementById('pdfSheet'));
	if (!sheet) return;

	if (typeof sheet.close === 'function') sheet.close();
	else sheet.removeAttribute('open');
}

