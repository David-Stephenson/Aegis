import { db } from '$lib/server/db';

export type ServiceOverride = {
	serviceId: string;
	displayName: string | null;
	description: string | null;
	icon: string | null;
	sortOrder: number;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export function listServiceOverrides(): ServiceOverride[] {
	return db
		.prepare(
			`SELECT
      service_id AS serviceId,
      display_name AS displayName,
      description,
      icon,
      sort_order AS sortOrder,
      enabled,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM service_overrides
    ORDER BY sort_order ASC, service_id ASC`
		)
		.all()
		.map((row) => {
			const typed = row as Omit<ServiceOverride, 'enabled'> & { enabled: number };
			return {
				...typed,
				enabled: typed.enabled === 1
			};
		});
}

export function upsertServiceOverride(input: {
	serviceId: string;
	displayName: string | null;
	description: string | null;
	icon: string | null;
	sortOrder: number;
	enabled: boolean;
}): void {
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO service_overrides (
      service_id, display_name, description, icon, sort_order, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(service_id) DO UPDATE SET
      display_name = excluded.display_name,
      description = excluded.description,
      icon = excluded.icon,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at`
	).run(
		input.serviceId,
		input.displayName,
		input.description,
		input.icon,
		input.sortOrder,
		input.enabled ? 1 : 0,
		now,
		now
	);
}
