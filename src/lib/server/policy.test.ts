import { afterEach, describe, expect, it } from 'vitest';
import { appEnv } from '$lib/server/env';
import { canUserAccessService, getAllowedServiceIdsForGroups } from '$lib/server/policy';

const originalGroupServiceMap = { ...appEnv.groupServiceMap };
const originalServices = [...appEnv.services];

afterEach(() => {
	appEnv.groupServiceMap = { ...originalGroupServiceMap };
	appEnv.services = [...originalServices];
});

describe('policy checks', () => {
	it('expands group mappings into unique service IDs', () => {
		appEnv.groupServiceMap = {
			admin: ['grafana', 'argocd'],
			dev: ['grafana']
		};

		expect(getAllowedServiceIdsForGroups(['admin', 'dev']).sort()).toEqual(['argocd', 'grafana']);
	});

	it('blocks access when service exists but group is not mapped', () => {
		appEnv.services = [
			{
				id: 'grafana',
				name: 'Grafana',
				description: 'dashboards',
				allowlistConfigPath: '/config/apps/http/servers/srv0/routes/0/match/0/remote_ip'
			}
		];
		appEnv.groupServiceMap = {
			admin: ['grafana']
		};

		const allowed = canUserAccessService({ id: 'u1', groups: ['admin'] }, 'grafana');
		const denied = canUserAccessService({ id: 'u2', groups: ['dev'] }, 'grafana');

		expect(allowed).toBe(true);
		expect(denied).toBe(false);
	});
});
