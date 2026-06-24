/**
 * TerminalSettings — the plugin's persisted configuration shape and its defaults.
 *
 * Plain JSON, written to the plugin's own data.json (survives plugin updates). Defaults reflect a
 * stock Windows box: PowerShell on PATH, Git Bash at its standard install location. `extraPath` is
 * kept as raw newline-separated text (one directory per line) and parsed at spawn time.
 */

import { DEFAULT_FONT } from './Fonts'

export interface TerminalSettings {
	powershellPath: string
	powershellArgs: string
	bashPath: string
	bashArgs: string
	startupDir: string
	extraPath: string
	fontFamily: string
	fontSize: number
	scrollback: number
}

export const DEFAULT_SETTINGS: TerminalSettings = {
	powershellPath: 'powershell.exe',
	powershellArgs: '-NoLogo',
	bashPath: 'C:\\Program Files\\Git\\bin\\bash.exe',
	bashArgs: '-i',
	startupDir: '',
	extraPath: '',
	fontFamily: DEFAULT_FONT,
	fontSize: 13,
	scrollback: 1000
}
