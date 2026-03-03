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

function describePayloadShape(value: unknown): string {
	if (value === null) {
		return 'null';
	}

	if (Array.isArray(value)) {
		return `array(len=${value.length})`;
	}

	if (typeof value === 'object') {
		const keys = Object.keys(value as Record<string, unknown>);
		return `object(keys=${keys.join(',') || '(none)'})`;
	}

	return typeof value;
}

function describePayloadPreview(value: unknown): string {
	try {
		const serialized = JSON.stringify(value);
		if (serialized === undefined) {
			return String(value);
		}
		return serialized.length > 240 ? `${serialized.slice(0, 240)}...` : serialized;
	} catch {
		return '[unserializable payload]';
	}
}

function coerceRangeList(path: string, value: unknown): string[] {
	if (typeof value === 'string') {
		return [value];
	}

	if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
		return value;
	}

	// Some matcher encodings may use objects per range; accept common keys defensively.
	if (
		Array.isArray(value) &&
		value.every((entry) => {
			if (!entry || typeof entry !== 'object') {
				return false;
			}
			const maybeRecord = entry as Record<string, unknown>;
			return typeof maybeRecord.cidr === 'string' || typeof maybeRecord.range === 'string';
		})
	) {
		return (value as Array<Record<string, unknown>>).map(
			(entry) => (entry.cidr as string | undefined) ?? (entry.range as string)
		);
	}

	throw new Error(
		`Expected a Caddy IP range list at ${path}; got ${describePayloadShape(value)} ${describePayloadPreview(value)}`
	);
}

function parseRemoteIpPayload(path: string, payload: unknown): RemoteIpPayload {
	if (payload === null) {
		return {
			shape: 'array',
			values: []
		};
	}

	if (Array.isArray(payload) || typeof payload === 'string') {
		return {
			shape: 'array',
			values: coerceRangeList(path, payload)
		};
	}

	if (payload && typeof payload === 'object') {
		const record = payload as Record<string, unknown>;

		if ('ranges' in record) {
			return {
				shape: 'ranges_object',
				values: coerceRangeList(path, record.ranges)
			};
		}

		// If caller accidentally points to /match/N, extract nested remote_ip matcher payload.
		if ('remote_ip' in record && record.remote_ip && typeof record.remote_ip === 'object') {
			const nested = record.remote_ip as Record<string, unknown>;
			if ('ranges' in nested) {
				return {
					shape: 'ranges_object',
					values: coerceRangeList(path, nested.ranges)
				};
			}
		}

		// Empty object is treated as no ranges configured.
		if (Object.keys(record).length === 0) {
			return {
				shape: 'ranges_object',
				values: []
			};
		}
	}

	throw new Error(
		`Expected string[] or { ranges: string[] } response from Caddy at ${path}; got ${describePayloadShape(payload)} ${describePayloadPreview(payload)}`
	);
}

async function getRemoteIpList(path: string): Promise<RemoteIpPayload> {
	const response = await requestCaddy(path, { method: 'GET' });
	const payload = (await response.json()) as unknown;

	return parseRemoteIpPayload(path, payload);
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
