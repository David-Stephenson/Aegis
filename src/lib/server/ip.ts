import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import type { RequestEvent } from '@sveltejs/kit';
import { appEnv } from '$lib/server/env';

type CidrTuple = [ipaddr.IPv4 | ipaddr.IPv6, number];
let warnedAboutMissingTrustedProxies = false;

function normalizeIp(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed || !isIP(trimmed)) {
		return null;
	}
	return trimmed;
}

function parseForwardedFor(headerValue: string | null): string[] {
	if (!headerValue) {
		return [];
	}

	return headerValue
		.split(',')
		.map((segment) => normalizeIp(segment))
		.filter((value): value is string => value !== null);
}

function parseCidrs(rawCidrs: string[]): CidrTuple[] {
	return rawCidrs.map((cidr) => ipaddr.parseCIDR(cidr));
}

function isTrustedProxy(ip: string, trustedCidrs: CidrTuple[]): boolean {
	const parsedIp = ipaddr.parse(ip);
	return trustedCidrs.some(([range, prefix]) => parsedIp.kind() === range.kind() && parsedIp.match(range, prefix));
}

export function resolveClientIp(event: RequestEvent): string {
	return resolveClientIpFromInputs(
		event.request.headers.get('x-forwarded-for'),
		event.getClientAddress(),
		appEnv.trustedProxyCidrs
	);
}

export function resolveClientIpFromInputs(
	forwardedFor: string | null,
	directAddress: string,
	trustedProxyCidrs: string[]
): string {
	const trustedCidrs = parseCidrs(trustedProxyCidrs);
	const chain = parseForwardedFor(forwardedFor);

	// Security check: If X-Forwarded-For is present but no proxies are trusted,
	// we must ignore the header to prevent spoofing.
	if (chain.length > 0 && trustedCidrs.length === 0) {
		if (!warnedAboutMissingTrustedProxies) {
			warnedAboutMissingTrustedProxies = true;
			console.warn(
				'[SECURITY WARNING] X-Forwarded-For header present but TRUSTED_PROXY_CIDRS is empty. ' +
					'The application is ignoring the header to prevent IP spoofing. ' +
					'Please configure TRUSTED_PROXY_CIDRS in your environment if you are behind a proxy.'
			);
		}
		const direct = normalizeIp(directAddress);
		if (!direct) {
			throw new Error('Unable to resolve client IP address');
		}
		return direct;
	}

	// Start with the direct peer address
	let candidate = normalizeIp(directAddress);
	if (!candidate) {
		throw new Error('Unable to resolve client IP address');
	}

	// If the direct peer is not trusted, we cannot trust any forwarded headers.
	if (!isTrustedProxy(candidate, trustedCidrs)) {
		return candidate;
	}

	// Walk right-to-left: right side is nearest proxy.
	for (let index = chain.length - 1; index >= 0; index -= 1) {
		const hop = chain[index];
		candidate = hop;

		if (!isTrustedProxy(candidate, trustedCidrs)) {
			return candidate;
		}
	}

	// All proxies in the chain are trusted; the left-most is the client.
	return candidate;
}
