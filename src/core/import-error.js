/**
 * import-error.js — erro com mensagem pronta para o toast.
 * Vive em arquivo próprio porque o resolvedor do STLFlix e o do MakerWorld
 * precisam dele sem se importarem em cadeia.
 */

export class ImportRequestError extends Error {
	/**
	 * @param {string} code
	 * @param {string} message
	 * @param {number} [status]
	 */
	constructor(code, message, status = 0) {
		super(message);
		this.name = 'ImportRequestError';
		this.code = code;
		this.status = status;
	}
}
