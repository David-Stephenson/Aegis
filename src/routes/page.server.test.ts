import { describe, expect, it } from 'vitest';
import { load } from './+page.server';
import { createRequestEvent } from '$lib/server/test-helpers';

describe('root page load', () => {
	it('redirects authenticated users to authorized page', async () => {
		const event = createRequestEvent({
			pathname: 'http://localhost/',
			session: { user: { id: 'u-1', groups: ['admin'] } }
		});

		await expect(load(event as never)).rejects.toMatchObject({
			status: 303,
			location: '/authorized'
		});
	});

	it('returns empty data for anonymous users', async () => {
		const event = createRequestEvent({ pathname: 'http://localhost/', session: null });
		await expect(load(event as never)).resolves.toEqual({});
	});
});
