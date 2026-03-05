<script lang="ts">
	import { page } from '$app/state';

	type NavItem = {
		href: string;
		label: string;
		description: string;
	};

	const navItems: NavItem[] = [
		{
			href: '/admin/services',
			label: 'Services',
			description: 'Service metadata and visibility'
		},
		{
			href: '/admin/users',
			label: 'Users',
			description: 'Directory users and activity'
		},
		{
			href: '/admin/allowlist-entries',
			label: 'Allowlist Entries',
			description: 'Current active service/IP entries'
		},
		{
			href: '/admin/allowlist-history',
			label: 'Allowlist History',
			description: 'Chronological allowlist audit trail'
		}
	];

	let { children } = $props();

	const isActive = (href: string, pathname: string) =>
		pathname === href || pathname.startsWith(`${href}/`);
</script>

<main class="mx-auto max-w-7xl p-6">
	<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="flex flex-col lg:grid lg:grid-cols-[280px_1fr]">
			<aside class="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
				<h1 class="px-2 text-lg font-semibold text-slate-900">Admin Settings</h1>
				<p class="mt-1 px-2 text-xs text-slate-500">
					Configure services and review allowlist activity.
				</p>
				<nav class="mt-4 space-y-1">
					{#each navItems as item}
						<a
							href={item.href}
							class={`block rounded-md border px-3 py-2 text-sm transition-colors ${
								isActive(item.href, page.url.pathname)
									? 'border-slate-300 bg-white text-slate-900 shadow-sm'
									: 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
							}`}>
							<p class="font-medium">{item.label}</p>
							<p class="mt-0.5 text-xs text-slate-500">{item.description}</p>
						</a>
					{/each}
				</nav>
			</aside>
			<section class="min-w-0 p-6">
				{@render children()}
			</section>
		</div>
	</div>
</main>
