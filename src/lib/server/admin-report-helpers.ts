export type UserAllowlistActivity = {
	userId: string;
	userEmail: string | null;
	totalAdds: number;
	totalRemoves: number;
	lastActivityAt: string;
	uniqueServiceCount: number;
	uniqueIpCount: number;
	serviceIds?: string[];
	ips?: string[];
};

export type AllowlistHistoryItem = {
	id: number;
	correlationId: string;
	userId: string;
	userEmail: string | null;
	serviceId: string;
	ip: string;
	action: 'allowlist_add' | 'allowlist_remove';
	outcome: 'success' | 'denied' | 'error';
	detail: string | null;
	createdAt: string;
};

export type DirectoryUser = {
	id: string;
	username: string;
	email: string | null;
	name: string | null;
	isActive: boolean;
	groups: string[];
	source: 'live' | 'local-only';
	activity: UserAllowlistActivity;
};

export type AuthentikDirectoryUser = {
	id: string;
	username: string;
	email: string | null;
	name: string | null;
	isActive: boolean;
	groups: string[];
};

const emptyActivity = (userId: string, userEmail: string | null): UserAllowlistActivity => ({
	userId,
	userEmail,
	totalAdds: 0,
	totalRemoves: 0,
	lastActivityAt: '',
	uniqueServiceCount: 0,
	uniqueIpCount: 0
});

function normalizeEmail(email: string | null | undefined): string | null {
	if (!email) {
		return null;
	}
	return email.trim().toLowerCase() || null;
}

function combineActivityRecords(
	base: UserAllowlistActivity,
	next: UserAllowlistActivity
): UserAllowlistActivity {
	const canMergeServiceSets = Array.isArray(base.serviceIds) && Array.isArray(next.serviceIds);
	const canMergeIpSets = Array.isArray(base.ips) && Array.isArray(next.ips);
	const mergedServiceIds = canMergeServiceSets
		? new Set<string>([...(base.serviceIds ?? []), ...(next.serviceIds ?? [])])
		: null;
	const mergedIps = canMergeIpSets
		? new Set<string>([...(base.ips ?? []), ...(next.ips ?? [])])
		: null;
	const baseTs = Date.parse(base.lastActivityAt || '1970-01-01T00:00:00.000Z');
	const nextTs = Date.parse(next.lastActivityAt || '1970-01-01T00:00:00.000Z');
	const mostRecent = nextTs > baseTs ? next : base;
	return {
		userId: mostRecent.userId,
		userEmail: mostRecent.userEmail,
		totalAdds: base.totalAdds + next.totalAdds,
		totalRemoves: base.totalRemoves + next.totalRemoves,
		lastActivityAt: mostRecent.lastActivityAt,
		uniqueServiceCount: mergedServiceIds
			? mergedServiceIds.size
			: base.uniqueServiceCount + next.uniqueServiceCount,
		uniqueIpCount: mergedIps ? mergedIps.size : base.uniqueIpCount + next.uniqueIpCount,
		serviceIds: mergedServiceIds ? [...mergedServiceIds] : undefined,
		ips: mergedIps ? [...mergedIps] : undefined
	};
}

function collapseActivityByIdentity(localActivity: UserAllowlistActivity[]): UserAllowlistActivity[] {
	const collapsed = new Map<string, UserAllowlistActivity>();
	for (const activity of localActivity) {
		const key = normalizeEmail(activity.userEmail) ?? `user:${activity.userId}`;
		const existing = collapsed.get(key);
		if (!existing) {
			collapsed.set(key, activity);
			continue;
		}
		collapsed.set(key, combineActivityRecords(existing, activity));
	}
	return [...collapsed.values()];
}

export function mergeUsersWithActivity(
	liveUsers: AuthentikDirectoryUser[],
	localActivity: UserAllowlistActivity[]
): DirectoryUser[] {
	const collapsedActivity = collapseActivityByIdentity(localActivity);
	const activityByUserId = new Map(collapsedActivity.map((item) => [item.userId, item]));
	const activityByEmail = new Map<string, UserAllowlistActivity>();
	for (const item of collapsedActivity) {
		const email = normalizeEmail(item.userEmail);
		if (!email) {
			continue;
		}
		if (!activityByEmail.has(email)) {
			activityByEmail.set(email, item);
		}
	}

	const merged: DirectoryUser[] = [];
	const consumedUserIds = new Set<string>();

	for (const liveUser of liveUsers) {
		const matchedById = activityByUserId.get(liveUser.id);
		const matchedByEmail = normalizeEmail(liveUser.email)
			? activityByEmail.get(normalizeEmail(liveUser.email) as string)
			: undefined;
		const activity = matchedById ?? matchedByEmail ?? emptyActivity(liveUser.id, liveUser.email);
		consumedUserIds.add(activity.userId);
		merged.push({
			...liveUser,
			source: 'live',
			activity
		});
	}

	for (const activity of collapsedActivity) {
		if (consumedUserIds.has(activity.userId)) {
			continue;
		}
		merged.push({
			id: activity.userId,
			username: activity.userEmail ?? activity.userId,
			email: activity.userEmail,
			name: activity.userEmail,
			isActive: false,
			groups: [],
			source: 'local-only',
			activity
		});
	}

	return merged.sort((a, b) => {
		const aTs = Date.parse(a.activity.lastActivityAt || '1970-01-01T00:00:00.000Z');
		const bTs = Date.parse(b.activity.lastActivityAt || '1970-01-01T00:00:00.000Z');
		if (aTs !== bTs) {
			return bTs - aTs;
		}
		const aName = (a.name ?? a.email ?? a.username ?? a.id).toLowerCase();
		const bName = (b.name ?? b.email ?? b.username ?? b.id).toLowerCase();
		return aName.localeCompare(bName);
	});
}

export function normalizeAllowlistHistory(rows: AllowlistHistoryItem[]): AllowlistHistoryItem[] {
	return rows
		.filter((row) => row.action === 'allowlist_add' || row.action === 'allowlist_remove')
		.sort((a, b) => b.id - a.id);
}
