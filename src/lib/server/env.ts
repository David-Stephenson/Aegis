import { z } from 'zod';
import { env as privateEnv } from '$env/dynamic/private';

const serviceSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().min(1),
	allowlistConfigPath: z.string().startsWith('/config/')
});

const rawEnvSchema = z.object({
	AUTH_SECRET: z.string().min(32).default('dev-secret-change-me-dev-secret-1234'),
	AUTH_AUTHENTIK_ISSUER: z.string().url().default('https://auth.example.com/application/o/aegis/'),
	AUTH_AUTHENTIK_CLIENT_ID: z.string().min(1).default('aegis'),
	AUTH_AUTHENTIK_CLIENT_SECRET: z.string().min(1).default('dev-secret'),
	CADDY_API_BASE_URL: z.string().url().default('http://127.0.0.1:2019'),
	CADDY_API_TOKEN: z.string().min(1).default('dev-token'),
	DB_PATH: z.string().default('data/aegis.db'),
	TRUSTED_PROXY_CIDRS: z.string().default(''),
	GROUP_SERVICE_MAP_JSON: z.string().default('{}'),
	SERVICE_DEFINITIONS_JSON: z.string().default('[]')
});

function parseJson<T>(label: string, value: string, schema: z.ZodSchema<T>): T {
	const parsed = JSON.parse(value) as unknown;
	return schema.parse(parsed, {
		error: (issue) => `${label} validation failed: ${issue.message}`
	});
}

const parsed = rawEnvSchema.parse(privateEnv);

export const appEnv = {
	...parsed,
	trustedProxyCidrs: parsed.TRUSTED_PROXY_CIDRS.split(',')
		.map((cidr) => cidr.trim())
		.filter(Boolean),
	groupServiceMap: parseJson(
		'GROUP_SERVICE_MAP_JSON',
		parsed.GROUP_SERVICE_MAP_JSON,
		z.record(z.string(), z.array(z.string()))
	),
	services: parseJson('SERVICE_DEFINITIONS_JSON', parsed.SERVICE_DEFINITIONS_JSON, z.array(serviceSchema))
};

export type ServiceDefinition = z.infer<typeof serviceSchema>;
