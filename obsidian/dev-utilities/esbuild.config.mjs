import esbuild from 'esbuild'
import process from 'process'
import { copyFileSync, mkdirSync } from 'fs'

const prod = process.argv[ 2 ] === 'production'
const OUT = '../../../.obsidian/plugins/dev-utilities'

const copyPlugin = {
	name: 'copy-assets',
	setup( build ) {
		build.onEnd( () => {
			mkdirSync( OUT, { recursive: true } )
			copyFileSync( 'manifest.json', `${ OUT }/manifest.json` )
			copyFileSync( 'src/styles.css', `${ OUT }/styles.css` )
		} )
	},
}

const context = await esbuild.context( {
	entryPoints: [ 'src/DevUtilitiesPlugin.ts' ],
	bundle: true,
	external: [
		'obsidian', 'electron', 'fs', 'path', 'os', 'child_process',
		'@codemirror/*', '@lezer/*',
	],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: `${ OUT }/main.js`,
	plugins: [ copyPlugin ],
} )

if ( prod ) {
	await context.rebuild()
	process.exit( 0 )
} else {
	await context.watch()
}
