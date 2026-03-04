<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import Settings from 'lucide-svelte/icons/settings';

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
	const isAdmin = $derived(data.user.groups.includes('admin'));

	function getFailedResults(): Result[] {
		return data.results.filter((result: Result) => result.status === 'failed');
	}

	function isAllFailed(): boolean {
		const failedResults = getFailedResults();
		return data.results.length > 0 && failedResults.length === data.results.length;
	}
</script>

<main class="relative mx-auto grid min-h-screen max-w-3xl place-items-center p-6">
	{#if isAdmin}
		<a
			href="/admin"
			class="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
			aria-label="Open admin">
			<Settings class="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
		</a>
	{/if}
	<div class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
		<div
			class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
			aria-hidden="true">
			<Check class="h-9 w-9" strokeWidth={2.5} />
		</div>

		<h1 class="mt-6 text-3xl font-semibold text-slate-900">
			{#if isAllFailed()}
				Could not update the allow list.
			{:else}
				Added <span class="font-mono text-2xl">{data.clientIp}</span> to the allow list.
			{/if}
		</h1>

		<p class="mt-3 text-sm text-slate-600">
			Signed in as <span class="font-medium">{data.user.email ?? data.user.name ?? data.user.id}</span>
		</p>

		{#if getFailedResults().length > 0}
			<div class="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
				Some services could not be updated:
				<ul class="mt-2 list-inside list-disc">
					{#each getFailedResults() as result}
						<li>{result.serviceName} ({result.serviceId})</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</main>
