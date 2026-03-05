import { afterEach, describe, expect, it } from 'vitest';
import { appEnv } from '$lib/server/env';
import { canUserAccessService, getAllowedServiceIdsForGroups } from '$lib/server/policy';

const originalGroupServiceMap = { ...appEnv.groupServiceMap };

afterEach(() => {
	appEnv.groupServiceMap = { ...originalGroupServiceMap };
});

describe('policy checks', () => {
	it('expands group mappings into unique service IDs', () => {
		appEnv.groupServiceMap = {
			admin: ['grafana', 'argocd'],
			dev: ['grafana']
		};

		expect(getAllowedServiceIdsForGroups(['admin', 'dev']).sort()).toEqual(['argocd', 'grafana']);
	});

	it('allows access only when group is mapped to service', () => {
		appEnv.groupServiceMap = {
			admin: ['grafana']
		};

		const allowed = canUserAccessService({ id: 'u1', groups: ['admin'] }, 'grafana');
		const denied = canUserAccessService({ id: 'u2', groups: ['dev'] }, 'grafana');
		const deniedDifferentService = canUserAccessService({ id: 'u3', groups: ['admin'] }, 'prometheus');

		expect(allowed).toBe(true);
		expect(denied).toBe(false);
		expect(deniedDifferentService).toBe(false);
	});
});
