import crypto from 'node:crypto';
import net from 'node:net';
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { removeAllowlistEntry } from '$lib/server/allowlist-store';
import { writeAuditEvent } from '$lib/server/audit';
import { removeAllowlistIp } from '$lib/server/caddy-api';
import { requireAuthUser } from '$lib/server/session';
import { getServiceById } from '$lib/server/services';
import type { Actions } from './$types';

const revokeAllowlistEntrySchema = z.object({
	serviceId: z.string().min(1),
	ip: z.string().refine((value) => net.isIP(value) > 0, { message: 'Invalid IP address' })
});

export const actions: Actions = {
	revokeAllowlistEntry: async (event) => {
		const user = await requireAuthUser(event);
		if (!user.groups.includes('admin')) {
			throw error(403, 'Admin group is required');
		}

		const formData = await event.request.formData();
		const parsed = revokeAllowlistEntrySchema.safeParse({
			serviceId: formData.get('serviceId'),
			ip: formData.get('ip')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid allowlist revoke payload'
			});
		}

		const service = await getServiceById(parsed.data.serviceId);
		if (!service) {
			return fail(400, {
				error: 'Service is unavailable or not allowlist-manageable right now'
			});
		}

		try {
			await removeAllowlistIp(service.allowlistConfigPath, parsed.data.ip);
			removeAllowlistEntry(parsed.data.serviceId, parsed.data.ip);
			writeAuditEvent({
				correlationId: crypto.randomUUID(),
				userId: user.id,
				userEmail: user.email ?? null,
				groups: user.groups,
				serviceId: parsed.data.serviceId,
				ip: parsed.data.ip,
				action: 'allowlist_remove',
				outcome: 'success',
				detail: 'Revoked from admin allowlist table'
			});
			return { ok: true };
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : 'Unexpected error';
			writeAuditEvent({
				correlationId: crypto.randomUUID(),
				userId: user.id,
				userEmail: user.email ?? null,
				groups: user.groups,
				serviceId: parsed.data.serviceId,
				ip: parsed.data.ip,
				action: 'allowlist_remove',
				outcome: 'error',
				detail: `Admin revoke failed: ${message}`
			});
			return fail(502, {
				error: `Failed to revoke allowlist entry: ${message}`
			});
		}
	}
};
