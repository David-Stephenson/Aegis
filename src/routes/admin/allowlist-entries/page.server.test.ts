import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';
import { createRequestEvent } from '$lib/server/test-helpers';

const {
	requireAuthUserMock,
	getServiceByIdMock,
	removeAllowlistIpMock,
	removeAllowlistEntryMock,
	writeAuditEventMock
} = vi.hoisted(() => ({
	requireAuthUserMock: vi.fn(),
	getServiceByIdMock: vi.fn(),
	removeAllowlistIpMock: vi.fn(),
	removeAllowlistEntryMock: vi.fn(),
	writeAuditEventMock: vi.fn()
}));

vi.mock('$lib/server/session', () => ({ requireAuthUser: requireAuthUserMock }));
vi.mock('$lib/server/services', () => ({ getServiceById: getServiceByIdMock }));
vi.mock('$lib/server/caddy-api', () => ({ removeAllowlistIp: removeAllowlistIpMock }));
vi.mock('$lib/server/allowlist-store', () => ({ removeAllowlistEntry: removeAllowlistEntryMock }));
vi.mock('$lib/server/audit', () => ({ writeAuditEvent: writeAuditEventMock }));

describe('/admin/allowlist-entries actions', () => {
	beforeEach(() => {
		requireAuthUserMock.mockReset();
		getServiceByIdMock.mockReset();
		removeAllowlistIpMock.mockReset();
		removeAllowlistEntryMock.mockReset();
		writeAuditEventMock.mockReset();
	});

	it('rejects non-admin users', async () => {
		requireAuthUserMock.mockResolvedValue({ id: 'u-1', groups: ['dev'] });
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/allowlist-entries',
			formData: { serviceId: 'grafana', ip: '203.0.113.10' }
		});
		await expect(actions.revokeAllowlistEntry(event as never)).rejects.toMatchObject({ status: 403 });
	});

	it('returns 400 fail object when form payload is invalid', async () => {
		requireAuthUserMock.mockResolvedValue({ id: 'test-admin', groups: ['admin'] });
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/allowlist-entries',
			formData: { serviceId: '', ip: '' }
		});
		const result = await actions.revokeAllowlistEntry(event as never);
		expect(result).toMatchObject({ status: 400 });
	});

	it('returns fail when service is unavailable', async () => {
		requireAuthUserMock.mockResolvedValue({ id: 'test-admin', groups: ['admin'] });
		getServiceByIdMock.mockResolvedValue(null);
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/allowlist-entries',
			formData: { serviceId: 'grafana', ip: '203.0.113.10' }
		});
		const result = await actions.revokeAllowlistEntry(event as never);
		expect(result).toMatchObject({ status: 400 });
	});

	it('revokes allowlist row and writes success audit', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		getServiceByIdMock.mockResolvedValue({ id: 'grafana', allowlistConfigPath: '/config/path' });
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/allowlist-entries',
			formData: { serviceId: 'grafana', ip: '203.0.113.10' }
		});
		const result = await actions.revokeAllowlistEntry(event as never);
		expect(result).toEqual({ ok: true });
		expect(removeAllowlistIpMock).toHaveBeenCalledWith('/config/path', '203.0.113.10');
		expect(removeAllowlistEntryMock).toHaveBeenCalledWith('grafana', '203.0.113.10');
		expect(writeAuditEventMock).toHaveBeenCalled();
	});

	it('returns 502 fail object and writes error audit when revoke fails', async () => {
		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		getServiceByIdMock.mockResolvedValue({ id: 'grafana', allowlistConfigPath: '/config/path' });
		removeAllowlistIpMock.mockRejectedValueOnce(new Error('caddy down'));

		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/allowlist-entries',
			formData: { serviceId: 'grafana', ip: '203.0.113.10' }
		});
		const result = await actions.revokeAllowlistEntry(event as never);
		expect(result).toMatchObject({ status: 502 });
		expect(writeAuditEventMock).toHaveBeenCalled();
		expect(removeAllowlistEntryMock).not.toHaveBeenCalled();
	});
});
