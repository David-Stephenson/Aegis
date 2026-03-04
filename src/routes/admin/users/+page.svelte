<script lang="ts">
	import type { LayoutData } from '../$types';

	type User = LayoutData['users'][number];

	let { data } = $props<{ data: LayoutData }>();
	let users = $derived(data.users as User[]);
	let userDirectoryWarning = $derived(data.userDirectoryWarning ?? null);
</script>

<section>
	<h2 class="text-2xl font-semibold">Users</h2>
	<p class="mt-2 text-sm text-slate-600">Live Authentik users merged with local allowlist activity history.</p>

	{#if userDirectoryWarning}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
			{userDirectoryWarning}
		</p>
	{/if}

	<div class="mt-4 overflow-x-auto">
		<table class="min-w-full text-left text-sm">
			<thead>
				<tr class="border-b border-slate-200 text-slate-600">
					<th class="py-2 pr-3">User</th>
					<th class="py-2 pr-3">Source</th>
					<th class="py-2 pr-3">Groups</th>
					<th class="py-2 pr-3">Adds</th>
					<th class="py-2 pr-3">Removes</th>
					<th class="py-2 pr-3">Services</th>
					<th class="py-2 pr-3">IPs</th>
					<th class="py-2 pr-3">Last activity</th>
				</tr>
			</thead>
			<tbody>
				{#if users.length === 0}
					<tr>
						<td colspan="8" class="py-4 text-sm text-slate-500">No user records available.</td>
					</tr>
				{:else}
					{#each users as user}
						<tr class="border-b border-slate-100 align-top">
							<td class="py-2 pr-3">
								<p class="font-medium text-slate-900">{user.name ?? user.email ?? user.username}</p>
								<p class="text-xs text-slate-500">{user.email ?? user.id}</p>
							</td>
							<td class="py-2 pr-3">
								<span
									class={`rounded-full px-2 py-1 text-xs ${
										user.source === 'live'
											? 'bg-emerald-100 text-emerald-700'
											: 'bg-amber-100 text-amber-700'
									}`}>
									{user.source}
								</span>
							</td>
							<td class="py-2 pr-3">{user.groups.length > 0 ? user.groups.join(', ') : '-'}</td>
							<td class="py-2 pr-3">{user.activity.totalAdds}</td>
							<td class="py-2 pr-3">{user.activity.totalRemoves}</td>
							<td class="py-2 pr-3">{user.activity.uniqueServiceCount}</td>
							<td class="py-2 pr-3">{user.activity.uniqueIpCount}</td>
							<td class="py-2 pr-3 whitespace-nowrap">
								{user.activity.lastActivityAt ? new Date(user.activity.lastActivityAt).toLocaleString() : '-'}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
