import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import type { TerminalSettings } from './TerminalSettings'
import { SHELL, type ShellId } from './Shells'

/**
 * TerminalSession — owns one spawned shell process and pipes it to/from the view.
 *
 * No PTY: the shell runs with piped stdio. That means no TTY line discipline — the shell does not
 * echo typed input, so the view supplies its own local echo and line editing and feeds completed
 * lines here via write(). Output (stdout + stderr) flows back through the onData callback. PATH
 * additions and the chosen shell's path/args come from settings, resolved at start().
 */
export class TerminalSession {
	private _proc: ChildProcess | null = null

	private _onData: ( chunk: string ) => void
	private _onExit: () => void

	constructor( onData: ( chunk: string ) => void, onExit: () => void ) {
		this._onData = onData
		this._onExit = onExit
	}

	// ---- Lifecycle ----

	start( shell: ShellId, settings: TerminalSettings, cwd: string ): void {
		if( this._proc ) return

		const { file, args } = this._resolve( shell, settings )
		const env = this._buildEnv( settings )

		this._proc = spawn( file, args, { cwd, env, windowsHide: true } )

		this._proc.stdout?.on( 'data', this._onStdout.bind( this ) )
		this._proc.stderr?.on( 'data', this._onStdout.bind( this ) )
		this._proc.on( 'error', this._onError.bind( this ) )
		this._proc.on( 'exit', this._onProcExit.bind( this ) )
	}

	write( data: string ): void {
		if( !this._proc?.stdin?.writable ) return
		this._proc.stdin.write( data )
	}

	dispose(): void {
		if( !this._proc ) return
		this._proc.kill()
		this._proc = null
	}

	// ---- Handlers ----

	private _onStdout( chunk: Buffer ): void {
		this._onData( chunk.toString( 'utf8' ) )
	}

	private _onError( err: Error ): void {
		this._onData( `\r\n[failed to start shell: ${ err.message }]\r\n` )
	}

	private _onProcExit(): void {
		this._proc = null
		this._onExit()
	}

	// ---- Helpers ----

	/** Pick the executable and argument list for the requested shell from settings. */
	private _resolve( shell: ShellId, settings: TerminalSettings ): { file: string, args: string[] } {
		if( shell === SHELL.BASH ) return { file: settings.bashPath, args: this._splitArgs( settings.bashArgs ) }
		return { file: settings.powershellPath, args: this._splitArgs( settings.powershellArgs ) }
	}

	/** Clone the host environment and prepend the user's configured PATH directories. */
	private _buildEnv( settings: TerminalSettings ): NodeJS.ProcessEnv {
		const env = { ...process.env }

		const dirs: string[] = []
		for( const line of settings.extraPath.split( /\r?\n/ ) ) {
			const dir = line.trim()
			if( dir ) dirs.push( dir )
		}
		if( !dirs.length ) return env

		const sep = ';'
		env.PATH = dirs.join( sep ) + sep + ( env.PATH ?? '' )
		return env
	}

	private _splitArgs( raw: string ): string[] {
		const args: string[] = []
		for( const token of raw.split( /\s+/ ) ) {
			if( token ) args.push( token )
		}
		return args
	}
}
