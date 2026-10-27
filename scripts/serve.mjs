/**
 * serve.mjs — servidor estático do projeto, sem dependências.
 *
 *   node scripts/serve.mjs [porta]
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8000);
const HOST = process.env.HOST ?? '127.0.0.1';

/** @type {Record<string, string>} */
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.map': 'application/json; charset=utf-8',
};

/**
 * @param {string} url
 * @returns {string | null} caminho absoluto dentro do projeto, ou null se escapar
 */
function resolvePath(url) {
	const path = decodeURIComponent((url.split('?')[0] ?? '').split('#')[0] ?? '/');
	const relative = normalize(path).replace(/^([/\\])+/, '');
	if (relative.split(/[/\\]/).includes('..')) return null;
	return join(ROOT, relative || 'index.html');
}

const server = createServer(async (request, response) => {
	const target = resolvePath(request.url ?? '/');
	if (!target) {
		response.writeHead(400).end('Caminho inválido');
		return;
	}

	let file = target;
	try {
		const info = await stat(file);
		if (info.isDirectory()) file = join(file, 'index.html');
		await stat(file);
	} catch {
		response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
		return;
	}

	response.writeHead(200, {
		'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
		'cache-control': 'no-cache',
	});
	if (request.method === 'HEAD') {
		response.end();
		return;
	}
	createReadStream(file).pipe(response);
});

server.listen(PORT, HOST, () => {
	const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
	console.log(`Calculadora de Impressão 3D em http://${shown}:${PORT}${sep}`);
});
