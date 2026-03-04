import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceCatalogItem } from '$lib/server/service-catalog';
import { getServiceById, getServiceDefinitions } from '$lib/server/services';

let mockServices: ServiceCatalogItem[] = [];

vi.mock('$lib/server/service-catalog', () => ({
	getServiceCatalog: vi.fn(async () => ({
		services: mockServices,
		warnings: []
	}))
}));

describe('services filtering', () => {
	beforeEach(() => {
		mockServices = [];
	});

	it('returns only services that are available, enabled, and allowlist-manageable', async () => {
		mockServices = [
			{
				id: 'managed',
				name: 'Managed',
				description: 'Managed by firewall',
				icon: null,
				sortOrder: 1,
				enabled: true,
				available: true,
				host: 'managed.example.com',
				allowlistConfigPath: '/config/a',
				sourcePath: '/routes/0',
				proxyUpstreams: ['upstream-a']
			},
			{
				id: 'disabled',
				name: 'Disabled',
				description: 'Disabled service',
				icon: null,
				sortOrder: 2,
				enabled: false,
				available: true,
				host: 'disabled.example.com',
				allowlistConfigPath: '/config/b',
				sourcePath: '/routes/1',
				proxyUpstreams: ['upstream-b']
			},
			{
				id: 'no-allowlist',
				name: 'No allowlist',
				description: 'No allowlist matcher',
				icon: null,
				sortOrder: 3,
				enabled: true,
				available: true,
				host: 'no-allowlist.example.com',
				allowlistConfigPath: null,
				sourcePath: '/routes/2',
				proxyUpstreams: ['upstream-c']
			},
			{
				id: 'unavailable',
				name: 'Unavailable',
				description: 'Not discovered',
				icon: null,
				sortOrder: 4,
				enabled: true,
				available: false,
				host: null,
				allowlistConfigPath: '/config/d',
				sourcePath: '/routes/3',
				proxyUpstreams: ['upstream-d']
			}
		];

		const services = await getServiceDefinitions();
		expect(services.map((service) => service.id)).toEqual(['managed']);
	});

	it('returns null for disabled services even when they exist in catalog', async () => {
		mockServices = [
			{
				id: 'disabled',
				name: 'Disabled',
				description: 'Disabled service',
				icon: null,
				sortOrder: 2,
				enabled: false,
				available: true,
				host: 'disabled.example.com',
				allowlistConfigPath: '/config/b',
				sourcePath: '/routes/1',
				proxyUpstreams: ['upstream-b']
			}
		];

		const service = await getServiceById('disabled');
		expect(service).toBeNull();
	});
});
