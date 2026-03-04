import { getServiceCatalog, type ServiceCatalogItem } from '$lib/server/service-catalog';

export type ServiceDefinition = ServiceCatalogItem;
export type ActiveServiceDefinition = ServiceCatalogItem & {
	available: true;
	enabled: true;
	allowlistConfigPath: string;
	sourcePath: string;
};

function isActiveService(service: ServiceCatalogItem): service is ActiveServiceDefinition {
	return (
		service.available &&
		service.enabled &&
		typeof service.allowlistConfigPath === 'string' &&
		typeof service.sourcePath === 'string'
	);
}

export async function getServiceDefinitions(): Promise<ActiveServiceDefinition[]> {
	const { services } = await getServiceCatalog();
	return services.filter(isActiveService);
}

export async function getServiceById(serviceId: string): Promise<ActiveServiceDefinition | null> {
	const { services } = await getServiceCatalog();
	const service = services.find((entry) => entry.id === serviceId);
	if (!service || !isActiveService(service)) {
		return null;
	}
	return service;
}

export async function getAdminServiceDefinitions(): Promise<{
	services: ServiceCatalogItem[];
	warnings: string[];
}> {
	return getServiceCatalog();
}
