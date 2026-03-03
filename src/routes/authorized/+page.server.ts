import crypto from 'node:crypto';
import type { PageServerLoad } from './$types';
import { writeAuditEvent } from '$lib/server/audit';
import { allowlistIp } from '$lib/server/caddy-api';
import { listAllowlistEntriesForUser, upsertAllowlistEntry } from '$lib/server/allowlist-store';
import { resolveClientIp } from '$lib/server/ip';
import { getAllowedServiceIdsForGroups } from '$lib/server/policy';
import { requireAuthUser } from '$lib/server/session';
import { getServiceDefinitions } from '$lib/server/services';

type ServiceAuthorizationResult = {
	serviceId: string;
	serviceName: string;
	status: 'authorized' | 'already_authorized' | 'failed';
	detail?: string;
};

export const load: PageServerLoad = async (event) => {
	const user = await requireAuthUser(event);
	const clientIp = resolveClientIp(event);
	const allowedServiceIds = new Set(getAllowedServiceIdsForGroups(user.groups));
	const allowedServices = getServiceDefinitions().filter((service) => allowedServiceIds.has(service.id));
	const existingEntries = listAllowlistEntriesForUser(user.id);

	const results: ServiceAuthorizationResult[] = [];

	for (const service of allowedServices) {
		const alreadyAuthorized = existingEntries.some(
			(entry) => entry.serviceId === service.id && entry.ip === clientIp
		);

		if (alreadyAuthorized) {
			results.push({
				serviceId: service.id,
				serviceName: service.name,
				status: 'already_authorized'
			});
			continue;
		}

		const correlationId = crypto.randomUUID();

		try {
			await allowlistIp(service.allowlistConfigPath, clientIp);
			upsertAllowlistEntry({
				userId: user.id,
				userEmail: user.email ?? null,
				serviceId: service.id,
				ip: clientIp
			});
			writeAuditEvent({
				correlationId,
				userId: user.id,
				userEmail: user.email ?? null,
				groups: user.groups,
				serviceId: service.id,
				ip: clientIp,
				action: 'allowlist_add',
				outcome: 'success'
			});
			results.push({
				serviceId: service.id,
				serviceName: service.name,
				status: 'authorized'
			});
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : 'Unknown Caddy API error';
			writeAuditEvent({
				correlationId,
				userId: user.id,
				userEmail: user.email ?? null,
				groups: user.groups,
				serviceId: service.id,
				ip: clientIp,
				action: 'allowlist_add',
				outcome: 'error',
				detail: message
			});
			results.push({
				serviceId: service.id,
				serviceName: service.name,
				status: 'failed',
				detail: message
			});
		}
	}

	return {
		user,
		clientIp,
		results
	};
};
