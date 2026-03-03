import { appEnv, type ServiceDefinition } from '$lib/server/env';

export function getServiceDefinitions(): ServiceDefinition[] {
	return appEnv.services;
}

export function getServiceById(serviceId: string): ServiceDefinition | null {
	return getServiceDefinitions().find((service) => service.id === serviceId) ?? null;
}
