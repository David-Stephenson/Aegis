import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';
import { createRequestEvent } from '$lib/server/test-helpers';

const {
	requireAuthUserMock,
	resolveClientIpMock,
	getAllowedServiceIdsForGroupsMock,
	getServiceDefinitionsMock,
	listAllowlistEntriesForUserMock,
	allowlistIpMock,
	upsertAllowlistEntryMock,
	writeAuditEventMock
} = vi.hoisted(() => ({
	requireAuthUserMock: vi.fn(),
	resolveClientIpMock: vi.fn(),
	getAllowedServiceIdsForGroupsMock: vi.fn(),
	getServiceDefinitionsMock: vi.fn(),
	listAllowlistEntriesForUserMock: vi.fn(),
	allowlistIpMock: vi.fn(),
	upsertAllowlistEntryMock: vi.fn(),
	writeAuditEventMock: vi.fn()
}));

vi.mock('$lib/server/session', () => ({ requireAuthUser: requireAuthUserMock }));
vi.mock('$lib/server/ip', () => ({ resolveClientIp: resolveClientIpMock }));
vi.mock('$lib/server/policy', () => ({
	getAllowedServiceIdsForGroups: getAllowedServiceIdsForGroupsMock
}));
vi.mock('$lib/server/services', () => ({ getServiceDefinitions: getServiceDefinitionsMock }));
vi.mock('$lib/server/allowlist-store', () => ({
	listAllowlistEntriesForUser: listAllowlistEntriesForUserMock,
	upsertAllowlistEntry: upsertAllowlistEntryMock
}));
vi.mock('$lib/server/caddy-api', () => ({ allowlistIp: allowlistIpMock }));
vi.mock('$lib/server/audit', () => ({ writeAuditEvent: writeAuditEventMock }));

describe('/authorized load', () => {
	beforeEach(() => {
		requireAuthUserMock.mockReset();
		resolveClientIpMock.mockReset();
		getAllowedServiceIdsForGroupsMock.mockReset();
		getServiceDefinitionsMock.mockReset();
		listAllowlistEntriesForUserMock.mockReset();
		allowlistIpMock.mockReset();
		upsertAllowlistEntryMock.mockReset();
		writeAuditEventMock.mockReset();
	});

	it('marks existing authorization without caddy mutation', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		resolveClientIpMock.mockReturnValue('203.0.113.10');
		getAllowedServiceIdsForGroupsMock.mockReturnValue(['grafana']);
		getServiceDefinitionsMock.mockResolvedValue([
			{ id: 'grafana', name: 'Grafana', allowlistConfigPath: '/config/path' }
		]);
		listAllowlistEntriesForUserMock.mockReturnValue([
			{ serviceId: 'grafana', ip: '203.0.113.10' }
		]);

		const event = createRequestEvent({ pathname: 'http://localhost/authorized' });
		const result = await load(event as never);

		expect(result.results).toEqual([
			{
				serviceId: 'grafana',
				serviceName: 'Grafana',
				status: 'already_authorized'
			}
		]);
		expect(allowlistIpMock).not.toHaveBeenCalled();
	});

	it('returns failed status when caddy update fails', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		resolveClientIpMock.mockReturnValue('203.0.113.10');
		getAllowedServiceIdsForGroupsMock.mockReturnValue(['grafana']);
		getServiceDefinitionsMock.mockResolvedValue([
			{ id: 'grafana', name: 'Grafana', allowlistConfigPath: '/config/path' }
		]);
		listAllowlistEntriesForUserMock.mockReturnValue([]);
		allowlistIpMock.mockRejectedValueOnce(new Error('caddy down'));

		const event = createRequestEvent({ pathname: 'http://localhost/authorized' });
		const result = await load(event as never);

		expect(result.results[0]).toMatchObject({
			serviceId: 'grafana',
			status: 'failed'
		});
		expect(writeAuditEventMock).toHaveBeenCalled();
	});
});
