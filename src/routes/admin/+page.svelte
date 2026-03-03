<script lang="ts">
	type AuditEvent = {
		id: number;
		correlationId: string;
		userId: string;
		userEmail: string | null;
		serviceId: string;
		ip: string;
		action: string;
		outcome: string;
		detail: string | null;
		createdAt: string;
	};

	let { data } = $props<{ data: { events: AuditEvent[] } }>();
</script>

<main class="mx-auto max-w-6xl p-6">
	<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold">Admin Audit Log</h1>
		<p class="mt-2 text-sm text-slate-600">Latest Caddy allowlist changes and denied/error attempts.</p>

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
					{#each data.events as event}
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
				</tbody>
			</table>
		</div>
	</section>
</main>
