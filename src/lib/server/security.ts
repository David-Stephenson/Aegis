import crypto from 'node:crypto';
import type { Cookies, RequestEvent } from '@sveltejs/kit';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function assertSameOrigin(event: RequestEvent): void {
	const origin = event.request.headers.get('origin');
	if (!origin) {
		throw new Error('Missing origin header');
	}

	const url = new URL(origin);
	if (url.host !== event.url.host) {
		throw new Error('Cross-site request blocked');
	}
}

export function issueCsrfToken(cookies: Cookies): string {
	const token = crypto.randomBytes(32).toString('hex');
	cookies.set('csrf_token', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production'
	});
	return token;
}

export function verifyCsrfToken(event: RequestEvent): void {
	const cookieToken = event.cookies.get('csrf_token');
	const requestToken = event.request.headers.get('x-csrf-token');

	if (!cookieToken || !requestToken || cookieToken !== requestToken) {
		throw new Error('CSRF validation failed');
	}
}

export function assertRateLimit(key: string, maxRequests: number, windowMs: number): void {
	const now = Date.now();
	const existing = rateLimitStore.get(key);

	if (!existing || now >= existing.resetAt) {
		rateLimitStore.set(key, {
			count: 1,
			resetAt: now + windowMs
		});
		return;
	}

	if (existing.count >= maxRequests) {
		throw new Error('Rate limit exceeded');
	}

	existing.count += 1;
}
