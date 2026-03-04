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

type RemoteIpState = {
	path: string;
	payload: RemoteIpPayload;
};

export type DiscoveredService = {
	id: string;
	host: string | null;
	allowlistConfigPath: string | null;
	sourcePath: string;
	proxyUpstreams: string[];
};

function buildCandidateRemoteIpPaths(path: string): string[] {
	const candidates = new Set<string>([path]);
	const nestedMatcherPattern = /^(.+\/routes\/\d+)\/match\/(\d+)\/remote_ip$/;
	const match = path.match(nestedMatcherPattern);
	if (match) {
		const routePrefix = match[1];
		const matchIndex = match[2];
		candidates.add(`${routePrefix}/handle/0/routes/0/match/${matchIndex}/remote_ip`);
	}
	return [...candidates];
}

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
		throw new Error(`No remote_ip matcher payload at ${path}`);
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
	const state = await getRemoteIpState(path);
	return state.payload;
}

async function getRemoteIpState(path: string): Promise<RemoteIpState> {
	const candidates = buildCandidateRemoteIpPaths(path);
	for (const candidate of candidates) {
		try {
			const response = await requestCaddy(candidate, { method: 'GET' });
			const rawPayload = (await response.json()) as unknown;
			try {
				return {
					path: candidate,
					payload: parseRemoteIpPayload(candidate, rawPayload)
				};
			} catch {
				continue;
			}
		} catch (caught) {
			if (caught instanceof CaddyApiError && caught.details.status === 404) {
				continue;
			}
			throw caught;
		}
	}

	throw new Error(`Unable to locate remote_ip matcher. Tried: ${candidates.join(', ')}`);
}

async function putRemoteIpList(path: string, payload: RemoteIpPayload): Promise<void> {
	// Caddy's remote_ip matcher is an object (MatchRemoteIP), not a raw array.
	// Always write the canonical shape to avoid "cannot unmarshal array" errors.
	const body = JSON.stringify({ ranges: payload.values });
	await requestCaddy(path, {
		method: 'PATCH',
		body
	});
}

