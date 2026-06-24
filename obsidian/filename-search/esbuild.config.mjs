import esbuild from 'esbuild';
import process from 'process';
import { copyFileSync, mkdirSync } from 'fs';

const prod = process.argv[ 2 ] === 'production';
const outDir = '../../../.obsidian/plugins/filename-search';

/* esbuild only emits main.js. The manifest and styles are static, so copy them
   into the deployed plugin folder here — that way a single `npm run dev` lands
   everything Obsidian needs. Re-run the build if manifest.json or styles.css change. */
mkdirSync( outDir, { recursive: true } );
copyFileSync( 'manifest.json', `${ outDir }/manifest.json` );
copyFileSync( 'styles.css', `${ outDir }/styles.css` );

const context = await esbuild.context( {
	entryPoints: [ 'src/FilenameSearchPlugin.ts' ],
	bundle: true,
	external: [ 'obsidian', 'electron', '@codemirror/*', '@lezer/*' ],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: `${ outDir }/main.js`,
} );

if ( prod ) {
	await context.rebuild();
	process.exit( 0 );
} else {
	await context.watch();
}
