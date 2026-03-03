import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signIn } from '../../auth';

export const GET: RequestHandler = async () => {
	throw redirect(302, '/');
};

export const POST: RequestHandler = async (event) => {
	await signIn(event);
	return new Response(null, { status: 204 });
};
