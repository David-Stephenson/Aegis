import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';
import { createCookieStore, createRequestEvent } from '$lib/server/test-helpers';

const {
	requireAuthUserMock,
	resolveClientIpMock,
	getAllowedServiceIdsForGroupsMock,
	getServiceDefinitionsMock,
	listAllowlistEntriesForUserMock,
	issueCsrfTokenMock
} = vi.hoisted(() => ({
	requireAuthUserMock: vi.fn(),
	resolveClientIpMock: vi.fn(),
	getAllowedServiceIdsForGroupsMock: vi.fn(),
	getServiceDefinitionsMock: vi.fn(),
	listAllowlistEntriesForUserMock: vi.fn(),
	issueCsrfTokenMock: vi.fn()
}));

vi.mock('$lib/server/session', () => ({
	requireAuthUser: requireAuthUserMock
}));
vi.mock('$lib/server/ip', () => ({
	resolveClientIp: resolveClientIpMock
}));
vi.mock('$lib/server/policy', () => ({
	getAllowedServiceIdsForGroups: getAllowedServiceIdsForGroupsMock
}));
vi.mock('$lib/server/services', () => ({
	getServiceDefinitions: getServiceDefinitionsMock
}));
vi.mock('$lib/server/allowlist-store', () => ({
	listAllowlistEntriesForUser: listAllowlistEntriesForUserMock
}));
vi.mock('$lib/server/security', () => ({
	issueCsrfToken: issueCsrfTokenMock
}));

describe('/verify load', () => {
	beforeEach(() => {
		requireAuthUserMock.mockReset();
		resolveClientIpMock.mockReset();
		getAllowedServiceIdsForGroupsMock.mockReset();
		getServiceDefinitionsMock.mockReset();
		listAllowlistEntriesForUserMock.mockReset();
		issueCsrfTokenMock.mockReset();
	});

	it('returns only services user is allowed to manage', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		resolveClientIpMock.mockReturnValue('203.0.113.10');
		getAllowedServiceIdsForGroupsMock.mockReturnValue(['grafana']);
		getServiceDefinitionsMock.mockResolvedValue([
			{ id: 'grafana', name: 'Grafana' },
			{ id: 'jellyfin', name: 'Jellyfin' }
		]);
		listAllowlistEntriesForUserMock.mockReturnValue([{ id: 1 }]);
		issueCsrfTokenMock.mockReturnValue('csrf-123');

		const cookies = createCookieStore();
		const event = createRequestEvent({
			pathname: 'http://localhost/verify',
			session: { user: { id: 'test-admin', groups: ['admin'] } },
			cookies
		});
		const result = await load(event as never);

		expect(result.clientIp).toBe('203.0.113.10');
		expect(result.services).toEqual([{ id: 'grafana', name: 'Grafana' }]);
		expect(result.entries).toEqual([{ id: 1 }]);
		expect(result.csrfToken).toBe('csrf-123');
	});
});
