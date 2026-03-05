import { z } from 'zod';
import { Configuration, CoreApi, FetchError, ResponseError } from '@goauthentik/api';
import { appEnv } from '$lib/server/env';
import type { AuthentikDirectoryUser } from '$lib/server/admin-report-helpers';

const authentikUserSchema = z.object({
	pk: z.union([z.number(), z.string()]),
	username: z.string().optional(),
	email: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
	is_active: z.boolean().optional(),
	isActive: z.boolean().optional(),
	groups_obj: z
		.array(
			z.object({
				name: z.string().optional()
			})
		)
		.optional(),
	groupsObj: z
		.array(
			z.object({
				name: z.string().optional()
			})
		)
		.nullable()
		.optional(),
	groups: z.array(z.union([z.number(), z.string()])).optional()
});

export class AuthentikApiError extends Error {
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.status = status;
	}
}

function normalizeBaseUrl(input: string): string {
	return input.endsWith('/') ? input.slice(0, -1) : input;
}

function normalizeGroupNames(
	groupsObj: Array<{ name?: string }> | undefined,
	groups: Array<string | number> | undefined
): string[] {
	if (groupsObj && groupsObj.length > 0) {
		return groupsObj
			.map((item) => item.name?.trim() ?? '')
			.filter((value) => value.length > 0);
	}
	if (groups && groups.length > 0) {
		return groups.map((value) => String(value));
	}
	return [];
}

export function normalizeAuthentikUser(raw: unknown): AuthentikDirectoryUser | null {
	const parsed = authentikUserSchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}
	const user = parsed.data;
	const id = String(user.pk).trim();
	if (!id) {
		return null;
	}
	return {
		id,
		username: user.username?.trim() || id,
		email: user.email?.trim() || null,
		name: user.name?.trim() || null,
		isActive: user.is_active ?? user.isActive ?? true,
		groups: normalizeGroupNames(user.groups_obj ?? user.groupsObj ?? undefined, user.groups)
	};
}

type AuthentikUsersClient = {
	coreUsersList: (params: { page: number; pageSize: number; includeGroups: boolean }) => Promise<{
		results: unknown[];
		pagination?: { next?: number | null } | null;
	}>;
};

function createAuthentikUsersClient(fetchImpl: typeof fetch): AuthentikUsersClient {
	const configuration = new Configuration({
		basePath: normalizeBaseUrl(appEnv.AUTHENTIK_API_BASE_URL),
		accessToken: appEnv.AUTHENTIK_API_TOKEN,
		fetchApi: fetchImpl
	});
	return new CoreApi(configuration);
}

async function toAuthentikApiError(caught: unknown): Promise<AuthentikApiError> {
	if (caught instanceof ResponseError) {
		const body = await caught.response.text();
		return new AuthentikApiError(
			`Authentik API request failed (${caught.response.status}): ${body || 'No response body'}`,
			caught.response.status
		);
	}
	if (caught instanceof FetchError) {
		const message = caught.cause instanceof Error ? caught.cause.message : String(caught.cause);
		return new AuthentikApiError(`Authentik API request failed: ${message}`);
	}
	if (caught instanceof Error) {
		return new AuthentikApiError(caught.message);
	}
	return new AuthentikApiError('Unknown Authentik API error');
}

function getNextPage(
	pagination: {
		next?: number | null;
	} | null | undefined
): number | null {
	const next = pagination?.next;
	return typeof next === 'number' && Number.isFinite(next) && next > 0 ? next : null;
}

async function fetchPage(
	page: number,
	client: AuthentikUsersClient
): Promise<{ results: unknown[]; nextPage: number | null }> {
	try {
		const payload = await client.coreUsersList({
			page,
			pageSize: 200,
			includeGroups: true
		});
		return {
			results: payload.results,
			nextPage: getNextPage(payload.pagination)
		};
	} catch (caught) {
		throw await toAuthentikApiError(caught);
	}
}

export async function listAuthentikUsers(
	fetchImpl: typeof fetch = fetch,
	client: AuthentikUsersClient = createAuthentikUsersClient(fetchImpl)
): Promise<AuthentikDirectoryUser[]> {
	let pageNumber: number | null = 1;
	const users: AuthentikDirectoryUser[] = [];
	const seenIds = new Set<string>();
	let attempts = 0;
	const maxPages = 30;

	while (pageNumber && attempts < maxPages) {
		attempts += 1;
		const page = await fetchPage(pageNumber, client);
		for (const rawUser of page.results) {
			const normalized = normalizeAuthentikUser(rawUser);
			if (!normalized || seenIds.has(normalized.id)) {
				continue;
			}
			seenIds.add(normalized.id);
			users.push(normalized);
		}
		pageNumber = page.nextPage;
	}

	return users.sort((a, b) => a.username.localeCompare(b.username));
}

export async function listAuthentikUsersSafely(
	fetchImpl: typeof fetch = fetch,
	client: AuthentikUsersClient = createAuthentikUsersClient(fetchImpl)
): Promise<{ users: AuthentikDirectoryUser[]; warning: string | null }> {
	try {
		return {
			users: await listAuthentikUsers(fetchImpl, client),
			warning: null
		};
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : 'Unknown Authentik API error';
		return {
			users: [],
			warning: `Failed to load live Authentik users: ${message}`
		};
	}
}
