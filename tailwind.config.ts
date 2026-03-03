import type { Config } from 'tailwindcss';

const config = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	}
} satisfies Config;

export default config;
