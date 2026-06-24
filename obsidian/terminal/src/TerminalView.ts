import { ItemView, Menu, type WorkspaceLeaf } from 'obsidian'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { TerminalSession } from './TerminalSession'
import { SHELL, SHELL_META, type ShellId } from './Shells'
import type TerminalPlugin from './TerminalPlugin'

export const TERMINAL_VIEW_TYPE = 'embedded-terminal-view'

/**
 * TerminalView — a workspace tab hosting an xterm.js terminal over a piped shell.
 *
 * Because the session has no PTY, this view IS the line discipline: it locally echoes keystrokes,
 * maintains the editable input buffer, walks command history, and only ships completed lines to
 * the shell on Enter. Shell output is written straight through. The shell choice arrives via
 * setState (on restore) or initShell (on fresh open); _ensureStarted() is idempotent so whichever
 * fires first wins and the second is a no-op.
 */
export class TerminalView extends ItemView {
	private _plugin: TerminalPlugin
	private _shell: ShellId = SHELL.POWERSHELL

	private _term: Terminal | null = null
	private _fit: FitAddon | null = null
	private _session: TerminalSession | null = null
	private _resizeObserver: ResizeObserver | null = null

	private _input = ''
	private _history: string[] = []
	private _histIdx = -1

	constructor( leaf: WorkspaceLeaf, plugin: TerminalPlugin ) {
		super( leaf )
		this._plugin = plugin
	}

	// ---- Obsidian view contract ----

	getViewType(): string { return TERMINAL_VIEW_TYPE }
	getDisplayText(): string { return `${ SHELL_META[ this._shell ].label }` }
	getIcon(): string { return SHELL_META[ this._shell ].icon }

	getState(): Record<string, unknown> {
		return { shell: this._shell }
	}

	async setState( state: unknown, result: unknown ): Promise<void> {
		const shell = ( state as { shell?: ShellId } )?.shell
		if( shell === SHELL.BASH || shell === SHELL.POWERSHELL ) this._shell = shell
		this._ensureStarted()
		// @ts-expect-error - super.setState signature varies across Obsidian type versions
		await super.setState( state, result )
	}

	async onOpen(): Promise<void> {
		this._buildDom()
		// Fallback for any open path that doesn't carry a shell. onLayoutReady fires synchronously
		// when the layout is already up (the fresh-open case), which is *before* setState/initShell
		// run — so defer one tick to let an explicit shell choice win. Without this, the fallback
		// always starts the default shell first and the real choice no-ops.
		this.app.workspace.onLayoutReady( () => window.setTimeout( () => this._ensureStarted(), 0 ) )
	}

	async onClose(): Promise<void> {
		this._teardown()
	}

	// ---- Public ----

	/** Set the shell for a fresh open and start the session (idempotent). */
	initShell( shell: ShellId ): void {
		this._shell = shell
		this._ensureStarted()
	}

	// ---- Setup ----

	private _buildDom(): void {
		this.contentEl.empty()
		this.contentEl.addClass( 'embedded-terminal-view' )

		const host = this.contentEl.createDiv( { cls: 'embedded-terminal-host' } )

		this._term = new Terminal( {
			fontSize: this._plugin.settings.fontSize,
			scrollback: this._plugin.settings.scrollback,
			cursorBlink: true,
			convertEol: true,
			allowTransparency: true,
			fontFamily: this._plugin.settings.fontFamily,
			theme: { background: 'rgba(0,0,0,0)' }
		} )

		this._fit = new FitAddon()
		this._term.loadAddon( this._fit )
		this._term.open( host )
		this._term.onData( this._onTermData.bind( this ) )

		// Replace Electron's native context menu with Obsidian's, so it inherits the active theme.
		// registerDomEvent ties the listener to the view's lifecycle — auto-removed on close.
		this.registerDomEvent( host, 'contextmenu', this._showContextMenu.bind( this ) )

		this._resizeObserver = new ResizeObserver( this._onResize.bind( this ) )
		this._resizeObserver.observe( host )
	}

	private _ensureStarted(): void {
		if( this._session || !this._term ) return

		this._session = new TerminalSession(
			this._onShellData.bind( this ),
			this._onShellExit.bind( this )
		)
		this._session.start( this._shell, this._plugin.settings, this._plugin.getCwd() )
		this._term.focus()
	}

