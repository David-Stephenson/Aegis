import { appEnv } from '$lib/server/env';

export type AuthUser = {
	id: string;
	email?: string | null;
	name?: string | null;
	groups: string[];
};

export function getAllowedServiceIdsForGroups(groups: string[]): string[] {
	const allowed = new Set<string>();
	for (const group of groups) {
		for (const serviceId of appEnv.groupServiceMap[group] ?? []) {
			allowed.add(serviceId);
		}
	}
	return [...allowed];
}

export function canUserAccessService(user: AuthUser, serviceId: string): boolean {
	return getAllowedServiceIdsForGroups(user.groups).includes(serviceId);
}
