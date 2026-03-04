import { redirect, type Handle, error } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';

const guardedPrefixes = ['/verify', '/authorized', '/api/allowlist', '/admin'];

const authorizationHandle: Handle = async ({ event, resolve }) => {
	if (!guardedPrefixes.some((prefix) => event.url.pathname.startsWith(prefix))) {
		return resolve(event);
	}

	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	if (event.url.pathname.startsWith('/admin')) {
		const groups = (session.user as { groups?: string[] }).groups ?? [];
		if (!groups.includes('admin')) {
			throw error(403, 'Forbidden: Admin access required');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(authHandle, authorizationHandle);
