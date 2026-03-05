import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	listAllowlistEntries,
	listAllowlistEntriesForUser,
	removeAllowlistEntry,
	upsertAllowlistEntry
} from '$lib/server/allowlist-store';

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

describe('allowlist-store', () => {
	beforeEach(() => {
		runMock.mockReset();
		allMock.mockReset();
		prepareMock.mockClear();
	});

	it('upserts allowlist rows with expected values', () => {
		upsertAllowlistEntry({
			userId: 'u-1',
			userEmail: 'user@example.com',
			serviceId: 'grafana',
			ip: '203.0.113.10'
		});

		expect(prepareMock).toHaveBeenCalledTimes(1);
		expect(runMock).toHaveBeenCalledTimes(1);
		expect(runMock.mock.calls[0]?.[0]).toBe('u-1');
		expect(runMock.mock.calls[0]?.[1]).toBe('user@example.com');
		expect(runMock.mock.calls[0]?.[2]).toBe('grafana');
		expect(runMock.mock.calls[0]?.[3]).toBe('203.0.113.10');
	});

	it('removes allowlist rows by service and ip', () => {
		removeAllowlistEntry('grafana', '203.0.113.10');
		expect(runMock).toHaveBeenCalledWith('grafana', '203.0.113.10');
	});

	it('lists user allowlist rows', () => {
		allMock.mockReturnValue([
			{
				id: 1,
				userId: 'u-1',
				userEmail: 'user@example.com',
				serviceId: 'grafana',
				ip: '203.0.113.10',
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			}
		]);

		const rows = listAllowlistEntriesForUser('u-1');
		expect(rows).toHaveLength(1);
		expect(rows[0]?.serviceId).toBe('grafana');
		expect(allMock).toHaveBeenCalledWith('u-1');
	});

	it('lists allowlist rows with requested limit', () => {
		allMock.mockReturnValue([]);
		listAllowlistEntries(25);
		expect(allMock).toHaveBeenCalledWith(25);
	});
});
