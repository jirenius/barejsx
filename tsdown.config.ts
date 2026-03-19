import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'jsx-runtime': 'src/jsx-runtime.ts',
		'jsx-dev-runtime': 'src/jsx-dev-runtime.ts',
	},
	outDir: 'dist',
	format: [ 'esm', 'cjs' ],
	dts: false,
	fixedExtension: true,
	platform: 'neutral',
	target: 'es2020',
	sourcemap: true,
});