function dedupeAndSort(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function slugifyServiceId(input: string): string {
	const slug = input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'service';
}

function createDeterministicSuffix(input: string): string {
	let hash = 0;
	for (let index = 0; index < input.length; index += 1) {
		hash = (hash * 33 + input.charCodeAt(index)) % 2_147_483_647;
	}
	return hash.toString(36);
}

function deriveBaseServiceId(host: string | null, sourcePath: string): string {
	if (host) {
		return slugifyServiceId(host);
	}
	const normalizedPath = sourcePath.replace(/^\/config\/apps\/http\/servers\//, '');
	return slugifyServiceId(normalizedPath);
}

type DiscoveredServiceSeed = {
	baseId: string;
	host: string | null;
	allowlistConfigPath: string | null;
	sourcePath: string;
	proxyUpstreams: string[];
};

function collectHostsFromMatchers(matchers: unknown): string[] {
	if (!Array.isArray(matchers)) {
		return [];
	}
	const hosts = new Set<string>();
	for (const matcher of matchers) {
		if (!matcher || typeof matcher !== 'object') {
			continue;
		}
		const maybeHost = (matcher as Record<string, unknown>).host;
		if (Array.isArray(maybeHost)) {
			for (const entry of maybeHost) {
				if (typeof entry === 'string' && entry.length > 0) {
					hosts.add(entry);
				}
			}
		}
	}
	return [...hosts];
}

function hasRemoteIpMatcher(matcher: unknown): boolean {
	return !!matcher && typeof matcher === 'object' && 'remote_ip' in (matcher as Record<string, unknown>);
}

function collectReverseProxyUpstreams(handles: unknown): string[] {
	if (!Array.isArray(handles)) {
		return [];
	}
	const upstreams = new Set<string>();
	for (const handle of handles) {
		if (!handle || typeof handle !== 'object') {
			continue;
		}
		const record = handle as Record<string, unknown>;
		if (record.handler !== 'reverse_proxy') {
			continue;
		}
		const maybeUpstreams = record.upstreams;
		if (!Array.isArray(maybeUpstreams)) {
			continue;
		}
		for (const upstream of maybeUpstreams) {
			if (!upstream || typeof upstream !== 'object') {
				continue;
			}
			const dial = (upstream as Record<string, unknown>).dial;
			if (typeof dial === 'string' && dial.length > 0) {
				upstreams.add(dial);
			}
		}
	}
	return [...upstreams];
}

function collectDiscoveredServiceSeedsFromRoutes(
	routes: unknown,
	routePathPrefix: string,
	inheritedHosts: string[],
	output: DiscoveredServiceSeed[]
): void {
	if (!Array.isArray(routes)) {
		return;
	}

	for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
		const route = routes[routeIndex];
		if (!route || typeof route !== 'object') {
			continue;
		}

		const routePath = `${routePathPrefix}/${routeIndex}`;
		const routeRecord = route as Record<string, unknown>;
		const routeMatchers = routeRecord.match;
		const routeHosts = [
			...new Set([...inheritedHosts, ...collectHostsFromMatchers(routeMatchers)])
		];
		const handles = routeRecord.handle;
		const proxyUpstreams = collectReverseProxyUpstreams(handles);
		let allowlistConfigPath: string | null = null;

		if (Array.isArray(routeMatchers)) {
			for (let matcherIndex = 0; matcherIndex < routeMatchers.length; matcherIndex += 1) {
				const matcher = routeMatchers[matcherIndex];
				if (!hasRemoteIpMatcher(matcher)) {
					continue;
				}
				allowlistConfigPath = `${routePath}/match/${matcherIndex}/remote_ip`;
				break;
			}
		}

		if (proxyUpstreams.length > 0) {
			const hostsToCreate = routeHosts.length > 0 ? routeHosts : [null];
			for (const host of hostsToCreate) {
				output.push({
					baseId: deriveBaseServiceId(host, routePath),
					host,
					allowlistConfigPath,
					sourcePath: routePath,
					proxyUpstreams
				});
			}
		}

		if (!Array.isArray(handles)) {
			continue;
		}
		for (let handleIndex = 0; handleIndex < handles.length; handleIndex += 1) {
			const handle = handles[handleIndex];
			if (!handle || typeof handle !== 'object') {
				continue;
			}
			const nestedRoutes = (handle as Record<string, unknown>).routes;
			if (!Array.isArray(nestedRoutes)) {
				continue;
			}
			collectDiscoveredServiceSeedsFromRoutes(
				nestedRoutes,
				`${routePath}/handle/${handleIndex}/routes`,
				routeHosts,
				output
			);
		}
	}
}

export function extractDiscoveredServicesFromServersConfig(payload: unknown): DiscoveredService[] {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return [];
	}

	const seeds: DiscoveredServiceSeed[] = [];
	const servers = payload as Record<string, unknown>;
	for (const [serverName, serverConfig] of Object.entries(servers)) {
		if (!serverConfig || typeof serverConfig !== 'object') {
			continue;
		}
		const routes = (serverConfig as Record<string, unknown>).routes;
		collectDiscoveredServiceSeedsFromRoutes(
			routes,
			`/config/apps/http/servers/${serverName}/routes`,
			[],
			seeds
		);
	}

	const mergedByServiceKey = new Map<string, DiscoveredServiceSeed>();
	for (const seed of seeds) {
		const serviceKey = seed.host ?? seed.sourcePath;
		const existing = mergedByServiceKey.get(serviceKey);
		if (!existing) {
			mergedByServiceKey.set(serviceKey, seed);
			continue;
		}

		mergedByServiceKey.set(serviceKey, {
			...existing,
			allowlistConfigPath: existing.allowlistConfigPath ?? seed.allowlistConfigPath,
			proxyUpstreams: [...new Set([...existing.proxyUpstreams, ...seed.proxyUpstreams])].sort((a, b) =>
				a.localeCompare(b)
			)
		});
	}

	const sortedSeeds = [...mergedByServiceKey.values()].sort((a, b) => {
		const aKey = a.host ?? a.sourcePath;
		const bKey = b.host ?? b.sourcePath;
		return aKey.localeCompare(bKey);
	});

	const seenIds = new Set<string>();
	return sortedSeeds.map((seed) => {
		let id = seed.baseId;
		if (seenIds.has(id)) {
			id = `${seed.baseId}-${createDeterministicSuffix(seed.sourcePath)}`;
		}
		seenIds.add(id);
		return {
			id,
			host: seed.host,
			allowlistConfigPath: seed.allowlistConfigPath,
			sourcePath: seed.sourcePath,
			proxyUpstreams: seed.proxyUpstreams
		};
	});
}

export async function listDiscoveredServices(): Promise<DiscoveredService[]> {
	const response = await requestCaddy('/config/apps/http/servers', {
		method: 'GET'
	});
	const payload = (await response.json()) as unknown;
	return extractDiscoveredServicesFromServersConfig(payload);
}

export async function allowlistIp(path: string, ip: string): Promise<void> {
	const current = await getRemoteIpState(path);
	const next = dedupeAndSort([...current.payload.values, ip]);
	await putRemoteIpList(current.path, {
		...current.payload,
		values: next
	});
}

export async function removeAllowlistIp(path: string, ip: string): Promise<void> {
	const current = await getRemoteIpState(path);
	const next = dedupeAndSort(current.payload.values.filter((entry) => entry !== ip));
	await putRemoteIpList(current.path, {
		...current.payload,
		values: next
	});
}
