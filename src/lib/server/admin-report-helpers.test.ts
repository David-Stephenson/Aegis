import { describe, expect, it } from 'vitest';
import { mergeUsersWithActivity, normalizeAllowlistHistory } from '$lib/server/admin-report-helpers';

describe('mergeUsersWithActivity', () => {
	it('merges live users with activity and excludes local-only users', () => {
		const users = mergeUsersWithActivity(
			[
				{
					id: 'auth-1',
					username: 'alice',
					email: 'alice@example.com',
					name: 'Alice',
					isActive: true,
					groups: ['admin']
				}
			],
			[
				{
					userId: 'auth-1',
					userEmail: 'alice@example.com',
					totalAdds: 3,
					totalRemoves: 1,
					lastActivityAt: '2026-01-02T00:00:00.000Z',
					uniqueServiceCount: 2,
					uniqueIpCount: 2
				},
				{
					userId: 'legacy-user',
					userEmail: 'legacy@example.com',
					totalAdds: 1,
					totalRemoves: 0,
					lastActivityAt: '2026-01-03T00:00:00.000Z',
					uniqueServiceCount: 1,
					uniqueIpCount: 1
				}
			]
		);

		expect(users).toHaveLength(1);
		expect(users[0]?.id).toBe('auth-1');
		expect(users[0]?.source).toBe('live');
		expect(users[0]?.activity.totalAdds).toBe(3);
	});

	it('returns empty list when no live users are present', () => {
		const users = mergeUsersWithActivity([], [
			{
				userId: 'old-subject-id',
				userEmail: 'david@example.com',
				totalAdds: 1,
				totalRemoves: 0,
				lastActivityAt: '2026-01-01T00:00:00.000Z',
				uniqueServiceCount: 1,
				uniqueIpCount: 1
			},
			{
				userId: 'new-subject-id',
				userEmail: 'david@example.com',
				totalAdds: 2,
				totalRemoves: 1,
				lastActivityAt: '2026-01-02T00:00:00.000Z',
				uniqueServiceCount: 1,
				uniqueIpCount: 1
			}
		]);

		expect(users).toEqual([]);
	});
});

describe('normalizeAllowlistHistory', () => {
	it('filters non-allowlist actions and sorts by newest id', () => {
		const normalized = normalizeAllowlistHistory([
			{
				id: 1,
				correlationId: 'c1',
				userId: 'u1',
				userEmail: null,
				serviceId: 'grafana',
				ip: '1.1.1.1',
				action: 'allowlist_add',
				outcome: 'success',
				detail: null,
				createdAt: '2026-01-01T00:00:00.000Z'
			},
			{
				id: 3,
				correlationId: 'c3',
				userId: 'u1',
				userEmail: null,
				serviceId: 'grafana',
				ip: '1.1.1.1',
				action: 'allowlist_remove',
				outcome: 'success',
				detail: null,
				createdAt: '2026-01-03T00:00:00.000Z'
			},
			{
				id: 2,
				correlationId: 'c2',
				userId: 'u2',
				userEmail: null,
				serviceId: 'grafana',
				ip: '2.2.2.2',
				action: 'allowlist_add',
				outcome: 'denied',
				detail: 'policy',
				createdAt: '2026-01-02T00:00:00.000Z'
			}
		]);

		expect(normalized.map((event) => event.id)).toEqual([3, 2, 1]);
	});
});
