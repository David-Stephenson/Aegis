import { describe, expect, it } from 'vitest';
import { requireAuthUser } from '$lib/server/session';
import { createRequestEvent } from '$lib/server/test-helpers';

describe('requireAuthUser', () => {
	it('returns normalized auth user for authenticated session', async () => {
		const event = createRequestEvent({
			session: {
				user: {
					id: 'u-1',
					email: 'user@example.com',
					name: 'User',
					groups: ['admin']
				}
			}
		});

		await expect(requireAuthUser(event)).resolves.toEqual({
			id: 'u-1',
			email: 'user@example.com',
			name: 'User',
			groups: ['admin']
		});
	});

	it('throws 401 for missing session identity', async () => {
		const event = createRequestEvent({ session: null });
		await expect(requireAuthUser(event)).rejects.toMatchObject({ status: 401 });
	});
});
