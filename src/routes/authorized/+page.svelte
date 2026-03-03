<script lang="ts">
	type Result = {
		serviceId: string;
		serviceName: string;
		status: 'authorized' | 'already_authorized' | 'failed';
		detail?: string;
	};

	type PageData = {
		user: {
			id: string;
			email?: string | null;
			name?: string | null;
			groups: string[];
		};
		clientIp: string;
		results: Result[];
	};

	let { data } = $props<{ data: PageData }>();

	function countByStatus(status: Result['status']): number {
		return data.results.filter((result: Result) => result.status === status).length;
	}
</script>

<main class="mx-auto max-w-3xl p-6">
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">IP authorization complete</h1>
		<p class="mt-2 text-sm text-slate-700">
			Authenticated as <span class="font-medium">{data.user.email ?? data.user.name ?? data.user.id}</span>
		</p>
		<p class="mt-1 text-sm text-slate-700">
			Client IP: <span class="font-mono">{data.clientIp}</span>
		</p>
		<p class="mt-1 text-sm text-slate-700">
			Groups: {data.user.groups.join(', ') || 'none'}
		</p>

		<div class="mt-4 grid grid-cols-3 gap-2 text-sm">
			<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3">
				<div class="text-xs text-emerald-700">Authorized now</div>
				<div class="mt-1 text-xl font-semibold text-emerald-800">{countByStatus('authorized')}</div>
			</div>
			<div class="rounded-md border border-slate-200 bg-slate-50 p-3">
				<div class="text-xs text-slate-600">Already authorized</div>
				<div class="mt-1 text-xl font-semibold text-slate-800">{countByStatus('already_authorized')}</div>
			</div>
			<div class="rounded-md border border-rose-200 bg-rose-50 p-3">
				<div class="text-xs text-rose-700">Failed</div>
				<div class="mt-1 text-xl font-semibold text-rose-800">{countByStatus('failed')}</div>
			</div>
		</div>

		{#if data.results.length === 0}
			<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
				No services are mapped to your groups, so nothing was authorized.
			</p>
		{:else}
			<ul class="mt-4 space-y-2 text-sm">
				{#each data.results as result}
					<li class="rounded-md border border-slate-200 p-3">
						<div class="font-medium">{result.serviceName} ({result.serviceId})</div>
						<div class="mt-1">
							Status:
							{#if result.status === 'authorized'}
								<span class="text-emerald-700">authorized</span>
							{:else if result.status === 'already_authorized'}
								<span class="text-slate-700">already authorized</span>
							{:else}
								<span class="text-rose-700">failed</span>
							{/if}
						</div>
						{#if result.detail}
							<div class="mt-1 text-rose-700">{result.detail}</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

	</div>
</main>
