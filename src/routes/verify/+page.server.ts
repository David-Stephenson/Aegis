import type { PageServerLoad } from './$types';
import { listAllowlistEntriesForUser } from '$lib/server/allowlist-store';
import { resolveClientIp } from '$lib/server/ip';
import { getAllowedServiceIdsForGroups } from '$lib/server/policy';
import { requireAuthUser } from '$lib/server/session';
import { issueCsrfToken } from '$lib/server/security';
import { getServiceDefinitions } from '$lib/server/services';

export const load: PageServerLoad = async (event) => {
	const user = await requireAuthUser(event);
	const clientIp = resolveClientIp(event);
	const allowedServiceIds = new Set(getAllowedServiceIdsForGroups(user.groups));
	const services = getServiceDefinitions().filter((service) => allowedServiceIds.has(service.id));
	const entries = listAllowlistEntriesForUser(user.id);
	const csrfToken = issueCsrfToken(event.cookies);

	return {
		user,
		clientIp,
		services,
		entries,
		csrfToken
	};
};
