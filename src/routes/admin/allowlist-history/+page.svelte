<script lang="ts">
	import type { LayoutData } from '../$types';

	type AllowlistHistoryEvent = LayoutData['allowlistHistory'][number];

	let { data } = $props<{ data: LayoutData }>();
	let allowlistHistory = $derived(data.allowlistHistory as AllowlistHistoryEvent[]);

	let userFilter = $state('all');
	let serviceFilter = $state('all');
	let actionFilter = $state('all');
	let outcomeFilter = $state('all');
	let searchFilter = $state('');

	let serviceFilterOptions = $derived(
		[...new Set(allowlistHistory.map((event) => event.serviceId))].sort((a, b) => a.localeCompare(b))
	);
	let userFilterOptions = $derived(
		[...new Set(allowlistHistory.map((event) => event.userEmail ?? event.userId))].sort((a, b) =>
			a.localeCompare(b)
		)
	);
	let filteredHistory = $derived(
		allowlistHistory.filter((event) => {
			const userLabel = event.userEmail ?? event.userId;
			const matchesUser = userFilter === 'all' || userLabel === userFilter;
			const matchesService = serviceFilter === 'all' || event.serviceId === serviceFilter;
			const matchesAction = actionFilter === 'all' || event.action === actionFilter;
			const matchesOutcome = outcomeFilter === 'all' || event.outcome === outcomeFilter;
			const searchTerm = searchFilter.trim().toLowerCase();
			const matchesSearch =
				searchTerm.length === 0 ||
				userLabel.toLowerCase().includes(searchTerm) ||
				event.serviceId.toLowerCase().includes(searchTerm) ||
				event.ip.toLowerCase().includes(searchTerm) ||
				(event.detail ?? '').toLowerCase().includes(searchTerm);
			return matchesUser && matchesService && matchesAction && matchesOutcome && matchesSearch;
		})
	);
</script>

<section>
	<h2 class="text-2xl font-semibold">Allowlist History</h2>
	<p class="mt-2 text-sm text-slate-600">
		Chronological allowlist actions with user attribution and outcomes.
	</p>

	<div class="mt-4 grid gap-3 md:grid-cols-5">
		<label class="text-sm">
			<span class="text-slate-600">User</span>
			<select bind:value={userFilter} class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
				<option value="all">All users</option>
				{#each userFilterOptions as userOption}
					<option value={userOption}>{userOption}</option>
				{/each}
			</select>
		</label>
		<label class="text-sm">
			<span class="text-slate-600">Service</span>
			<select bind:value={serviceFilter} class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
				<option value="all">All services</option>
				{#each serviceFilterOptions as serviceOption}
					<option value={serviceOption}>{serviceOption}</option>
				{/each}
			</select>
		</label>
		<label class="text-sm">
			<span class="text-slate-600">Action</span>
			<select bind:value={actionFilter} class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
				<option value="all">All actions</option>
				<option value="allowlist_add">allowlist_add</option>
				<option value="allowlist_remove">allowlist_remove</option>
			</select>
		</label>
		<label class="text-sm">
			<span class="text-slate-600">Outcome</span>
			<select bind:value={outcomeFilter} class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
				<option value="all">All outcomes</option>
				<option value="success">success</option>
				<option value="denied">denied</option>
				<option value="error">error</option>
			</select>
		</label>
		<label class="text-sm">
			<span class="text-slate-600">Search</span>
			<input
				type="text"
				bind:value={searchFilter}
				placeholder="user, service, ip, detail"
				class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" />
		</label>
	</div>

	<div class="mt-4 overflow-x-auto">
		<table class="min-w-full text-left text-sm">
			<thead>
				<tr class="border-b border-slate-200 text-slate-600">
					<th class="py-2 pr-3">Time</th>
					<th class="py-2 pr-3">User</th>
					<th class="py-2 pr-3">Service</th>
					<th class="py-2 pr-3">IP</th>
					<th class="py-2 pr-3">Action</th>
					<th class="py-2 pr-3">Outcome</th>
					<th class="py-2 pr-3">Detail</th>
				</tr>
			</thead>
			<tbody>
				{#if filteredHistory.length === 0}
					<tr>
						<td colspan="7" class="py-4 text-sm text-slate-500">
							No allowlist history rows match the current filters.
						</td>
					</tr>
				{:else}
					{#each filteredHistory as event}
						<tr class="border-b border-slate-100 align-top">
							<td class="py-2 pr-3 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td>
							<td class="py-2 pr-3">{event.userEmail ?? event.userId}</td>
							<td class="py-2 pr-3">{event.serviceId}</td>
							<td class="py-2 pr-3 font-mono">{event.ip}</td>
							<td class="py-2 pr-3">{event.action}</td>
							<td class="py-2 pr-3">{event.outcome}</td>
							<td class="py-2 pr-3">{event.detail ?? '-'}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
