import { db } from '$lib/server/db';

export type AllowlistEntry = {
	id: number;
	userId: string;
	userEmail: string | null;
	serviceId: string;
	ip: string;
	createdAt: string;
	updatedAt: string;
};

export function upsertAllowlistEntry(input: {
	userId: string;
	userEmail: string | null;
	serviceId: string;
	ip: string;
}): void {
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO allowlist_entries (user_id, user_email, service_id, ip, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(service_id, ip) DO UPDATE SET
      user_id=excluded.user_id,
      user_email=excluded.user_email,
      updated_at=excluded.updated_at`
	).run(input.userId, input.userEmail, input.serviceId, input.ip, now, now);
}

export function removeAllowlistEntry(serviceId: string, ip: string): void {
	db.prepare('DELETE FROM allowlist_entries WHERE service_id = ? AND ip = ?').run(serviceId, ip);
}

export function listAllowlistEntriesForUser(userId: string): AllowlistEntry[] {
	return db
		.prepare(
			`SELECT
      id,
      user_id AS userId,
      user_email AS userEmail,
      service_id AS serviceId,
      ip,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM allowlist_entries
    WHERE user_id = ?
    ORDER BY id DESC`
		)
		.all(userId) as AllowlistEntry[];
}
