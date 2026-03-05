import crypto from 'node:crypto';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { writeAuditEvent } from '$lib/server/audit';
import { removeAllowlistEntry, upsertAllowlistEntry } from '$lib/server/allowlist-store';
import { allowlistIp, removeAllowlistIp } from '$lib/server/caddy-api';
import { resolveClientIp } from '$lib/server/ip';
import { canUserAccessService } from '$lib/server/policy';
import { requireAuthUser } from '$lib/server/session';
import { assertRateLimit, assertSameOrigin, verifyCsrfToken } from '$lib/server/security';
import { getServiceById } from '$lib/server/services';

const requestSchema = z.object({
	action: z.enum(['allow', 'revoke']),
	serviceId: z.string().min(1)
});

export const POST: RequestHandler = async (event) => {
	const user = await requireAuthUser(event);

	assertSameOrigin(event);
	verifyCsrfToken(event);
	assertRateLimit(`${user.id}:allowlist`, 15, 60_000);

	const payload = requestSchema.parse(await event.request.json());
	const service = await getServiceById(payload.serviceId);
	const clientIp = resolveClientIp(event);
	const correlationId = crypto.randomUUID();

	if (!service) {
		throw error(400, 'Unknown service requested');
	}

	if (!canUserAccessService(user, service.id)) {
		writeAuditEvent({
			correlationId,
			userId: user.id,
			userEmail: user.email ?? null,
			groups: user.groups,
			serviceId: service.id,
			ip: clientIp,
			action: payload.action === 'allow' ? 'allowlist_add' : 'allowlist_remove',
			outcome: 'denied',
			detail: 'User group does not permit service'
		});
		throw error(403, 'Not allowed for this service');
	}

	try {
		if (payload.action === 'allow') {
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
		} else {
			await removeAllowlistIp(service.allowlistConfigPath, clientIp);
			removeAllowlistEntry(service.id, clientIp);
			writeAuditEvent({
				correlationId,
				userId: user.id,
				userEmail: user.email ?? null,
				groups: user.groups,
				serviceId: service.id,
				ip: clientIp,
				action: 'allowlist_remove',
				outcome: 'success'
			});
		}
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : 'Unexpected error';
		writeAuditEvent({
			correlationId,
			userId: user.id,
			userEmail: user.email ?? null,
			groups: user.groups,
			serviceId: service.id,
			ip: clientIp,
			action: payload.action === 'allow' ? 'allowlist_add' : 'allowlist_remove',
			outcome: 'error',
			detail: message
		});
		throw error(502, `Failed to update Caddy allowlist: ${message}`);
	}

	return json({
		ok: true,
		correlationId,
		ip: clientIp,
		serviceId: service.id,
		action: payload.action
	});
};
