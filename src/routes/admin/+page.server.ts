import { error } from '@sveltejs/kit';
import { listRecentAuditEvents } from '$lib/server/audit';
import { requireAuthUser } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = await requireAuthUser(event);
	if (!user.groups.includes('admin')) {
		throw error(403, 'Admin group is required');
	}

	return {
		events: listRecentAuditEvents(100)
	};
};
