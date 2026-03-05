<script lang="ts">
	import type { LayoutData } from '../$types';
	import type { ActionData } from './$types';

	type Service = LayoutData['services'][number];

	let { data, form } = $props<{ data: LayoutData; form?: ActionData }>();
	let services = $derived(data.services as Service[]);
	let discoveryWarnings = $derived(data.discoveryWarnings ?? []);
</script>

<section>
	<h2 class="text-2xl font-semibold">Services</h2>
	<p class="mt-2 text-sm text-slate-600">
		Discovered services come from the Caddy Admin API. Use these settings to control labels and which
		services the firewall allowlist flow applies to.
	</p>

	{#if discoveryWarnings.length > 0}
		<div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
			{#each discoveryWarnings as warning}
				<p>{warning}</p>
			{/each}
		</div>
	{/if}

	{#if form?.error}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{form.error}</p>
	{/if}

	<div class="mt-4 space-y-4">
		{#each services as service}
			<form method="POST" action="?/updateService" class="rounded-lg border border-slate-200 p-4">
				<input type="hidden" name="serviceId" value={service.id} />

				<div class="flex flex-wrap items-center justify-between gap-2">
					<div>
						<p class="font-medium text-slate-900">
							{service.name} <span class="text-slate-500">({service.id})</span>
						</p>
						<p class="text-xs text-slate-500">
							Host: {service.host ?? '-'} | Path: {service.allowlistConfigPath ?? service.sourcePath ?? '-'}
						</p>
						<p class="text-xs text-slate-500">
							Reverse proxy upstreams:
							{service.proxyUpstreams.length > 0 ? service.proxyUpstreams.join(', ') : '-'}
						</p>
					</div>
					<span
						class={`rounded-full px-2 py-1 text-xs ${
							service.available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
						}`}>
						{service.available ? 'available' : 'unavailable'}
					</span>
				</div>

				<div class="mt-3 grid gap-3 md:grid-cols-2">
					<label class="text-sm">
						<span class="text-slate-600">Display name</span>
						<input
							name="displayName"
							value={service.name}
							class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" />
					</label>
					<label class="text-sm">
						<span class="text-slate-600">Icon</span>
						<input
							name="icon"
							value={service.icon ?? ''}
							maxlength="16"
							class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
							placeholder="emoji or short label" />
					</label>
					<label class="text-sm md:col-span-2">
						<span class="text-slate-600">Description</span>
						<input
							name="description"
							value={service.description}
							maxlength="240"
							class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" />
					</label>
					<label class="text-sm">
						<span class="text-slate-600">Sort order</span>
						<input
							type="number"
							name="sortOrder"
							value={service.sortOrder}
							min="0"
							max="10000"
							class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" />
					</label>
					<label class="mt-6 flex items-center gap-2 text-sm">
						<input type="checkbox" name="enabled" checked={service.enabled} />
						<span class="text-slate-700">Apply firewall to this service</span>
					</label>
				</div>
				<p class="mt-2 text-xs text-slate-500">
					When disabled, this service is excluded from user allowlist actions.
				</p>

				<div class="mt-3">
					<button
						type="submit"
						class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
						Save service settings
					</button>
				</div>
			</form>
		{/each}
	</div>
</section>
