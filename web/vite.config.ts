import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Cloudflare Pages'e deploy ediliyor (T15).
			adapter: adapter(),

			// Yeni SvelteKit surumunde svelte.config.js yok; kit ayarlari burada.
			alias: {
				"@shared": "../shared"
			}
		})
	]
});
