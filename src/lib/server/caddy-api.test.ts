import { describe, expect, it } from 'vitest';
import { extractDiscoveredServicesFromServersConfig } from '$lib/server/caddy-api';

describe('extractDiscoveredServicesFromServersConfig', () => {
	it('discovers reverse proxy services and nested allowlist matchers', () => {
		const discovered = extractDiscoveredServicesFromServersConfig({
			srv0: {
				routes: [
					{
						match: [{ host: ['grafana.example.com'] }, { remote_ip: { ranges: ['127.0.0.1'] } }],
						handle: [
							{
								handler: 'reverse_proxy',
								upstreams: [{ dial: '10.0.0.1:3000' }]
							}
						]
					},
					{
						match: [{ host: ['jellyfin.example.com'] }],
						handle: [
							{
								handler: 'subroute',
								routes: [
									{
										match: [{ remote_ip: { ranges: ['10.0.0.0/8'] } }],
										handle: [
											{
												handler: 'reverse_proxy',
												upstreams: [{ dial: '10.0.0.2:8096' }]
											}
										]
									}
								]
							}
						]
					}
				]
			}
		});

		expect(discovered).toEqual([
			{
				id: 'grafana-example-com',
				host: 'grafana.example.com',
				allowlistConfigPath: '/config/apps/http/servers/srv0/routes/0/match/1/remote_ip',
				sourcePath: '/config/apps/http/servers/srv0/routes/0',
				proxyUpstreams: ['10.0.0.1:3000']
			},
			{
				id: 'jellyfin-example-com',
				host: 'jellyfin.example.com',
				allowlistConfigPath: '/config/apps/http/servers/srv0/routes/1/handle/0/routes/0/match/0/remote_ip',
				sourcePath: '/config/apps/http/servers/srv0/routes/1/handle/0/routes/0',
				proxyUpstreams: ['10.0.0.2:8096']
			}
		]);
	});

	it('adds deterministic suffix when host slugs collide', () => {
		const discovered = extractDiscoveredServicesFromServersConfig({
			srv0: {
				routes: [
					{
						match: [{ host: ['dup.example.com'] }],
						handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '10.1.0.1:80' }] }]
					},
					{
						match: [{ host: ['dup-example.com'] }],
						handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '10.1.0.2:80' }] }]
					}
				]
			}
		});

		expect(discovered).toHaveLength(2);
		const ids = discovered.map((item) => item.id).sort((a, b) => a.localeCompare(b));
		expect(ids[0]).toBe('dup-example-com');
		expect(ids[1]?.startsWith('dup-example-com-')).toBe(true);
	});
});
