import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import type { RequestEvent } from '@sveltejs/kit';
import { appEnv } from '$lib/server/env';

type CidrTuple = [ipaddr.IPv4 | ipaddr.IPv6, number];

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

	// If there are no proxy headers, trust the direct peer address.
	if (chain.length === 0) {
		const direct = normalizeIp(directAddress);
		if (!direct) {
			throw new Error('Unable to resolve client IP address');
		}
		return direct;
	}

	// Walk right-to-left: right side is nearest proxy. Stop at first untrusted IP.
	for (let index = chain.length - 1; index >= 0; index -= 1) {
		const ip = chain[index];
		if (!isTrustedProxy(ip, trustedCidrs)) {
			return ip;
		}
	}

	// All proxies are trusted; left-most should be the original client.
	return chain[0];
}
