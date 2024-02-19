// MIT License

// Copyright (c) 2023-2024 Håkan Råberg and Steven Deobald

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice (including the next paragraph) shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/* global BigInt */

function fromJSONLD(x) {
	if (x === null) {
		return x
	}
	if (Object.hasOwn(x, '@type') && Object.hasOwn(x, '@value')) {
		const t = x['@type']
		if (t === 'xsd:date' || t === 'xsd:dateTime') {
			return new Date(x['@value'])
		} else if (t === 'xsd:base64Binary') {
			return Uint8Array.from(atob(x['@value']), m => m.codePointAt(0))
		} else if (t === 'xsd:integer') {
			return BigInt(x['@value'])
		}
	}
	if (Object.hasOwn(x, '@graph')) {
		return x['@graph']
	}
	return x
}

function toJSONLD(x) {
	switch (x.constructor) {
		case Date:
			return { '@type': 'xsd:dateTime', '@value': x.toISOString() }
		case Uint8Array:
			var b = Array.from(x, y => String.fromCodePoint(y)).join('')
			return { '@type': 'xsd:base64Binary', '@value': btoa(b) }
		case BigInt:
			return { '@type': 'xsd:integer', '@value': x.toString() }
		case Array:
			return x.map(toJSONLD)
		case Object:
			return Object.fromEntries(
				Object.entries(x).map(([k, v]) => [k, toJSONLD(v)]),
			)
		default:
			return x
	}
}

/**
 * Endatabas client for the HTTP API
 */
class Endb {
	/**
	 * Create an Endb object (Endatabas client for the HTTP API)
	 * @param {string} [url=http://localhost:3803/sql] - HTTP URL to the Endatabas /sql API
	 * @param {Object} [opt] - HTTP options
	 * @param {string} [opt.accept=application/ld+json] - Accept Header content type
	 * @param {string} [opt.username] - username for HTTP Basic Auth
	 * @param {string} [opt.password] - password for HTTP Basic Auth
	 */
	constructor(
		url = 'http://localhost:3803/sql',
		{ accept = 'application/ld+json', username, password } = {},
	) {
		this.url = url
		this.accept = accept
		this.username = username
		this.password = password
	}

	/**
	 * Execute a SQL statement over HTTP
	 * @param {string} q - SQL query as string or Template Literal
	 * @param {Array|Object} [p] - Positional parameters, named parameters, or an array of either
	 * @param {boolean} [m] - many parameters flag
	 * @param {string} [accept] - Accept Header content type
	 * @returns {Promise<Array>} - Array of documents
	 * @example
	 * // Simple query
	 * sql("SELECT * FROM users;");
	 * // Positional parameters
	 * sql("INSERT INTO users (date, name) VALUES (?, ?);", [new Date(), 'Aaron']);
	 * // Named parameters
	 * sql("INSERT INTO users {date: :d, name: :n};", {d: new Date(), n: 'Aaron'});
	 * // Many positional parameters (batches)
	 * sql("INSERT INTO users (name) VALUES (?);", [['Aaron'], ['Kurt'], ['Cindy']], true);
	 * // Many named parameters (batches)
	 * sql("INSERT INTO users {name: :n};", [{n: 'Judy'}, {n: 'Addis'}], true);
	 * // All parameters (many parameters and accept header)
	 * sql("INSERT INTO users (name) VALUES (?);", [['Aaron'], ['Kurt'], ['Cindy']], true, 'text/csv');
	 * // Named parameters via Template Literals
	 * sql(`INSERT INTO users (name) VALUES (${u});`, [{u: 'Michael'}]);
	 */
	async sql(strings, ...values) {
		let q,
			p = [],
			m = false,
			accept = this.accept
		if (typeof strings === 'string') {
			q = strings
			p = values[0] ?? p
			m = values[1] ?? m
			accept = values[2] ?? accept
		} /* else {
			q = ''
			for (let i = 0; i < strings.length; i++) {
				q += strings[i]
				if (i < values.length) {
					q += '?'
				}
			}
			p = values
		}
 */ else {
			q = strings.reduce(
				(a, v, i) =>
					a + v + (values[i] ? JSON.stringify(values[i]) : ''),
				'',
			)
		}

		const body = new FormData()

		body.append('q', q)
		body.append('p', JSON.stringify(toJSONLD(p)))
		body.append('m', JSON.stringify(m))

		const headers = { Accept: accept }

		if (this.username && this.password) {
			headers['Authorization'] =
				'Basic ' + btoa(this.username + ':' + this.password)
		}

		const response = await fetch(this.url, {
			method: 'POST',
			headers: headers,
			body: body,
		})

		if (response.ok) {
			if (accept === 'text/csv' || accept === 'multipart/mixed') {
				return await response.text()
			} else if (
				accept === 'application/vnd.apache.arrow.file' ||
				accept === 'application/vnd.apache.arrow.stream'
			) {
				return response.body
			} else {
				return JSON.parse(await response.text(), (k, v) =>
					fromJSONLD(v),
				)
			}
		} else {
			throw new Error(
				response.status +
					': ' +
					response.statusText +
					'\n' +
					(await response.text()),
			)
		}
	}
}

