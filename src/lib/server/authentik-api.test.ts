import { describe, expect, it } from 'vitest';
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
		const seenUrls: string[] = [];
		const fetchMock: typeof fetch = async (input) => {
			const url = String(input);
			seenUrls.push(url);

			if (url.includes('page=1')) {
				return new Response(
					JSON.stringify({
						results: [
							{ pk: 'u-1', username: 'alice', email: 'alice@example.com', groups: ['admin'] },
							{ pk: 'u-2', username: 'bob', email: 'bob@example.com', groups: ['dev'] }
						],
						next: 'https://auth.example.com/api/v3/core/users/?page=2&page_size=200'
					}),
					{ status: 200 }
				);
			}

			return new Response(
				JSON.stringify({
					results: [{ pk: 'u-2', username: 'bob', email: 'bob@example.com', groups: ['dev'] }],
					next: null
				}),
				{ status: 200 }
			);
		};

		const users = await listAuthentikUsers(fetchMock);

		expect(seenUrls).toHaveLength(2);
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
		const fetchMock: typeof fetch = async () => new Response('denied', { status: 401 });

		const result = await listAuthentikUsersSafely(fetchMock);

		expect(result.users).toEqual([]);
		expect(result.warning).toContain('Failed to load live Authentik users');
	});
});
