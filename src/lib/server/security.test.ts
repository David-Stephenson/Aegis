import { describe, expect, it, vi } from 'vitest';
import {
	assertRateLimit,
	assertSameOrigin,
	issueCsrfToken,
	verifyCsrfToken
} from '$lib/server/security';
import { createCookieStore, createRequestEvent } from '$lib/server/test-helpers';

describe('security helpers', () => {
	it('allows same-origin requests and blocks cross-origin requests', () => {
		const sameOriginEvent = createRequestEvent({
			pathname: 'http://localhost/verify',
			origin: 'http://localhost'
		});
		expect(() => assertSameOrigin(sameOriginEvent)).not.toThrow();

		const crossOriginEvent = createRequestEvent({
			pathname: 'http://localhost/verify',
			origin: 'http://evil.example'
		});
		expect(() => assertSameOrigin(crossOriginEvent)).toThrow('Cross-site request blocked');
	});

	it('issues and verifies csrf token', () => {
		const cookies = createCookieStore();
		const token = issueCsrfToken(cookies);
		expect(token).toHaveLength(64);
		expect(cookies.get('csrf_token')).toBe(token);

		const event = createRequestEvent({
			pathname: 'http://localhost/api/allowlist',
			headers: { 'x-csrf-token': token },
			cookies
		});
		expect(() => verifyCsrfToken(event)).not.toThrow();
	});

	it('fails csrf verification when header does not match cookie', () => {
		const cookies = createCookieStore({ csrf_token: 'cookie-token' });
		const event = createRequestEvent({
			pathname: 'http://localhost/api/allowlist',
			headers: { 'x-csrf-token': 'header-token' },
			cookies
		});
		expect(() => verifyCsrfToken(event)).toThrow('CSRF validation failed');
	});

	it('enforces per-window rate limits and resets after the window', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
			expect(() => assertRateLimit('rate:test', 2, 1000)).not.toThrow();
			expect(() => assertRateLimit('rate:test', 2, 1000)).not.toThrow();
			expect(() => assertRateLimit('rate:test', 2, 1000)).toThrow('Rate limit exceeded');

			vi.setSystemTime(new Date('2026-01-01T00:00:01.500Z'));
			expect(() => assertRateLimit('rate:test', 2, 1000)).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});
});
