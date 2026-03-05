import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceCatalog } from '$lib/server/service-catalog';

let discoveredServices: Array<{
	id: string;
	host: string | null;
	allowlistConfigPath: string | null;
	sourcePath: string;
	proxyUpstreams: string[];
}> = [];
let discoveryError: Error | null = null;
let overrides: Array<{
	serviceId: string;
	displayName: string | null;
	description: string | null;
	icon: string | null;
	sortOrder: number;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}> = [];

vi.mock('$lib/server/caddy-api', () => ({
	listDiscoveredServices: vi.fn(async () => {
		if (discoveryError) {
			throw discoveryError;
		}
		return discoveredServices;
	})
}));

vi.mock('$lib/server/service-overrides', () => ({
	listServiceOverrides: vi.fn(() => overrides)
}));

describe('getServiceCatalog', () => {
	beforeEach(() => {
		discoveredServices = [];
		discoveryError = null;
		overrides = [];
	});

	it('merges discovered services with overrides', async () => {
		discoveredServices = [
			{
				id: 'grafana',
				host: 'grafana.example.com',
				allowlistConfigPath: '/config/apps/http/servers/srv0/routes/0/match/1/remote_ip',
				sourcePath: '/config/apps/http/servers/srv0/routes/0',
				proxyUpstreams: ['10.0.0.1:3000']
			}
		];
		overrides = [
			{
				serviceId: 'grafana',
				displayName: 'Grafana',
				description: 'Metrics dashboard',
				icon: '📈',
				sortOrder: 10,
				enabled: true,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			}
		];

		const result = await getServiceCatalog();
		expect(result.warnings).toEqual([]);
		expect(result.services).toHaveLength(1);
		expect(result.services[0]).toMatchObject({
			id: 'grafana',
			name: 'Grafana',
			description: 'Metrics dashboard',
			icon: '📈',
			sortOrder: 10,
			enabled: true,
			available: true
		});
	});

	it('includes override-only services as unavailable', async () => {
		overrides = [
			{
				serviceId: 'jellyfin',
				displayName: 'Jellyfin',
				description: null,
				icon: null,
				sortOrder: 2,
				enabled: false,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			}
		];

		const result = await getServiceCatalog();
		expect(result.services).toEqual([
			{
				id: 'jellyfin',
				name: 'Jellyfin',
				description: 'Configured in admin but not currently discovered in Caddy.',
				icon: null,
				sortOrder: 2,
				enabled: false,
				available: false,
				host: null,
				allowlistConfigPath: null,
				sourcePath: null,
				proxyUpstreams: []
			}
		]);
	});

	it('returns warning when discovery fails', async () => {
		discoveryError = new Error('boom');
		const result = await getServiceCatalog();
		expect(result.services).toEqual([]);
		expect(result.warnings[0]).toContain('Service discovery failed: boom');
	});
});
