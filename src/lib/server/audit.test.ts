import { describe, expect, it, vi } from 'vitest';

async function loadAuditModule(columns: Array<{ name: string }>, listRows: unknown[] = []) {
	const runMock = vi.fn();
	const allMock = vi.fn((arg?: unknown) => {
		if (arg === undefined) {
			return columns;
		}
		return listRows;
	});
	const prepareMock = vi.fn((sql: string) => {
		if (sql.includes('PRAGMA table_info(audit_events)')) {
			return { all: () => columns };
		}
		return { run: runMock, all: allMock };
	});

	vi.resetModules();
	vi.doMock('$lib/server/db', () => ({
		db: {
			prepare: prepareMock
		}
	}));

	const mod = await import('$lib/server/audit');
	return { ...mod, runMock, allMock };
}

describe('audit', () => {
	it('writes audit event without legacy roles_json column', async () => {
		const { writeAuditEvent, runMock } = await loadAuditModule([{ name: 'groups_json' }]);

		writeAuditEvent({
			correlationId: 'corr-1',
			userId: 'u-1',
			userEmail: 'user@example.com',
			groups: ['admin'],
			serviceId: 'grafana',
			ip: '203.0.113.10',
			action: 'allowlist_add',
			outcome: 'success'
		});

		expect(runMock).toHaveBeenCalledTimes(1);
		const args = runMock.mock.calls[0] ?? [];
		expect(args).toHaveLength(10);
		expect(args[0]).toBe('corr-1');
		expect(args[3]).toBe(JSON.stringify(['admin']));
	});

	it('writes audit event with legacy roles_json compatibility', async () => {
		const { writeAuditEvent, runMock } = await loadAuditModule([
			{ name: 'groups_json' },
			{ name: 'roles_json' }
		]);

		writeAuditEvent({
			correlationId: 'corr-2',
			userId: 'u-2',
			userEmail: null,
			groups: ['dev'],
			serviceId: 'grafana',
			ip: '203.0.113.11',
			action: 'allowlist_remove',
			outcome: 'error',
			detail: 'failed'
		});

		expect(runMock).toHaveBeenCalledTimes(1);
		const args = runMock.mock.calls[0] ?? [];
		expect(args[3]).toBe(JSON.stringify(['dev']));
		expect(args[4]).toBe(JSON.stringify(['dev']));
	});

	it('lists recent audit events with provided limit', async () => {
		const rows = [
			{
				id: 4,
				correlationId: 'corr-4',
				userId: 'u-4',
				userEmail: 'user@example.com',
				serviceId: 'grafana',
				ip: '203.0.113.12',
				action: 'allowlist_add',
				outcome: 'success',
				detail: null,
				createdAt: '2026-01-02T00:00:00.000Z'
			}
		];
		const { listRecentAuditEvents, allMock } = await loadAuditModule([{ name: 'groups_json' }], rows);

		const result = listRecentAuditEvents(10);
		expect(result).toEqual(rows);
		expect(allMock).toHaveBeenCalledWith(10);
	});
});
