import { App, Notice, PluginSettingTab, Setting, type TextAreaComponent } from 'obsidian'
import { execFile } from 'child_process'
import { MONO_FONTS } from './Fonts'
import type TerminalPlugin from './TerminalPlugin'

/**
 * TerminalSettingTab — the settings UI under Settings → Embedded Terminal.
 *
 * Exposes the system-reflecting knobs: each shell's executable path and launch args, the startup
 * directory, extra PATH directories (one per line, prepended for spawned shells), and xterm font
 * size / scrollback. Every change writes straight back to the plugin's data.json.
 */
export class TerminalSettingTab extends PluginSettingTab {
	private _plugin: TerminalPlugin

	constructor( app: App, plugin: TerminalPlugin ) {
		super( app, plugin )
		this._plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		this._addPowerShell( containerEl )
		this._addBash( containerEl )
		this._addEnvironment( containerEl )
		this._addAppearance( containerEl )
	}

	private _addPowerShell( containerEl: HTMLElement ): void {
		new Setting( containerEl ).setName( 'PowerShell' ).setHeading()

		new Setting( containerEl )
			.setName( 'Executable path' )
			.setDesc( 'Path to powershell.exe (or pwsh.exe). Bare name resolves on PATH.' )
			.addText( text => text
				.setValue( this._plugin.settings.powershellPath )
				.onChange( async value => {
					this._plugin.settings.powershellPath = value
					await this._plugin.saveSettings()
				} ) )

		new Setting( containerEl )
			.setName( 'Arguments' )
			.setDesc( 'Space-separated launch arguments.' )
			.addText( text => text
				.setValue( this._plugin.settings.powershellArgs )
				.onChange( async value => {
					this._plugin.settings.powershellArgs = value
					await this._plugin.saveSettings()
				} ) )
	}

	private _addBash( containerEl: HTMLElement ): void {
		new Setting( containerEl ).setName( 'Git Bash' ).setHeading()

		new Setting( containerEl )
			.setName( 'Executable path' )
			.setDesc( 'Path to bash.exe (typically under your Git install).' )
			.addText( text => text
				.setValue( this._plugin.settings.bashPath )
				.onChange( async value => {
					this._plugin.settings.bashPath = value
					await this._plugin.saveSettings()
				} ) )

		new Setting( containerEl )
			.setName( 'Arguments' )
			.setDesc( 'Space-separated launch arguments.' )
			.addText( text => text
				.setValue( this._plugin.settings.bashArgs )
				.onChange( async value => {
					this._plugin.settings.bashArgs = value
					await this._plugin.saveSettings()
				} ) )
	}

	private _addEnvironment( containerEl: HTMLElement ): void {
		new Setting( containerEl ).setName( 'Environment' ).setHeading()

		new Setting( containerEl )
			.setName( 'Startup directory' )
			.setDesc( 'Working directory for new terminals. Leave blank to use the vault root.' )
			.addText( text => text
				.setValue( this._plugin.settings.startupDir )
				.onChange( async value => {
					this._plugin.settings.startupDir = value
					await this._plugin.saveSettings()
				} ) )

		let pathArea: TextAreaComponent | null = null

		new Setting( containerEl )
			.setName( 'Additional PATH directories' )
			.setDesc( 'One directory per line. Prepended to PATH for every terminal spawned.' )
			.addButton( btn => btn
				.setButtonText( 'Import from PowerShell' )
				.setTooltip( 'Pull the system + user PATH so installed tooling resolves without manual entry' )
				.onClick( async () => {
					btn.setDisabled( true )
					try {
						const dirs = await this._queryPath()
						this._plugin.settings.extraPath = dirs.join( '\n' )
						await this._plugin.saveSettings()
						pathArea?.setValue( this._plugin.settings.extraPath )
						new Notice( `Imported ${ dirs.length } PATH ${ dirs.length === 1 ? 'directory' : 'directories' }` )
					} catch( err ) {
						new Notice( `PATH import failed: ${ ( err as Error ).message }` )
					} finally {
						btn.setDisabled( false )
					}
				} ) )
			.addTextArea( area => {
				pathArea = area
				area
					.setValue( this._plugin.settings.extraPath )
					.onChange( async value => {
						this._plugin.settings.extraPath = value
						await this._plugin.saveSettings()
					} )
				area.inputEl.rows = 5
				area.inputEl.style.width = '100%'
			} )
	}

	/**
	 * Ask PowerShell for the authoritative Machine + User PATH and return its directories, trimmed
	 * and de-duplicated (case-insensitively, first occurrence wins). Read from the registry rather
	 * than this process's inherited env so entries added after Obsidian launched are still captured.
	 */
	private _queryPath(): Promise<string[]> {
		const ps     = this._plugin.settings.powershellPath || 'powershell.exe'
		const script = "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"

		return new Promise( ( resolve, reject ) => {
			execFile( ps, [ '-NoProfile', '-NonInteractive', '-Command', script ], { windowsHide: true }, ( err, stdout ) => {
				if( err ) { reject( err ); return }

				const seen: Set<string> = new Set()
				const dirs: string[]    = []
				for( const part of stdout.split( ';' ) ) {
					const dir = part.trim()
					if( !dir ) continue
					const key = dir.toLowerCase()
					if( seen.has( key ) ) continue
					seen.add( key )
					dirs.push( dir )
				}
				resolve( dirs )
			} )
		} )
	}

	private _addAppearance( containerEl: HTMLElement ): void {
		new Setting( containerEl ).setName( 'Appearance' ).setHeading()

		new Setting( containerEl )
			.setName( 'Font' )
			.setDesc( 'Monospace font for the terminal. Reopen a terminal to apply.' )
			.addDropdown( dd => {
				for( const font of MONO_FONTS ) dd.addOption( font.value, font.label )
				dd
					.setValue( this._plugin.settings.fontFamily )
					.onChange( async value => {
						this._plugin.settings.fontFamily = value
						await this._plugin.saveSettings()
					} )
			} )

		new Setting( containerEl )
			.setName( 'Font size' )
			.setDesc( 'Terminal font size in pixels. Reopen a terminal to apply.' )
			.addText( text => text
				.setValue( String( this._plugin.settings.fontSize ) )
				.onChange( async value => {
					const n = Number( value )
					if( !Number.isFinite( n ) || n <= 0 ) return
					this._plugin.settings.fontSize = n
					await this._plugin.saveSettings()
				} ) )

		new Setting( containerEl )
			.setName( 'Scrollback' )
			.setDesc( 'Lines of output kept in the buffer. Reopen a terminal to apply.' )
			.addText( text => text
				.setValue( String( this._plugin.settings.scrollback ) )
				.onChange( async value => {
					const n = Number( value )
					if( !Number.isFinite( n ) || n <= 0 ) return
					this._plugin.settings.scrollback = n
					await this._plugin.saveSettings()
				} ) )
	}
}
