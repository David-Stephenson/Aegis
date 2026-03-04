import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAllowlistHistory, listUserAllowlistActivityStats } from '$lib/server/admin-reports';

const { allMock, prepareMock } = vi.hoisted(() => {
	const allMock = vi.fn();
	const prepareMock = vi.fn(() => ({ all: allMock }));
	return { allMock, prepareMock };
});

vi.mock('$lib/server/db', () => ({
	db: {
		prepare: prepareMock
	}
}));

describe('admin-reports', () => {
	beforeEach(() => {
		allMock.mockReset();
		prepareMock.mockClear();
	});

	it('aggregates allowlist activity by normalized user identity', () => {
		allMock.mockReturnValue([
			{
				id: 3,
				userId: 'new-id',
				userEmail: 'User@example.com',
				serviceId: 'grafana',
				ip: '203.0.113.10',
				action: 'allowlist_add',
				createdAt: '2026-01-03T00:00:00.000Z'
			},
			{
				id: 2,
				userId: 'old-id',
				userEmail: 'user@example.com',
				serviceId: 'argocd',
				ip: '203.0.113.11',
				action: 'allowlist_remove',
				createdAt: '2026-01-02T00:00:00.000Z'
			}
		]);

		const rows = listUserAllowlistActivityStats(50);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			userId: 'new-id',
			userEmail: 'User@example.com',
			totalAdds: 1,
			totalRemoves: 1,
			uniqueServiceCount: 2,
			uniqueIpCount: 2
		});
	});

	it('normalizes allowlist history ordering and action types', () => {
		allMock.mockReturnValue([
			{
				id: 2,
				correlationId: 'corr-2',
				userId: 'u-1',
				userEmail: null,
				serviceId: 'grafana',
				ip: '203.0.113.10',
				action: 'allowlist_add',
				outcome: 'success',
				detail: null,
				createdAt: '2026-01-02T00:00:00.000Z'
			},
			{
				id: 1,
				correlationId: 'corr-1',
				userId: 'u-1',
				userEmail: null,
				serviceId: 'grafana',
				ip: '203.0.113.10',
				action: 'allowlist_remove',
				outcome: 'success',
				detail: null,
				createdAt: '2026-01-01T00:00:00.000Z'
			}
		]);

		const history = listAllowlistHistory(100);
		expect(history.map((entry) => entry.id)).toEqual([2, 1]);
	});
});
