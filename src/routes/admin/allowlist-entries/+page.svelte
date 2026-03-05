<script lang="ts">
	import type { LayoutData } from '../$types';
	import type { ActionData } from './$types';

	type AllowlistEntry = LayoutData['allowlistEntries'][number];

	let { data, form } = $props<{ data: LayoutData; form?: ActionData }>();
	let allowlistEntries = $derived(data.allowlistEntries as AllowlistEntry[]);
</script>

<section>
	<h2 class="text-2xl font-semibold">Current Allowlist Entries</h2>
	<p class="mt-2 text-sm text-slate-600">
		Active service/IP allowlist entries. Revoke any row to remove that IP from the service.
	</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{form.error}</p>
	{/if}

	<div class="mt-4 overflow-x-auto">
		<table class="min-w-full text-left text-sm">
			<thead>
				<tr class="border-b border-slate-200 text-slate-600">
					<th class="py-2 pr-3">Service</th>
					<th class="py-2 pr-3">IP</th>
					<th class="py-2 pr-3">Last updated</th>
					<th class="py-2 pr-3">Added/updated by</th>
					<th class="py-2 pr-3">Action</th>
				</tr>
			</thead>
			<tbody>
				{#if allowlistEntries.length === 0}
					<tr>
						<td colspan="5" class="py-4 text-sm text-slate-500">No current allowlist entries found.</td>
					</tr>
				{:else}
					{#each allowlistEntries as entry}
						<tr class="border-b border-slate-100 align-top">
							<td class="py-2 pr-3">
								<p class="font-medium text-slate-900">{entry.serviceName}</p>
								<p class="text-xs text-slate-500">{entry.serviceId}</p>
							</td>
							<td class="py-2 pr-3 font-mono">{entry.ip}</td>
							<td class="py-2 pr-3 whitespace-nowrap">{new Date(entry.updatedAt).toLocaleString()}</td>
							<td class="py-2 pr-3">{entry.userEmail ?? entry.userId}</td>
							<td class="py-2 pr-3">
								<form method="POST" action="?/revokeAllowlistEntry">
									<input type="hidden" name="serviceId" value={entry.serviceId} />
									<input type="hidden" name="ip" value={entry.ip} />
									<button
										type="submit"
										disabled={!entry.allowlistConfigPath}
										class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300">
										Revoke
									</button>
								</form>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
