import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signIn } from '../../auth';

export const GET: RequestHandler = async () => {
	throw redirect(302, '/');
};

export const POST: RequestHandler = async (event) => {
	try {
		await signIn(event);
		return new Response(null, { status: 204 });
	} catch (caught) {
		console.error('[auth] login failed', caught);
		throw redirect(303, '/?error=auth_login_failed');
	}
};
