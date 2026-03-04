<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let fireCanvas: HTMLCanvasElement | undefined;
	let firePanel: HTMLDivElement | undefined;
	let authErrorMessage = $derived.by(() => {
		const error = $page.url.searchParams.get('error');
		if (error === 'auth_login_failed') {
			return 'Sign-in failed. Check Authentik issuer/client settings and verify the provider well-known endpoint is reachable.';
		}
		return '';
	});

	onMount(() => {
		if (!fireCanvas || !firePanel) {
			return;
		}

		const canvas = fireCanvas;
		const maybeContext = canvas.getContext('2d');
		if (!maybeContext) {
			return;
		}
		const context: CanvasRenderingContext2D = maybeContext;

		const cellSize = 28;
		let cols = 0;
		let rows = 0;
		let current = new Uint16Array();
		let next = new Uint16Array();
		const maxHeat = 255;
		let tickTimer: ReturnType<typeof setInterval> | undefined;

		function index(x: number, y: number): number {
			return y * cols + x;
		}

		function seedFire(): void {
			current = new Uint16Array(cols * rows);
			next = new Uint16Array(cols * rows);
			for (let x = 0; x < cols; x += 1) {
				current[index(x, rows - 1)] = Math.floor(maxHeat * (0.7 + Math.random() * 0.3));
			}
		}

		function igniteBase(): void {
			for (let x = 0; x < cols; x += 1) {
				const base = index(x, rows - 1);
				current[base] = Math.floor(maxHeat * (0.72 + Math.random() * 0.28));
				if (rows > 1 && Math.random() > 0.65) {
					current[index(x, rows - 2)] = Math.floor(maxHeat * (0.48 + Math.random() * 0.35));
				}
			}
		}

		function step(): void {
			next.fill(0);
			igniteBase();

			for (let y = 0; y < rows - 1; y += 1) {
				for (let x = 0; x < cols; x += 1) {
					const below = current[index(x, y + 1)];
					const belowLeft = current[index(Math.max(0, x - 1), y + 1)];
					const belowRight = current[index(Math.min(cols - 1, x + 1), y + 1)];
					const belowTwo = y + 2 < rows ? current[index(x, y + 2)] : below;
					const belowThree = y + 3 < rows ? current[index(x, y + 3)] : belowTwo;

					const averageHeat = (below + belowLeft + belowRight + belowTwo + belowThree) * 0.2;
					const cooling = 3 + Math.random() * 15;
					next[index(x, y)] = Math.max(0, averageHeat - cooling);
				}
			}

			for (let x = 0; x < cols; x += 1) {
				next[index(x, rows - 1)] = current[index(x, rows - 1)];
				if (rows > 1) {
					next[index(x, rows - 2)] = Math.max(next[index(x, rows - 2)], current[index(x, rows - 2)]);
				}
			}

			[current, next] = [next, current];
		}

		function fireColor(heat: number): string {
			const normalized = Math.min(1, Math.max(0, heat / maxHeat));
			const hue = 6 + normalized * 46;
			const lightness = 7 + normalized * 58;
			const alpha = Math.max(0, (normalized - 0.08) * 1.2);
			return `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
		}

		function draw(): void {
			context.clearRect(0, 0, canvas.width, canvas.height);
			for (let y = 0; y < rows; y += 1) {
				for (let x = 0; x < cols; x += 1) {
					const heat = current[index(x, y)];
					context.fillStyle = fireColor(heat);
					context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
				}
			}
		}

		function resize(): void {
			const width = firePanel?.clientWidth ?? 0;
			const height = firePanel?.clientHeight ?? 0;
			cols = Math.max(1, Math.floor(width / cellSize));
			rows = Math.max(1, Math.floor(height / cellSize));
			canvas.width = width;
			canvas.height = height;
			seedFire();
			draw();
		}

		const observer = new ResizeObserver(resize);
		observer.observe(firePanel);
		resize();

		tickTimer = setInterval(() => {
			step();
			draw();
		}, 80);

		return () => {
			observer.disconnect();
			if (tickTimer) {
				clearInterval(tickTimer);
			}
		};
	});
</script>

<main class="min-h-screen bg-slate-50">
	<section class="grid min-h-screen w-full overflow-hidden bg-slate-50 lg:grid-cols-[420px_1fr]">
		<div
			bind:this={firePanel}
			class="relative hidden min-h-screen lg:block"
			style="
				background-color: #2a0904;
				background-image:
					linear-gradient(rgba(255, 214, 170, 0.1) 1px, transparent 1px),
					linear-gradient(90deg, rgba(255, 214, 170, 0.1) 1px, transparent 1px),
					radial-gradient(circle at 15% 20%, rgba(249, 115, 22, 0.25), transparent 45%),
					radial-gradient(circle at 85% 70%, rgba(239, 68, 68, 0.2), transparent 50%),
					linear-gradient(180deg, #431407, #1c0b07);
				background-size: 28px 28px, 28px 28px, auto, auto, auto;
				background-position: 0 0, 0 0, 0 0, 0 0, 0 0;
			">
			<canvas bind:this={fireCanvas} class="pointer-events-none absolute inset-0 z-0 opacity-90"></canvas>
			<div class="absolute inset-0 z-10 bg-gradient-to-b from-black/5 via-black/5 to-black/45"></div>
			<div class="absolute inset-x-8 top-8 z-20 text-white/90">
				<p class="text-sm font-medium tracking-[0.22em] uppercase">Aegis Access</p>
			</div>
			<div class="absolute bottom-8 left-8 right-8 z-20 text-white">
				<p class="text-3xl font-semibold leading-tight">Secure edge controls</p>
				<p class="mt-2 max-w-xs text-sm text-amber-100/90">
					Verify and authorize trusted requests through a single managed login.
				</p>
			</div>
		</div>

		<div
			class="relative flex min-h-screen items-center justify-center p-6 sm:p-10 lg:p-16"
			style="
				background-image:
					radial-gradient(circle at 0% 0%, rgba(15, 23, 42, 0.08), transparent 42%),
					radial-gradient(circle at 100% 100%, rgba(249, 115, 22, 0.08), transparent 38%);
			">
			<div class="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-8 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-10">
				<p class="text-sm font-medium tracking-wide text-slate-500">Welcome back</p>
				<h1 class="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Sign in to Aegis</h1>
				<p class="mt-3 text-sm leading-relaxed text-slate-600">
					Use your organization identity provider to continue.
				</p>
				{#if authErrorMessage}
					<p class="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
						{authErrorMessage}
					</p>
				{/if}

				<form class="mt-8 space-y-4" method="POST" action="/login">
					<input type="hidden" name="providerId" value="authentik" />
					<input type="hidden" name="redirectTo" value="/authorized" />
					<button
						class="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
						type="submit">
						Continue with Authentik
						<span class="inline-block transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
					</button>
					<p class="text-center text-xs text-slate-500">
						You will be redirected securely and returned after authentication.
					</p>
				</form>
			</div>
		</div>
	</section>
</main>
