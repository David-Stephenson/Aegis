import { db } from '$lib/server/db';
import { normalizeAllowlistHistory, type AllowlistHistoryItem, type UserAllowlistActivity } from './admin-report-helpers';

type AllowlistEventRow = {
	id: number;
	userId: string;
	userEmail: string | null;
	serviceId: string;
	ip: string;
	action: 'allowlist_add' | 'allowlist_remove';
	createdAt: string;
};

function normalizeEmail(email: string | null): string | null {
	if (!email) {
		return null;
	}
	const normalized = email.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

export function listUserAllowlistActivityStats(limit = 5000): UserAllowlistActivity[] {
	const rows = db
		.prepare(
			`SELECT
      id,
      user_id AS userId,
      user_email AS userEmail,
      service_id AS serviceId,
      ip,
      action,
      created_at AS createdAt
    FROM audit_events
    WHERE action IN ('allowlist_add', 'allowlist_remove')
    ORDER BY id DESC
    LIMIT ?`
		)
		.all(limit) as AllowlistEventRow[];

	const buckets = new Map<
		string,
		UserAllowlistActivity & {
			latestEventId: number;
			serviceIds: Set<string>;
			ips: Set<string>;
		}
	>();

	for (const row of rows) {
		const identityKey = normalizeEmail(row.userEmail) ?? `user:${row.userId}`;
		const existing = buckets.get(identityKey);
		if (!existing) {
			buckets.set(identityKey, {
				userId: row.userId,
				userEmail: row.userEmail,
				totalAdds: row.action === 'allowlist_add' ? 1 : 0,
				totalRemoves: row.action === 'allowlist_remove' ? 1 : 0,
				lastActivityAt: row.createdAt,
				uniqueServiceCount: 0,
				uniqueIpCount: 0,
				latestEventId: row.id,
				serviceIds: new Set([row.serviceId]),
				ips: new Set([row.ip])
			});
			continue;
		}

		existing.totalAdds += row.action === 'allowlist_add' ? 1 : 0;
		existing.totalRemoves += row.action === 'allowlist_remove' ? 1 : 0;
		existing.serviceIds.add(row.serviceId);
		existing.ips.add(row.ip);
		if (row.id > existing.latestEventId) {
			existing.latestEventId = row.id;
			existing.userId = row.userId;
			existing.userEmail = row.userEmail;
			existing.lastActivityAt = row.createdAt;
		}
	}

	return [...buckets.values()]
		.map((bucket) => ({
			userId: bucket.userId,
			userEmail: bucket.userEmail,
			totalAdds: bucket.totalAdds,
			totalRemoves: bucket.totalRemoves,
			lastActivityAt: bucket.lastActivityAt,
			uniqueServiceCount: bucket.serviceIds.size,
			uniqueIpCount: bucket.ips.size
		}))
		.sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
}

export function listAllowlistHistory(limit = 500): AllowlistHistoryItem[] {
	const rows = db
		.prepare(
			`SELECT
      id,
      correlation_id AS correlationId,
      user_id AS userId,
      user_email AS userEmail,
      service_id AS serviceId,
      ip,
      action,
      outcome,
      detail,
      created_at AS createdAt
    FROM audit_events
    WHERE action IN ('allowlist_add', 'allowlist_remove')
    ORDER BY id DESC
    LIMIT ?`
		)
		.all(limit) as AllowlistHistoryItem[];

	return normalizeAllowlistHistory(rows);
}
