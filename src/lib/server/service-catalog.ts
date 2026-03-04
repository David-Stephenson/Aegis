import { listDiscoveredServices } from '$lib/server/caddy-api';
import { listServiceOverrides } from '$lib/server/service-overrides';

export type ServiceCatalogItem = {
	id: string;
	name: string;
	description: string;
	icon: string | null;
	sortOrder: number;
	enabled: boolean;
	available: boolean;
	host: string | null;
	allowlistConfigPath: string | null;
	sourcePath: string | null;
	proxyUpstreams: string[];
};

export type ServiceCatalogResult = {
	services: ServiceCatalogItem[];
	warnings: string[];
};

function titleCaseFromId(serviceId: string): string {
	return serviceId
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function buildDefaultDescription(host: string | null, sourcePath: string): string {
	if (host) {
		return `Discovered from Caddy route for ${host}`;
	}
	return `Discovered from Caddy route ${sourcePath}`;
}

export async function getServiceCatalog(): Promise<ServiceCatalogResult> {
	const warnings: string[] = [];
	let discovered = [] as Awaited<ReturnType<typeof listDiscoveredServices>>;
	try {
		discovered = await listDiscoveredServices();
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : 'Unknown Caddy API error';
		warnings.push(`Service discovery failed: ${message}`);
	}

	const overridesById = new Map(listServiceOverrides().map((override) => [override.serviceId, override]));
	const merged: ServiceCatalogItem[] = discovered.map((service) => {
		const override = overridesById.get(service.id);
		const proxyUpstreams = Array.isArray(service.proxyUpstreams) ? service.proxyUpstreams : [];
		return {
			id: service.id,
			name: override?.displayName?.trim() || titleCaseFromId(service.id),
			description:
				override?.description?.trim() || buildDefaultDescription(service.host, service.sourcePath),
			icon: override?.icon ?? null,
			sortOrder: override?.sortOrder ?? 1000,
			enabled: override?.enabled ?? true,
			available: true,
			host: service.host,
			allowlistConfigPath: service.allowlistConfigPath,
			sourcePath: service.sourcePath,
			proxyUpstreams
		};
	});

	for (const override of overridesById.values()) {
		if (merged.some((service) => service.id === override.serviceId)) {
			continue;
		}
		merged.push({
			id: override.serviceId,
			name: override.displayName?.trim() || titleCaseFromId(override.serviceId),
			description: override.description?.trim() || 'Configured in admin but not currently discovered in Caddy.',
			icon: override.icon ?? null,
			sortOrder: override.sortOrder,
			enabled: override.enabled,
			available: false,
			host: null,
			allowlistConfigPath: null,
			sourcePath: null,
			proxyUpstreams: []
		});
	}

	return {
		services: merged.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) {
				return a.sortOrder - b.sortOrder;
			}
			return a.id.localeCompare(b.id);
		}),
		warnings
	};
}
