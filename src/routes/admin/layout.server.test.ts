import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+layout.server';
import { createRequestEvent } from '$lib/server/test-helpers';

const {
	requireAuthUserMock,
	getAdminServiceDefinitionsMock,
	listAuthentikUsersSafelyMock,
	listUserAllowlistActivityStatsMock,
	listAllowlistHistoryMock,
	listAllowlistEntriesMock,
	mergeUsersWithActivityMock
} = vi.hoisted(() => ({
	requireAuthUserMock: vi.fn(),
	getAdminServiceDefinitionsMock: vi.fn(),
	listAuthentikUsersSafelyMock: vi.fn(),
	listUserAllowlistActivityStatsMock: vi.fn(),
	listAllowlistHistoryMock: vi.fn(),
	listAllowlistEntriesMock: vi.fn(),
	mergeUsersWithActivityMock: vi.fn()
}));

vi.mock('$lib/server/session', () => ({ requireAuthUser: requireAuthUserMock }));
vi.mock('$lib/server/services', () => ({
	getAdminServiceDefinitions: getAdminServiceDefinitionsMock
}));
vi.mock('$lib/server/authentik-api', () => ({
	listAuthentikUsersSafely: listAuthentikUsersSafelyMock
}));
vi.mock('$lib/server/admin-reports', () => ({
	listUserAllowlistActivityStats: listUserAllowlistActivityStatsMock,
	listAllowlistHistory: listAllowlistHistoryMock
}));
vi.mock('$lib/server/allowlist-store', () => ({
	listAllowlistEntries: listAllowlistEntriesMock
}));
vi.mock('$lib/server/admin-report-helpers', () => ({
	mergeUsersWithActivity: mergeUsersWithActivityMock
}));

describe('/admin layout load', () => {
	beforeEach(() => {
		requireAuthUserMock.mockReset();
		getAdminServiceDefinitionsMock.mockReset();
		listAuthentikUsersSafelyMock.mockReset();
		listUserAllowlistActivityStatsMock.mockReset();
		listAllowlistHistoryMock.mockReset();
		listAllowlistEntriesMock.mockReset();
		mergeUsersWithActivityMock.mockReset();
	});

	it('blocks non-admin users', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'u-1',
			email: 'user@example.com',
			groups: ['dev']
		});
		const event = createRequestEvent({ pathname: 'http://localhost/admin' });
		await expect(load(event as never)).rejects.toMatchObject({ status: 403 });
	});

	it('returns merged admin payload for admin users', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		getAdminServiceDefinitionsMock.mockResolvedValue({
			services: [{ id: 'grafana', name: 'Grafana', allowlistConfigPath: '/config/path' }],
			warnings: ['warn']
		});
		listAuthentikUsersSafelyMock.mockResolvedValue({
			users: [{ id: 'u-1', username: 'alice' }],
			warning: 'auth warning'
		});
		listUserAllowlistActivityStatsMock.mockReturnValue([{ userId: 'u-1' }]);
		listAllowlistHistoryMock.mockReturnValue([{ id: 1 }]);
		listAllowlistEntriesMock.mockReturnValue([
			{ serviceId: 'grafana', userId: 'u-1', userEmail: 'a@example.com' }
		]);
		mergeUsersWithActivityMock.mockReturnValue([{ id: 'u-1' }]);

		const event = createRequestEvent({ pathname: 'http://localhost/admin' });
		const result = await load(event as never);
		expect(result.services).toHaveLength(1);
		expect(result.discoveryWarnings).toEqual(['warn']);
		expect(result.users).toEqual([{ id: 'u-1' }]);
		expect(result.userDirectoryWarning).toBe('auth warning');
	});
});
