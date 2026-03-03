<script lang="ts">
	type Service = {
		id: string;
		name: string;
		description: string;
		allowlistConfigPath: string;
	};

	type Entry = {
		id: number;
		serviceId: string;
		ip: string;
		createdAt: string;
		updatedAt: string;
	};

	type PageData = {
		user: {
			id: string;
			email?: string | null;
			name?: string | null;
			groups: string[];
		};
		clientIp: string;
		services: Service[];
		entries: Entry[];
		csrfToken: string;
	};

	let { data } = $props<{ data: PageData }>();
	let selectedServiceId = $state('');
	let pendingAction = $state<'' | 'allow' | 'revoke'>('');
	let statusMessage = $state('');
	let statusError = $state('');

	$effect(() => {
		if (!selectedServiceId && data.services.length > 0) {
			selectedServiceId = data.services[0].id;
		}
	});

	async function submitAction(action: 'allow' | 'revoke') {
		pendingAction = action;
		statusMessage = '';
		statusError = '';
		try {
			const response = await fetch('/api/allowlist', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-csrf-token': data.csrfToken
				},
				body: JSON.stringify({
					action,
					serviceId: selectedServiceId
				})
			});
			const body = (await response.json()) as { ok?: boolean; message?: string };
			if (!response.ok || !body.ok) {
				statusError = body.message ?? `Request failed (${response.status})`;
				return;
			}
			statusMessage = action === 'allow' ? 'IP was allowlisted for this service.' : 'IP was removed from allowlist.';
			window.location.reload();
		} catch (caught) {
			statusError = caught instanceof Error ? caught.message : 'Unknown failure';
		} finally {
			pendingAction = '';
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h1 class="text-2xl font-semibold text-slate-900">Aegis</h1>
		<p class="mt-2 text-sm text-slate-600">
			Signed in as <span class="font-medium">{data.user.email ?? data.user.name ?? data.user.id}</span>
		</p>
		<p class="mt-1 text-sm text-slate-600">Detected public IP: <span class="font-mono">{data.clientIp}</span></p>
		<p class="mt-1 text-sm text-slate-600">Groups: {data.user.groups.join(', ') || 'none'}</p>
		<form method="POST" action="/auth/signout" class="mt-4">
			<input type="hidden" name="callbackUrl" value="/" />
			<button type="submit" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
				Sign out
			</button>
		</form>
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-900">Allowlist Access</h2>
		{#if data.services.length === 0}
			<p class="mt-3 text-sm text-amber-700">Your account is authenticated but has no mapped services.</p>
		{:else}
			<label class="mt-4 block text-sm font-medium text-slate-700" for="service">Service</label>
			<select
				id="service"
				bind:value={selectedServiceId}
				class="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
				{#each data.services as service}
					<option value={service.id}>{service.name} ({service.id})</option>
				{/each}
			</select>

			<p class="mt-3 text-sm text-slate-500">
				{data.services.find((service: Service) => service.id === selectedServiceId)?.description}
			</p>

			<div class="mt-5 flex gap-3">
				<button
					type="button"
					class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					onclick={() => submitAction('allow')}
					disabled={!selectedServiceId || pendingAction !== ''}>
					{pendingAction === 'allow' ? 'Allowlisting...' : 'Allowlist my IP'}
				</button>
				<button
					type="button"
					class="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					onclick={() => submitAction('revoke')}
					disabled={!selectedServiceId || pendingAction !== ''}>
					{pendingAction === 'revoke' ? 'Removing...' : 'Revoke my IP'}
				</button>
			</div>
		{/if}

		{#if statusMessage}
			<p class="mt-3 rounded-md bg-emerald-50 p-2 text-sm text-emerald-700">{statusMessage}</p>
		{/if}
		{#if statusError}
			<p class="mt-3 rounded-md bg-rose-50 p-2 text-sm text-rose-700">{statusError}</p>
		{/if}
	</section>

	<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-900">Your Existing Entries</h2>
		{#if data.entries.length === 0}
			<p class="mt-3 text-sm text-slate-600">No entries stored yet.</p>
		{:else}
			<ul class="mt-3 space-y-2 text-sm">
				{#each data.entries as entry}
					<li class="rounded-md border border-slate-200 p-3">
						<div><span class="font-medium">Service:</span> {entry.serviceId}</div>
						<div><span class="font-medium">IP:</span> <span class="font-mono">{entry.ip}</span></div>
						<div><span class="font-medium">Updated:</span> {new Date(entry.updatedAt).toLocaleString()}</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
