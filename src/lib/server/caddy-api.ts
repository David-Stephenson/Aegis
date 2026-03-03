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

async function getRemoteIpList(path: string): Promise<string[]> {
	const response = await requestCaddy(path, { method: 'GET' });
	const payload = (await response.json()) as unknown;

	if (!Array.isArray(payload) || payload.some((entry) => typeof entry !== 'string')) {
		throw new Error(`Expected string[] response from Caddy at ${path}`);
	}

	return payload;
}

async function putRemoteIpList(path: string, values: string[]): Promise<void> {
	await requestCaddy(path, {
		method: 'PUT',
		body: JSON.stringify(values)
	});
}

function dedupeAndSort(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export async function allowlistIp(path: string, ip: string): Promise<void> {
	const current = await getRemoteIpList(path);
	const next = dedupeAndSort([...current, ip]);
	await putRemoteIpList(path, next);
}

export async function removeAllowlistIp(path: string, ip: string): Promise<void> {
	const current = await getRemoteIpList(path);
	const next = current.filter((entry) => entry !== ip);
	await putRemoteIpList(path, dedupeAndSort(next));
}
