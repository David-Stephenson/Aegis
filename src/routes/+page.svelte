<script lang="ts">
	import { onMount } from 'svelte';

	let fireCanvas: HTMLCanvasElement | undefined;
	let firePanel: HTMLDivElement | undefined;

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

<main class="min-h-screen bg-white">
	<section class="grid min-h-screen w-full overflow-hidden bg-white md:grid-cols-[392px_1fr]">
		<div
			bind:this={firePanel}
			class="relative hidden min-h-screen md:block"
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
			<div class="absolute inset-0 z-10 bg-gradient-to-b from-black/5 via-transparent to-black/35"></div>
			<div class="absolute bottom-8 left-8 right-8 z-20 text-white">
				<p class="text-3xl font-semibold leading-tight">Aegis</p>
			</div>
		</div>

		<div class="flex min-h-screen items-center justify-center p-8 md:p-16">
			<div class="w-full max-w-md">
				<h1 class="text-center text-4xl font-semibold text-slate-900">Welcome back</h1>
				<p class="mt-3 text-center text-sm text-slate-500">
					Sign in with Authentik to manage IP allowlist access.
				</p>

				<form class="mt-10 space-y-5" method="POST" action="/login">
					<input type="hidden" name="providerId" value="authentik" />
					<input type="hidden" name="redirectTo" value="/authorized" />
					<button
						class="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
						type="submit">
						Continue with Authentik
					</button>
				</form>

				<p class="mt-6 text-center text-xs text-slate-500">You will be redirected to your Authentik provider.</p>
			</div>
		</div>
	</section>
</main>
