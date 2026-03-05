import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { createRequestEvent } from '$lib/server/test-helpers';

const {
	requireAuthUserMock,
	assertSameOriginMock,
	verifyCsrfTokenMock,
	assertRateLimitMock,
	getServiceByIdMock,
	resolveClientIpMock,
	canUserAccessServiceMock,
	allowlistIpMock,
	removeAllowlistIpMock,
	upsertAllowlistEntryMock,
	removeAllowlistEntryMock,
	writeAuditEventMock
} = vi.hoisted(() => ({
	requireAuthUserMock: vi.fn(),
	assertSameOriginMock: vi.fn(),
	verifyCsrfTokenMock: vi.fn(),
	assertRateLimitMock: vi.fn(),
	getServiceByIdMock: vi.fn(),
	resolveClientIpMock: vi.fn(),
	canUserAccessServiceMock: vi.fn(),
	allowlistIpMock: vi.fn(),
	removeAllowlistIpMock: vi.fn(),
	upsertAllowlistEntryMock: vi.fn(),
	removeAllowlistEntryMock: vi.fn(),
	writeAuditEventMock: vi.fn()
}));

vi.mock('$lib/server/session', () => ({ requireAuthUser: requireAuthUserMock }));
vi.mock('$lib/server/security', () => ({
	assertSameOrigin: assertSameOriginMock,
	verifyCsrfToken: verifyCsrfTokenMock,
	assertRateLimit: assertRateLimitMock
}));
vi.mock('$lib/server/services', () => ({ getServiceById: getServiceByIdMock }));
vi.mock('$lib/server/ip', () => ({ resolveClientIp: resolveClientIpMock }));
vi.mock('$lib/server/policy', () => ({ canUserAccessService: canUserAccessServiceMock }));
vi.mock('$lib/server/caddy-api', () => ({
	allowlistIp: allowlistIpMock,
	removeAllowlistIp: removeAllowlistIpMock
}));
vi.mock('$lib/server/allowlist-store', () => ({
	upsertAllowlistEntry: upsertAllowlistEntryMock,
	removeAllowlistEntry: removeAllowlistEntryMock
}));
vi.mock('$lib/server/audit', () => ({ writeAuditEvent: writeAuditEventMock }));

describe('/api/allowlist POST', () => {
	beforeEach(() => {
		requireAuthUserMock.mockReset();
		assertSameOriginMock.mockReset();
		verifyCsrfTokenMock.mockReset();
		assertRateLimitMock.mockReset();
		getServiceByIdMock.mockReset();
		resolveClientIpMock.mockReset();
		canUserAccessServiceMock.mockReset();
		allowlistIpMock.mockReset();
		removeAllowlistIpMock.mockReset();
		upsertAllowlistEntryMock.mockReset();
		removeAllowlistEntryMock.mockReset();
		writeAuditEventMock.mockReset();

		requireAuthUserMock.mockResolvedValue({
			id: 'test-admin',
			email: 'admin@example.com',
			groups: ['admin']
		});
		resolveClientIpMock.mockReturnValue('203.0.113.10');
		getServiceByIdMock.mockResolvedValue({
			id: 'grafana',
			allowlistConfigPath: '/config/path'
		});
		canUserAccessServiceMock.mockReturnValue(true);
	});

	it('handles allow action success', async () => {
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/api/allowlist',
			jsonBody: { action: 'allow', serviceId: 'grafana' }
		});

		const response = await POST(event as never);
		const json = await response.json();
		expect(response.status).toBe(200);
		expect(json.ok).toBe(true);
		expect(allowlistIpMock).toHaveBeenCalledWith('/config/path', '203.0.113.10');
		expect(upsertAllowlistEntryMock).toHaveBeenCalled();
	});

	it('handles revoke action success', async () => {
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/api/allowlist',
			jsonBody: { action: 'revoke', serviceId: 'grafana' }
		});

		const response = await POST(event as never);
		expect(response.status).toBe(200);
		expect(removeAllowlistIpMock).toHaveBeenCalledWith('/config/path', '203.0.113.10');
		expect(removeAllowlistEntryMock).toHaveBeenCalledWith('grafana', '203.0.113.10');
	});

	it('returns 400 for unknown service', async () => {
		getServiceByIdMock.mockResolvedValueOnce(null);
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/api/allowlist',
			jsonBody: { action: 'allow', serviceId: 'missing' }
		});
		await expect(POST(event as never)).rejects.toMatchObject({ status: 400 });
	});

	it('returns 403 and writes denied audit when policy blocks service', async () => {
		canUserAccessServiceMock.mockReturnValueOnce(false);
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/api/allowlist',
			jsonBody: { action: 'allow', serviceId: 'grafana' }
		});
		await expect(POST(event as never)).rejects.toMatchObject({ status: 403 });
		expect(writeAuditEventMock).toHaveBeenCalled();
	});

	it('returns 502 and writes error audit when caddy call fails', async () => {
		allowlistIpMock.mockRejectedValueOnce(new Error('caddy down'));
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/api/allowlist',
			jsonBody: { action: 'allow', serviceId: 'grafana' }
		});
		await expect(POST(event as never)).rejects.toMatchObject({ status: 502 });
		expect(writeAuditEventMock).toHaveBeenCalled();
	});

	it('propagates same-origin/csrf/rate-limit validation failures', async () => {
		assertSameOriginMock.mockImplementationOnce(() => {
			throw new Error('Cross-site request blocked');
		});
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/api/allowlist',
			jsonBody: { action: 'allow', serviceId: 'grafana' }
		});
		await expect(POST(event as never)).rejects.toThrow('Cross-site request blocked');
	});
});
