import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthUser } from '$lib/server/session';
import { upsertServiceOverride } from '$lib/server/service-overrides';
import type { Actions } from './$types';

const updateServiceSchema = z.object({
	serviceId: z.string().min(1),
	displayName: z.string().max(80).optional(),
	description: z.string().max(240).optional(),
	icon: z.string().max(16).optional(),
	sortOrder: z.coerce.number().int().min(0).max(10_000).default(1000),
	enabled: z.boolean().default(true)
});

export const actions: Actions = {
	updateService: async (event) => {
		const user = await requireAuthUser(event);
		if (!user.groups.includes('admin')) {
			throw error(403, 'Admin group is required');
		}

		const formData = await event.request.formData();
		const serviceId = formData.get('serviceId')?.toString().trim() ?? '';
		const parsed = updateServiceSchema.safeParse({
			serviceId,
			displayName: formData.get('displayName')?.toString().trim() ?? '',
			description: formData.get('description')?.toString().trim() ?? '',
			icon: formData.get('icon')?.toString().trim() ?? '',
			sortOrder: formData.get('sortOrder')?.toString() ?? '1000',
			enabled: formData.get('enabled') === 'on'
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid service update payload'
			});
		}

		upsertServiceOverride({
			serviceId: parsed.data.serviceId,
			displayName: parsed.data.displayName || null,
			description: parsed.data.description || null,
			icon: parsed.data.icon || null,
			sortOrder: parsed.data.sortOrder,
			enabled: parsed.data.enabled
		});

		return {
			ok: true
		};
	}
};
