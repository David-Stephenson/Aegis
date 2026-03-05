import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './+server';
import { createRequestEvent } from '$lib/server/test-helpers';

const { signInMock } = vi.hoisted(() => ({
	signInMock: vi.fn()
}));
vi.mock('../../auth', () => ({
	signIn: signInMock
}));

describe('/login handlers', () => {
	beforeEach(() => {
		signInMock.mockReset();
	});

	it('GET redirects to root', async () => {
		const event = createRequestEvent({ pathname: 'http://localhost/login' });
		await expect(GET(event as never)).rejects.toMatchObject({ status: 302, location: '/' });
	});

	it('POST returns 204 when sign-in starts successfully', async () => {
		signInMock.mockResolvedValueOnce(undefined);
		const event = createRequestEvent({ method: 'POST', pathname: 'http://localhost/login' });
		const response = await POST(event as never);
		expect(response.status).toBe(204);
	});

	it('POST redirects to root with login error when sign-in fails', async () => {
		signInMock.mockRejectedValueOnce(new Error('bad'));
		const event = createRequestEvent({ method: 'POST', pathname: 'http://localhost/login' });
		await expect(POST(event as never)).rejects.toMatchObject({
			status: 303,
			location: '/?error=auth_login_failed'
		});
	});
});
