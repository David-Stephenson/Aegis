import { describe, expect, it } from 'vitest';
import { resolveClientIpFromInputs } from '$lib/server/ip';

describe('ip resolution', () => {
	it('uses direct address when no forwarded chain exists', () => {
		expect(resolveClientIpFromInputs(null, '203.0.113.10', ['127.0.0.1/32'])).toBe('203.0.113.10');
	});

	it('returns first untrusted address from right-to-left chain walk', () => {
		const resolved = resolveClientIpFromInputs(
			'198.51.100.11, 203.0.113.9, 10.0.0.3',
			'10.0.0.3',
			['10.0.0.0/8']
		);
		expect(resolved).toBe('203.0.113.9');
	});

	it('returns left-most address when all hops are trusted', () => {
		const resolved = resolveClientIpFromInputs(
			'198.51.100.11, 10.1.0.9',
			'10.1.0.9',
			['10.0.0.0/8']
		);
		expect(resolved).toBe('198.51.100.11');
	});
});
