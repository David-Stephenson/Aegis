import { error, type RequestEvent } from '@sveltejs/kit';
import type { AuthUser } from '$lib/server/policy';

export async function requireAuthUser(event: RequestEvent): Promise<AuthUser> {
	const session = await event.locals.auth();

	if (!session?.user?.id) {
		throw error(401, 'Unauthorized');
	}

	return {
		id: session.user.id,
		name: session.user.name ?? null,
		email: session.user.email ?? null,
		groups: session.user.groups ?? []
	};
}