	private _teardown(): void {
		this._resizeObserver?.disconnect()
		this._resizeObserver = null

		this._session?.dispose()
		this._session = null

		this._term?.dispose()
		this._term = null

		this.contentEl.empty()
	}

	// ---- Shell -> screen ----

	private _onShellData( chunk: string ): void {
		this._term?.write( chunk )
	}

	private _onShellExit(): void {
		this._term?.write( '\r\n[process exited]\r\n' )
	}

	// ---- Resize ----

	private _onResize(): void {
		this._fit?.fit()
	}

	// ---- Keyboard -> local line editor ----

	/**
	 * Local line discipline. The piped shell gives no echo, so every visible character here is
	 * drawn by us; only a completed line (on Enter) is shipped to the shell.
	 */
	private _onTermData( data: string ): void {
		switch( data ) {
			case '\r':
				this._submitLine()
				return
			case '\x7f':
			case '\b':
				this._backspace()
				return
			case '\x03':
				// Ctrl+C copies when there's a selection (matching Windows Terminal); otherwise it
				// falls through to cancelling the current input line.
				if( this._copySelection() ) return
				this._cancelLine()
				return
			case '\x16':
				void this._paste()
				return
			case '\x1b[A':
				this._historyPrev()
				return
			case '\x1b[B':
				this._historyNext()
				return
		}

		// Ignore any other control / escape sequence (arrows left-right, function keys, etc.).
		if( data < ' ' || data.charCodeAt( 0 ) === 0x1b ) return

		this._input += data
		this._term?.write( data )
	}

	private _submitLine(): void {
		const line = this._input
		this._term?.write( '\r\n' )
		this._session?.write( `${ line }\n` )

		if( line.trim() ) {
			this._history.push( line )
			if( this._history.length > 200 ) this._history.shift()
		}
		this._histIdx = this._history.length
		this._input = ''
	}

	private _backspace(): void {
		if( !this._input ) return
		this._input = this._input.slice( 0, -1 )
		this._term?.write( '\b \b' )
	}

	private _cancelLine(): void {
		this._term?.write( '^C\r\n' )
		this._input = ''
		this._histIdx = this._history.length
	}

	// ---- Clipboard ----

	/** Copy the current selection to the clipboard. Returns false when nothing is selected. */
	private _copySelection(): boolean {
		const sel = this._term?.getSelection() ?? ''
		if( !sel ) return false
		void navigator.clipboard.writeText( sel )
		this._term?.clearSelection()
		return true
	}

	/**
	 * Paste clipboard text into the input line. Newlines submit (a multi-line paste runs as
	 * successive commands); other control characters are dropped so pasted escape codes can't
	 * corrupt the local line buffer.
	 */
	private async _paste(): Promise<void> {
		const text = await navigator.clipboard.readText()
		if( !text ) return

		for( const ch of text.replace( /\r\n/g, '\n' ) ) {
			if( ch === '\n' ) { this._submitLine(); continue }
			if( ch < ' ' ) continue
			this._input += ch
			this._term?.write( ch )
		}
	}

	/** Obsidian-themed replacement for the native right-click menu. */
	private _showContextMenu( e: MouseEvent ): void {
		e.preventDefault()

		const menu     = new Menu()
		const hasSel   = this._term?.hasSelection() ?? false

		menu.addItem( i => i.setTitle( 'Copy' ).setIcon( 'copy' ).setDisabled( !hasSel ).onClick( () => { this._copySelection() } ) )
		menu.addItem( i => i.setTitle( 'Paste' ).setIcon( 'clipboard-paste' ).onClick( () => { void this._paste() } ) )

		menu.showAtMouseEvent( e )
	}

	private _historyPrev(): void {
		if( !this._history.length || this._histIdx === 0 ) return
		this._histIdx -= 1
		this._replaceInput( this._history[ this._histIdx ] )
	}

	private _historyNext(): void {
		if( this._histIdx >= this._history.length ) return
		this._histIdx += 1
		const next = this._histIdx === this._history.length ? '' : this._history[ this._histIdx ]
		this._replaceInput( next )
	}

	/** Erase the visible input line and redraw it with nInput. */
	private _replaceInput( nInput: string ): void {
		for( let i = 0; i < this._input.length; i++ ) this._term?.write( '\b \b' )
		this._input = nInput
		this._term?.write( nInput )
	}
}
