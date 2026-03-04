import { error } from '@sveltejs/kit';
import { listAllowlistEntries } from '$lib/server/allowlist-store';
import { listAllowlistHistory, listUserAllowlistActivityStats } from '$lib/server/admin-reports';
import { mergeUsersWithActivity } from '$lib/server/admin-report-helpers';
import { listAuthentikUsersSafely } from '$lib/server/authentik-api';
import { requireAuthUser } from '$lib/server/session';
import { getAdminServiceDefinitions } from '$lib/server/services';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = await requireAuthUser(event);
	if (!user.groups.includes('admin')) {
		throw error(403, 'Admin group is required');
	}

	const catalog = await getAdminServiceDefinitions();
	const [authentikUsersResult, userActivityStats, allowlistHistory, entries] = await Promise.all([
		listAuthentikUsersSafely(),
		Promise.resolve(listUserAllowlistActivityStats(1000)),
		Promise.resolve(listAllowlistHistory(1000)),
		Promise.resolve(listAllowlistEntries(1000))
	]);
	const serviceById = new Map(catalog.services.map((service) => [service.id, service]));
	const users = mergeUsersWithActivity(authentikUsersResult.users, userActivityStats);
	const allowlistEntries = entries.map((entry) => {
		const service = serviceById.get(entry.serviceId);
		return {
			...entry,
			serviceName: service?.name ?? entry.serviceId,
			allowlistConfigPath: service?.allowlistConfigPath ?? null
		};
	});

	return {
		services: catalog.services,
		discoveryWarnings: catalog.warnings,
		users,
		allowlistEntries,
		allowlistHistory,
		userDirectoryWarning: authentikUsersResult.warning
	};
};
