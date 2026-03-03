import { db } from '$lib/server/db';

type AuditEvent = {
	correlationId: string;
	userId: string;
	userEmail: string | null;
	groups: string[];
	serviceId: string;
	ip: string;
	action: 'allowlist_add' | 'allowlist_remove';
	outcome: 'success' | 'denied' | 'error';
	detail?: string;
};

const auditEventColumns = db.prepare('PRAGMA table_info(audit_events)').all() as Array<{ name: string }>;
const hasLegacyRolesJson = auditEventColumns.some((column) => column.name === 'roles_json');

export function writeAuditEvent(event: AuditEvent): void {
	const groupsJson = JSON.stringify(event.groups);

	if (hasLegacyRolesJson) {
		db.prepare(
			`INSERT INTO audit_events (
      correlation_id, user_id, user_email, groups_json, roles_json, service_id, ip, action, outcome, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			event.correlationId,
			event.userId,
			event.userEmail,
			groupsJson,
			groupsJson,
			event.serviceId,
			event.ip,
			event.action,
			event.outcome,
			event.detail ?? null,
			new Date().toISOString()
		);
		return;
	}

	db.prepare(
		`INSERT INTO audit_events (
      correlation_id, user_id, user_email, groups_json, service_id, ip, action, outcome, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		event.correlationId,
		event.userId,
		event.userEmail,
		groupsJson,
		event.serviceId,
		event.ip,
		event.action,
		event.outcome,
		event.detail ?? null,
		new Date().toISOString()
	);
}

export type AuditListItem = {
	id: number;
	correlationId: string;
	userId: string;
	userEmail: string | null;
	serviceId: string;
	ip: string;
	action: string;
	outcome: string;
	detail: string | null;
	createdAt: string;
};

export function listRecentAuditEvents(limit = 50): AuditListItem[] {
	return db
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
    ORDER BY id DESC
    LIMIT ?`
		)
		.all(limit) as AuditListItem[];
}
