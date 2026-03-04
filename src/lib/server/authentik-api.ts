import { z } from 'zod';
import { appEnv } from '$lib/server/env';
import type { AuthentikDirectoryUser } from '$lib/server/admin-report-helpers';

const authentikUserSchema = z.object({
	pk: z.union([z.number(), z.string()]),
	username: z.string().optional(),
	email: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
	is_active: z.boolean().optional(),
	groups_obj: z
		.array(
			z.object({
				name: z.string().optional()
			})
		)
		.optional(),
	groups: z.array(z.union([z.number(), z.string()])).optional()
});

const authentikListSchema = z.object({
	results: z.array(z.unknown()),
	next: z.string().nullable().optional()
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
		isActive: user.is_active ?? true,
		groups: normalizeGroupNames(user.groups_obj, user.groups)
	};
}

async function fetchPage(
	pathWithQuery: string,
	fetchImpl: typeof fetch
): Promise<{ results: unknown[]; next: string | null }> {
	const response = await fetchImpl(pathWithQuery, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${appEnv.AUTHENTIK_API_TOKEN}`,
			'Content-Type': 'application/json'
		}
	});
	if (!response.ok) {
		const body = await response.text();
		throw new AuthentikApiError(
			`Authentik API request failed (${response.status}): ${body || 'No response body'}`,
			response.status
		);
	}
	const payload = authentikListSchema.parse((await response.json()) as unknown);
	return {
		results: payload.results,
		next: payload.next ?? null
	};
}

export async function listAuthentikUsers(fetchImpl: typeof fetch = fetch): Promise<AuthentikDirectoryUser[]> {
	const baseUrl = normalizeBaseUrl(appEnv.AUTHENTIK_API_BASE_URL);
	let cursor: string | null = `${baseUrl}/core/users/?page=1&page_size=200`;
	const users: AuthentikDirectoryUser[] = [];
	const seenIds = new Set<string>();
	let attempts = 0;
	const maxPages = 30;

	while (cursor && attempts < maxPages) {
		attempts += 1;
		const page = await fetchPage(cursor, fetchImpl);
		for (const rawUser of page.results) {
			const normalized = normalizeAuthentikUser(rawUser);
			if (!normalized || seenIds.has(normalized.id)) {
				continue;
			}
			seenIds.add(normalized.id);
			users.push(normalized);
		}
		cursor = page.next;
	}

	return users.sort((a, b) => a.username.localeCompare(b.username));
}

export async function listAuthentikUsersSafely(
	fetchImpl: typeof fetch = fetch
): Promise<{ users: AuthentikDirectoryUser[]; warning: string | null }> {
	try {
		return {
			users: await listAuthentikUsers(fetchImpl),
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
