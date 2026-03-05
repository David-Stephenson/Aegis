import { describe, expect, it, vi } from 'vitest';
import { listAuthentikUsers, listAuthentikUsersSafely, normalizeAuthentikUser } from '$lib/server/authentik-api';

describe('normalizeAuthentikUser', () => {
	it('normalizes Authentik user payloads with groups_obj', () => {
		const normalized = normalizeAuthentikUser({
			pk: 12,
			username: 'alice',
			email: 'alice@example.com',
			name: 'Alice',
			is_active: true,
			groups_obj: [{ name: 'admin' }, { name: 'dev' }]
		});

		expect(normalized).toEqual({
			id: '12',
			username: 'alice',
			email: 'alice@example.com',
			name: 'Alice',
			isActive: true,
			groups: ['admin', 'dev']
		});
	});

	it('returns null for invalid payloads', () => {
		expect(normalizeAuthentikUser({ username: 'missing-id' })).toBeNull();
	});
});

describe('listAuthentikUsers', () => {
	it('follows pagination and deduplicates users', async () => {
		const listMock = vi
			.fn()
			.mockResolvedValueOnce({
				results: [
					{ pk: 'u-1', username: 'alice', email: 'alice@example.com', groups: ['admin'] },
					{ pk: 'u-2', username: 'bob', email: 'bob@example.com', groups: ['dev'] }
				],
				pagination: { next: 2 }
			})
			.mockResolvedValueOnce({
				results: [{ pk: 'u-2', username: 'bob', email: 'bob@example.com', groups: ['dev'] }],
				pagination: { next: null }
			});

		const users = await listAuthentikUsers(fetch, {
			coreUsersList: listMock
		});

		expect(listMock).toHaveBeenCalledTimes(2);
		expect(listMock).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 200, includeGroups: true });
		expect(listMock).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 200, includeGroups: true });
		expect(users).toEqual([
			{
				id: 'u-1',
				username: 'alice',
				email: 'alice@example.com',
				name: null,
				isActive: true,
				groups: ['admin']
			},
			{
				id: 'u-2',
				username: 'bob',
				email: 'bob@example.com',
				name: null,
				isActive: true,
				groups: ['dev']
			}
		]);
	});

	it('returns warning and empty users when Authentik request fails', async () => {
		const result = await listAuthentikUsersSafely(fetch, {
			coreUsersList: vi.fn().mockRejectedValue(new Error('denied'))
		});

		expect(result.users).toEqual([]);
		expect(result.warning).toContain('Failed to load live Authentik users');
	});
});
