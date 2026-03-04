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

export function createCookieStore(seed: CookieJar = {}): Cookies {
	const jar = new Map(Object.entries(seed));

	return {
		get(name: string): string | undefined {
			return jar.get(name);
		},
		getAll(): Array<{ name: string; value: string }> {
			return [...jar.entries()].map(([name, value]) => ({ name, value }));
		},
		set(name: string, value: string): void {
			jar.set(name, value);
		},
		delete(name: string): void {
			jar.delete(name);
		},
		serialize(name: string, value: string): string {
			return `${name}=${value}`;
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
