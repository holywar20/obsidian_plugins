import type { LanguageSupport } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json }       from '@codemirror/lang-json'
import { html }       from '@codemirror/lang-html'
import { css }        from '@codemirror/lang-css'
import { python }     from '@codemirror/lang-python'
import { vue }        from '@codemirror/lang-vue'

// One descriptor per language library. This is the single source of truth:
// the settings panel lists these by `id`/`label`, file-extension registration
// derives from `extensions`, and the editor pulls highlighting from `support`.
//
// To add a language: import its CM6 package, append a descriptor here. The
// settings toggle and extension registration pick it up automatically.
export interface LanguageDef {
	id:         string                          // stable settings key + identity
	label:      string                          // shown in the settings panel
	extensions: string[]                        // file extensions this library claims
	support:    ( ext: string ) => LanguageSupport  // CM6 highlighting factory
}

export const LANGUAGE_DEFS: LanguageDef[] = [
	{ id: 'javascript', label: 'JavaScript', extensions: [ 'js', 'mjs', 'cjs' ], support: () => javascript() },
	{ id: 'typescript', label: 'TypeScript', extensions: [ 'ts', 'mts' ],        support: () => javascript( { typescript: true } ) },
	{ id: 'jsx',        label: 'JSX / TSX',   extensions: [ 'jsx', 'tsx' ],       support: ( ext ) => javascript( { jsx: true, typescript: ext === 'tsx' } ) },
	{ id: 'json',       label: 'JSON',        extensions: [ 'json' ],             support: () => json() },
	{ id: 'html',       label: 'HTML',        extensions: [ 'html', 'htm' ],      support: () => html() },
	{ id: 'css',        label: 'CSS',         extensions: [ 'css' ],              support: () => css() },
	{ id: 'python',     label: 'Python',      extensions: [ 'py' ],               support: () => python() },
	{ id: 'vue',        label: 'Vue',         extensions: [ 'vue' ],              support: () => vue() },
]

// Every extension across every library — the full set this plugin can claim.
export const EXTENSIONS = LANGUAGE_DEFS.flatMap( ( d ) => d.extensions )

// Resolve a file extension to its highlighting support, or null if unknown.
export function resolveSupport( ext: string ): LanguageSupport | null {
	const def = LANGUAGE_DEFS.find( ( d ) => d.extensions.includes( ext ) )
	return def ? def.support( ext ) : null
}
