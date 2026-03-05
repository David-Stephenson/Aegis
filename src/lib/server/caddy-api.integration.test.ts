import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const adminPort = 22000 + Math.floor(Math.random() * 1000);
const httpPort = 18080 + Math.floor(Math.random() * 1000);
const containerName = `aegis-caddy-test-${process.pid}-${Math.floor(Math.random() * 10000)}`;
const caddyfilePath = path.resolve(process.cwd(), 'Caddyfile.test');
const baseUrl = `http://127.0.0.1:${adminPort}`;
const hasDocker = (() => {
	try {
		execSync('docker info', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
})();

async function waitForAdminApi(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(`${url}/config/`);
			if (response.ok) {
				return;
			}
		} catch {
			// Retry until timeout.
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	throw new Error('Caddy Admin API did not become ready in time');
}

async function seedHttpConfig(url: string): Promise<void> {
	const config = {
		apps: {
			http: {
				servers: {
					srv0: {
						listen: [':80'],
						routes: [
							{
								match: [
									{ host: ['grafana.example.com'] },
									{ remote_ip: { ranges: ['203.0.113.10'] } }
								],
								handle: [
									{
										handler: 'reverse_proxy',
										upstreams: [{ dial: '127.0.0.1:3000' }]
									}
								]
							}
						]
					}
				}
			}
		}
	};

	const response = await fetch(`${url}/load`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(config)
	});
	if (!response.ok) {
		throw new Error(`Failed to seed Caddy config: ${response.status} ${await response.text()}`);
	}
}

function isDockerUnavailableError(caught: unknown): boolean {
	if (!(caught instanceof Error)) {
		return false;
	}
	const message = caught.message.toLowerCase();
	return (
		message.includes('docker') &&
		(message.includes('not found') ||
			message.includes('command not found') ||
			message.includes('cannot connect to the docker daemon') ||
			message.includes('is the docker daemon running'))
	);
}

(hasDocker ? describe : describe.skip)('caddy-api docker integration', () => {
	let integrationReady = false;

	beforeAll(async () => {
		process.env.CADDY_API_BASE_URL = baseUrl;
		process.env.CADDY_API_TOKEN = 'integration-test-token';
		process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'integration-secret-123456789012345678901234';
		process.env.AUTH_AUTHENTIK_ISSUER =
			process.env.AUTH_AUTHENTIK_ISSUER ?? 'https://auth.example.com/application/o/aegis/';
		process.env.AUTH_AUTHENTIK_CLIENT_ID = process.env.AUTH_AUTHENTIK_CLIENT_ID ?? 'aegis';
		process.env.AUTH_AUTHENTIK_CLIENT_SECRET =
			process.env.AUTH_AUTHENTIK_CLIENT_SECRET ?? 'integration-client-secret';
		process.env.AUTHENTIK_API_BASE_URL = process.env.AUTHENTIK_API_BASE_URL ?? 'https://auth.example.com/api/v3';
		process.env.AUTHENTIK_API_TOKEN = process.env.AUTHENTIK_API_TOKEN ?? 'integration-token';
		process.env.DB_PATH = process.env.DB_PATH ?? 'data/aegis.test.db';
		process.env.GROUP_SERVICE_MAP_JSON = process.env.GROUP_SERVICE_MAP_JSON ?? '{}';
		process.env.TRUSTED_PROXY_CIDRS = process.env.TRUSTED_PROXY_CIDRS ?? '127.0.0.1/32';

		try {
			execSync(
				`docker run -d --rm --name ${containerName} -p ${httpPort}:80 -p ${adminPort}:2019 -v "${caddyfilePath}:/etc/caddy/Caddyfile:ro" caddy:2`,
				{ stdio: 'ignore' }
			);
			await waitForAdminApi(baseUrl, 15_000);
			await seedHttpConfig(baseUrl);
			integrationReady = true;
		} catch (caught) {
			if (isDockerUnavailableError(caught)) {
				integrationReady = false;
				return;
			}
			throw caught;
		}
	}, 30_000);

	afterAll(() => {
		try {
			execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
		} catch {
			// Container already gone.
		}
	});

	it('discovers services from live caddy config', async () => {
		if (!integrationReady) return;
		vi.resetModules();
		const { listDiscoveredServices } = await import('$lib/server/caddy-api');
		const services = await listDiscoveredServices();
		expect(services).toHaveLength(1);
		expect(services[0]).toMatchObject({
			id: 'grafana-example-com',
			host: 'grafana.example.com'
		});
	});

	it('adds allowlist ip and persists canonical ranges object shape', async () => {
		if (!integrationReady) return;
		vi.resetModules();
		const { listDiscoveredServices, allowlistIp } = await import('$lib/server/caddy-api');
		const [service] = await listDiscoveredServices();
		expect(service?.allowlistConfigPath).toBeTruthy();

		await allowlistIp(service!.allowlistConfigPath!, '198.51.100.25');

		const payloadResponse = await fetch(`${baseUrl}${service!.allowlistConfigPath!}`);
		const payload = (await payloadResponse.json()) as { ranges?: string[] };
		expect(Array.isArray(payload.ranges)).toBe(true);
		expect(payload.ranges).toContain('198.51.100.25');
	});

	it('removes allowlist ip from remote_ip matcher', async () => {
		if (!integrationReady) return;
		vi.resetModules();
		const { listDiscoveredServices, allowlistIp, removeAllowlistIp } = await import('$lib/server/caddy-api');
		const [service] = await listDiscoveredServices();
		expect(service?.allowlistConfigPath).toBeTruthy();

		await allowlistIp(service!.allowlistConfigPath!, '198.51.100.44');
		await removeAllowlistIp(service!.allowlistConfigPath!, '198.51.100.44');

		const payloadResponse = await fetch(`${baseUrl}${service!.allowlistConfigPath!}`);
		const payload = (await payloadResponse.json()) as { ranges?: string[] };
		expect(payload.ranges?.includes('198.51.100.44')).toBe(false);
	});
});
