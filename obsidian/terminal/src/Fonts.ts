/**
 * Fonts — the monospace font choices offered for the terminal.
 *
 * Each entry pairs a dropdown label with the CSS font-family stack handed to xterm. The first
 * entry defers to Obsidian's own monospace theme variable, so by default the terminal tracks the
 * vault's appearance; every other entry names a common system monospace face and ends in the
 * generic `monospace` keyword, so an absent font degrades to the system default rather than
 * breaking. The saved setting is the CSS stack itself (the option value), not an index — so the
 * choice survives reordering or trimming this list.
 */

export interface MonoFont {
	label: string
	value: string
}

export const MONO_FONTS: MonoFont[] = [
	{ label: 'Obsidian default', value: 'var( --font-monospace ), monospace' },
	{ label: 'Cascadia Code',    value: '"Cascadia Code", monospace' },
	{ label: 'Cascadia Mono',    value: '"Cascadia Mono", monospace' },
	{ label: 'Consolas',         value: 'Consolas, monospace' },
	{ label: 'JetBrains Mono',   value: '"JetBrains Mono", monospace' },
	{ label: 'Fira Code',        value: '"Fira Code", monospace' },
	{ label: 'Source Code Pro',  value: '"Source Code Pro", monospace' },
	{ label: 'Courier New',      value: '"Courier New", monospace' }
]

export const DEFAULT_FONT = MONO_FONTS[ 0 ].value
