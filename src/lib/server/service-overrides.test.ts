import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listServiceOverrides, upsertServiceOverride } from '$lib/server/service-overrides';

const { runMock, allMock, prepareMock } = vi.hoisted(() => {
	const runMock = vi.fn();
	const allMock = vi.fn();
	const prepareMock = vi.fn(() => ({
		run: runMock,
		all: allMock
	}));
	return { runMock, allMock, prepareMock };
});

vi.mock('$lib/server/db', () => ({
	db: {
		prepare: prepareMock
	}
}));

describe('service-overrides', () => {
	beforeEach(() => {
		runMock.mockReset();
		allMock.mockReset();
		prepareMock.mockClear();
	});

	it('maps enabled integers to booleans on list', () => {
		allMock.mockReturnValue([
			{
				serviceId: 'grafana',
				displayName: 'Grafana',
				description: 'Metrics',
				icon: null,
				sortOrder: 1,
				enabled: 1,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			},
			{
				serviceId: 'jellyfin',
				displayName: 'Jellyfin',
				description: 'Media',
				icon: null,
				sortOrder: 2,
				enabled: 0,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			}
		]);

		const rows = listServiceOverrides();
		expect(rows.map((entry) => entry.enabled)).toEqual([true, false]);
	});

	it('upserts rows with enabled converted to sqlite integer', () => {
		upsertServiceOverride({
			serviceId: 'grafana',
			displayName: 'Grafana',
			description: 'Metrics',
			icon: null,
			sortOrder: 3,
			enabled: false
		});

		expect(runMock).toHaveBeenCalledTimes(1);
		const args = runMock.mock.calls[0] ?? [];
		expect(args[0]).toBe('grafana');
		expect(args[4]).toBe(3);
		expect(args[5]).toBe(0);
	});
});
