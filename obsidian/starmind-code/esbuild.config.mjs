import esbuild from 'esbuild';
import process from 'process';
import { copyFileSync, mkdirSync } from 'fs';

const prod = process.argv[ 2 ] === 'production';
const OUT  = '../../../.obsidian/plugins/starmind-code';

const copyPlugin = {
	name: 'copy-assets',
	setup( build ) {
		build.onEnd( () => {
			mkdirSync( OUT, { recursive: true } );
			copyFileSync( 'manifest.json',  `${ OUT }/manifest.json` );
			copyFileSync( 'src/styles.css', `${ OUT }/styles.css` );
		} );
	},
};

const context = await esbuild.context( {
	entryPoints: [ 'src/StarMindCodePlugin.ts' ],
	bundle: true,
	external: [
		'obsidian', 'electron',
		// CM6 core — Obsidian ships these; do not bundle them
		'@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
		'@codemirror/language', '@codemirror/lint', '@codemirror/search',
		'@codemirror/state', '@codemirror/view',
		// lezer core — also shipped by Obsidian
		'@lezer/common', '@lezer/highlight', '@lezer/lr',
	],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: `${ OUT }/main.js`,
	plugins: [ copyPlugin ],
} );

if ( prod ) {
	await context.rebuild();
	process.exit( 0 );
} else {
	await context.watch();
}
