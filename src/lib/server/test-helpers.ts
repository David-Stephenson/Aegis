import type { Cookies, RequestEvent } from '@sveltejs/kit';

type MockSessionUser = {
	id: string;
	email?: string | null;
	name?: string | null;
	groups?: string[];
};

type MockSession = {
	user?: MockSessionUser;
};

type CookieJar = Record<string, string>;
type CookieSetOptions = Parameters<Cookies['set']>[2];
type CookieDeleteOptions = Parameters<Cookies['delete']>[1];
type StoredCookie = {
	name: string;
	value: string;
	options?: CookieSetOptions;
};

function cookieStorageKey(name: string, options?: { path?: string; domain?: string }): string {
	return `${name}|${options?.path ?? ''}|${options?.domain ?? ''}`;
}

function serializeCookie(name: string, value: string, options?: CookieSetOptions): string {
	const parts = [`${name}=${value}`];
	if (options?.path) {
		parts.push(`Path=${options.path}`);
	}
	if (options?.domain) {
		parts.push(`Domain=${options.domain}`);
	}
	if (options?.httpOnly) {
		parts.push('HttpOnly');
	}
	if (options?.secure) {
		parts.push('Secure');
	}
	if (options?.sameSite) {
		const sameSite =
			typeof options.sameSite === 'string'
				? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)
				: options.sameSite;
		if (typeof sameSite === 'string') {
			parts.push(`SameSite=${sameSite}`);
		}
	}
	if (typeof options?.maxAge === 'number') {
		parts.push(`Max-Age=${options.maxAge}`);
	}
	if (options?.expires) {
		parts.push(`Expires=${options.expires.toUTCString()}`);
	}
	return parts.join('; ');
}

export function createCookieStore(seed: CookieJar = {}): Cookies {
	const jar = new Map<string, StoredCookie>();
	for (const [name, value] of Object.entries(seed)) {
		jar.set(cookieStorageKey(name), { name, value });
	}

	return {
		get(name: string): string | undefined {
			const matches = [...jar.values()].filter((cookie) => cookie.name === name);
			return matches.at(-1)?.value;
		},
		getAll(): Array<{ name: string; value: string }> {
			return [...jar.values()].map((cookie) => ({ name: cookie.name, value: cookie.value }));
		},
		set(name: string, value: string, options?: CookieSetOptions): void {
			jar.set(cookieStorageKey(name, options), { name, value, options });
		},
		delete(name: string, options?: CookieDeleteOptions): void {
			if (options?.path || options?.domain) {
				jar.delete(cookieStorageKey(name, options));
				return;
			}
			for (const [key, cookie] of jar.entries()) {
				if (cookie.name === name) {
					jar.delete(key);
				}
			}
		},
		serialize(name: string, value: string, options?: CookieSetOptions): string {
			return serializeCookie(name, value, options);
		}
	} as Cookies;
}

export function createAuthLocals(session: MockSession | null) {
	return {
		auth: async () => (session as Awaited<ReturnType<App.Locals['auth']>>)
	};
}

export function createRequestEvent(options?: {
	method?: string;
	pathname?: string;
	origin?: string;
	headers?: HeadersInit;
	body?: string;
	jsonBody?: unknown;
	formData?: Record<string, string>;
	cookies?: Cookies;
	session?: MockSession | null;
	clientAddress?: string;
}): RequestEvent {
	const url = new URL(options?.pathname ?? 'http://localhost/test');
	const headers = new Headers(options?.headers ?? {});
	if (options?.origin) {
		headers.set('origin', options.origin);
	}

	let body: BodyInit | undefined = options?.body;
	if (options?.jsonBody !== undefined) {
		headers.set('content-type', 'application/json');
		body = JSON.stringify(options.jsonBody);
	}

	if (options?.formData) {
		const form = new FormData();
		for (const [key, value] of Object.entries(options.formData)) {
			form.set(key, value);
		}
		body = form;
	}

	return {
		request: new Request(url, {
			method: options?.method ?? 'GET',
			headers,
			body
		}),
		url,
		params: {},
		route: { id: null },
		locals: createAuthLocals(options?.session ?? null),
		platform: undefined,
		cookies: options?.cookies ?? createCookieStore(),
		setHeaders: () => {},
		getClientAddress: () => options?.clientAddress ?? '127.0.0.1',
		isDataRequest: false,
		isSubRequest: false,
		fetch: fetch
	} as unknown as RequestEvent;
}

export function createAdminSession(overrides?: Partial<MockSessionUser>): MockSession {
	return {
		user: {
			id: 'test-admin',
			email: 'admin@example.com',
			name: 'Admin',
			groups: ['admin'],
			...overrides
		}
	};
}
