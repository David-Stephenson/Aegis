import { describe, expect, it, vi } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { createRequestEvent } from '$lib/server/test-helpers';

vi.mock('@sveltejs/kit/hooks', () => ({
	sequence:
		(...handlers: Handle[]): Handle =>
		async ({ event, resolve }) => {
			const run = async (index: number, nextEvent: Parameters<Handle>[0]['event']) => {
				const handler = handlers[index];
				if (!handler) {
					return resolve(nextEvent);
				}
				return handler({
					event: nextEvent,
					resolve: (updatedEvent) => run(index + 1, updatedEvent)
				});
			};
			return run(0, event);
		}
}));

const { authHandleMock } = vi.hoisted(() => ({
	authHandleMock: (async ({ event, resolve }) => resolve(event)) as Handle
}));
vi.mock('./auth', () => ({
	handle: authHandleMock
}));

import { handle } from './hooks.server';

describe('hooks authorization', () => {
	it('passes through unguarded routes', async () => {
		const event = createRequestEvent({ pathname: 'http://localhost/' });
		const response = await handle({
			event,
			resolve: async () => new Response('ok', { status: 200 })
		});
		expect(response.status).toBe(200);
	});

	it('redirects unauthenticated users on guarded routes', async () => {
		const event = createRequestEvent({
			pathname: 'http://localhost/verify',
			session: null
		});
		await expect(
			handle({
				event,
				resolve: async () => new Response('ok')
			})
		).rejects.toMatchObject({ status: 303, location: '/login' });
	});

	it('allows authenticated users on guarded routes', async () => {
		const event = createRequestEvent({
			pathname: 'http://localhost/admin',
			session: { user: { id: 'u-1', groups: ['admin'] } }
		});
		const response = await handle({
			event,
			resolve: async () => new Response(null, { status: 204 })
		});
		expect(response.status).toBe(204);
	});
});
