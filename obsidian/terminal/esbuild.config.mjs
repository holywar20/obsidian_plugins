import esbuild from 'esbuild'
import process from 'process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

const prod = process.argv[ 2 ] === 'production'
const OUT = '../../../.obsidian/plugins/embedded-terminal'

// xterm ships its own CSS; Obsidian only auto-loads the plugin's own styles.css, so we
// concatenate xterm's stylesheet ahead of ours into a single deployed styles.css.
const copyAssets = {
	name: 'copy-assets',
	setup( build ) {
		build.onEnd( () => {
			mkdirSync( OUT, { recursive: true } )
			copyFileSync( 'manifest.json', `${ OUT }/manifest.json` )
			const xtermCss = readFileSync( 'node_modules/@xterm/xterm/css/xterm.css', 'utf8' )
			const ownCss = readFileSync( 'styles.css', 'utf8' )
			writeFileSync( `${ OUT }/styles.css`, `${ xtermCss }\n${ ownCss }` )
		} )
	}
}

const context = await esbuild.context( {
	entryPoints: [ 'src/TerminalPlugin.ts' ],
	bundle: true,
	external: [ 'obsidian', 'electron', 'child_process', 'fs', 'path', 'os', 'process', '@codemirror/*', '@lezer/*' ],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: `${ OUT }/main.js`,
	plugins: [ copyAssets ]
} )

if ( prod ) {
	await context.rebuild()
	process.exit( 0 )
} else {
	await context.watch()
}
