import { appEnv } from '$lib/server/env';

const defaultHeaders = {
	Authorization: `Bearer ${appEnv.CADDY_API_TOKEN}`,
	'Content-Type': 'application/json'
};

type CaddyApiErrorDetails = {
	status: number;
	body: string;
};

class CaddyApiError extends Error {
	public readonly details: CaddyApiErrorDetails;

	constructor(message: string, details: CaddyApiErrorDetails) {
		super(message);
		this.details = details;
	}
}

async function requestCaddy(path: string, init: RequestInit): Promise<Response> {
	const maxAttempts = 3;
	let attempt = 0;

	while (attempt < maxAttempts) {
		attempt += 1;
		const response = await fetch(`${appEnv.CADDY_API_BASE_URL}${path}`, {
			...init,
			headers: {
				...defaultHeaders,
				...init.headers
			}
		});

		if (response.ok) {
			return response;
		}

		if (attempt < maxAttempts && response.status >= 500) {
			await new Promise((resolve) => setTimeout(resolve, attempt * 150));
			continue;
		}

		const body = await response.text();
		throw new CaddyApiError(`Caddy API request failed for ${path}`, {
			status: response.status,
			body
		});
	}

	throw new Error('Unreachable retry state');
}

type RemoteIpPayload =
	| {
			shape: 'array';
			values: string[];
	  }
	| {
			shape: 'ranges_object';
			values: string[];
	  };

function parseStringArray(path: string, value: unknown): string[] {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(`Expected string[] response from Caddy at ${path}`);
	}

	return value;
}

async function getRemoteIpList(path: string): Promise<RemoteIpPayload> {
	const response = await requestCaddy(path, { method: 'GET' });
	const payload = (await response.json()) as unknown;

	if (Array.isArray(payload)) {
		return {
			shape: 'array',
			values: parseStringArray(path, payload)
		};
	}

	if (payload && typeof payload === 'object' && 'ranges' in payload) {
		const ranges = (payload as { ranges: unknown }).ranges;
		return {
			shape: 'ranges_object',
			values: parseStringArray(path, ranges)
		};
	}

	throw new Error(`Expected string[] or { ranges: string[] } response from Caddy at ${path}`);
}

async function putRemoteIpList(path: string, payload: RemoteIpPayload): Promise<void> {
	const body =
		payload.shape === 'array' ? JSON.stringify(payload.values) : JSON.stringify({ ranges: payload.values });

	await requestCaddy(path, {
		method: 'PUT',
		body
	});
}

function dedupeAndSort(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export async function allowlistIp(path: string, ip: string): Promise<void> {
	const current = await getRemoteIpList(path);
	const next = dedupeAndSort([...current.values, ip]);
	await putRemoteIpList(path, {
		...current,
		values: next
	});
}

export async function removeAllowlistIp(path: string, ip: string): Promise<void> {
	const current = await getRemoteIpList(path);
	const next = dedupeAndSort(current.values.filter((entry) => entry !== ip));
	await putRemoteIpList(path, {
		...current,
		values: next
	});
}