/**
 * Endatabas client for the WebSocket API
 */
class EndbWebSocket {
	/**
	 * Create an EndbWebSocket object (Endatabas client for the WebSocket API)
	 * @param {string} [url=ws://localhost:3803/sql] - WebSocket URL to the Endatabas /sql API
	 * @param {Object} [opt] - WebSocket options
	 * @param {string} [opt.ws] - WebSocket implementation
	 * @param {string} [opt.username] - username for Basic Auth
	 * @param {string} [opt.password] - password for Basic Auth
	 */
	constructor(
		url = 'ws://localhost:3803/sql',
		{ ws, username, password } = {},
	) {
		this.ws = ws
		if (typeof ws === 'undefined' && typeof WebSocket !== 'undefined') {
			this.ws = WebSocket
		}
		this.conn = null
		this.url = url
		this.username = username
		this.password = password
		this.id = 1
		this.sentMessages = {}
		this.pendingMessages = []
	}

	close() {
		if (this.conn !== null) {
			this.conn.close()
		}
	}

	/**
	 * Execute a SQL statement over a WebSocket with LD-JSON
	 * @param {string} q - SQL query as string or Template Literal
	 * @param {Array|Object} [p] - Positional parameters, named parameters, or an array of either
	 * @param {boolean} [m] - many parameters flag
	 * @param {string} [accept] - Accept Header content type
	 * @returns {Promise<Array>} - Array of documents
	 * @example
	 * // Simple query
	 * sql("SELECT * FROM users;");
	 * // Positional parameters
	 * sql("INSERT INTO users (date, name) VALUES (?, ?);", [new Date(), 'Aaron']);
	 * // Named parameters
	 * sql("INSERT INTO users {date: :d, name: :n};", {d: new Date(), n: 'Aaron'});
	 * // Many positional parameters (batches)
	 * sql("INSERT INTO users (name) VALUES (?);", [['Aaron'], ['Kurt'], ['Cindy']], true);
	 * // Many named parameters (batches)
	 * sql("INSERT INTO users {name: :n};", [{n: 'Judy'}, {n: 'Addis'}], true);
	 * // All parameters (many parameters and accept header)
	 * sql("INSERT INTO users (name) VALUES (?);", [['Aaron'], ['Kurt'], ['Cindy']], true, 'text/csv');
	 * // Named parameters via Template Literals
	 * sql(`INSERT INTO users (name) VALUES (${u});`, [{u: 'Michael'}]);
	 */
	async sql(strings, ...values) {
		let q,
			p = [],
			m = false
		if (typeof strings === 'string') {
			q = strings
			p = values[0] ?? p
			m = values[1] ?? m
		} else {
			q = ''
			for (let i = 0; i < strings.length; i++) {
				q += strings[i]
				if (i < values.length) {
					q += '?'
				}
			}
			p = values
		}

		if (this.conn === null) {
			if (this.username && this.password) {
				this.conn = new this.ws(
					this.url,
					encodeURIComponent(
						'Basic ' + btoa(this.username + ':' + this.password),
					),
				)
			} else {
				this.conn = new this.ws(this.url)
			}
			this.conn.binaryType = 'arraybuffer'

			this.conn.onerror = event => {
				console.log(event)
			}

			this.conn.onopen = () => {
				while (this.pendingMessages.length > 0) {
					this.conn.send(this.pendingMessages.shift())
				}
			}

			this.conn.onclose = () => {
				for (const promise of Object.values(this.sentMessages)) {
					promise.reject(new Error('Closed'))
				}
			}

			this.conn.onmessage = event => {
				var buffer = new TextDecoder().decode(event.data)
				const message = JSON.parse(buffer, (k, v) => fromJSONLD(v))
				if (message['id'] === null) {
					console.log(message)
				} else {
					const id = message['id'].toString()
					const promise = this.sentMessages[id]
					if (promise !== null) {
						delete this.sentMessages[id]
						if (message.error) {
							promise.reject(
								new Error(message['error']['message']),
							)
						} else {
							promise.resolve(message['result'])
						}
					}
				}
			}
		}

		const message = {
			jsonrpc: '2.0',
			id: this.id++,
			method: 'sql',
			params: { q: q, p: p, m: m },
		}

		let resolve, reject
		const promise = new Promise((res, rej) => {
			resolve = res
			reject = rej
		})

		const id = message.id.toString()
		this.sentMessages[id] = {
			promise: promise,
			resolve: resolve,
			reject: reject,
		}

		const jsonMessage = JSON.stringify(toJSONLD(message))

		if (this.conn.readyState === 1) {
			this.conn.send(jsonMessage)
		} else if (this.conn.readyState === 0) {
			this.pendingMessages.push(jsonMessage)
		} else {
			reject(new Error('Closed'))
		}

		return promise
	}
}

export { Endb, EndbWebSocket }
