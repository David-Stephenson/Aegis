import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';
import { createRequestEvent } from '$lib/server/test-helpers';

const { requireAuthUserMock, upsertServiceOverrideMock } = vi.hoisted(() => ({
	requireAuthUserMock: vi.fn(),
	upsertServiceOverrideMock: vi.fn()
}));

vi.mock('$lib/server/session', () => ({ requireAuthUser: requireAuthUserMock }));
vi.mock('$lib/server/service-overrides', () => ({
	upsertServiceOverride: upsertServiceOverrideMock
}));

describe('/admin/services actions', () => {
	beforeEach(() => {
		requireAuthUserMock.mockReset();
		upsertServiceOverrideMock.mockReset();
	});

	it('rejects non-admin users', async () => {
		requireAuthUserMock.mockResolvedValue({ id: 'u-1', groups: ['dev'] });
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/services',
			formData: { serviceId: 'grafana' }
		});

		await expect(actions.updateService(event as never)).rejects.toMatchObject({ status: 403 });
	});

	it('returns 400 fail object for invalid payload', async () => {
		requireAuthUserMock.mockResolvedValue({ id: 'test-admin', groups: ['admin'] });
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/services',
			formData: { serviceId: '', sortOrder: 'bad' }
		});

		const result = await actions.updateService(event as never);
		expect(result).toMatchObject({ status: 400 });
	});

	it('upserts service settings for valid payload', async () => {
		requireAuthUserMock.mockResolvedValue({ id: 'test-admin', groups: ['admin'] });
		const event = createRequestEvent({
			method: 'POST',
			pathname: 'http://localhost/admin/services',
			formData: {
				serviceId: 'grafana',
				displayName: 'Grafana',
				description: 'Metrics',
				icon: '📈',
				sortOrder: '5',
				enabled: 'on'
			}
		});

		const result = await actions.updateService(event as never);
		expect(result).toEqual({ ok: true });
		expect(upsertServiceOverrideMock).toHaveBeenCalledWith({
			serviceId: 'grafana',
			displayName: 'Grafana',
			description: 'Metrics',
			icon: '📈',
			sortOrder: 5,
			enabled: true
		});
	});
});
