import { FileSystemAdapter, Plugin } from 'obsidian'
import { TerminalView, TERMINAL_VIEW_TYPE } from './TerminalView'
import { TerminalSettingTab } from './TerminalSettingTab'
import { DEFAULT_SETTINGS, type TerminalSettings } from './TerminalSettings'
import { SHELL, SHELL_META, type ShellId } from './Shells'

/**
 * TerminalPlugin — wires the embedded terminal into Obsidian.
 *
 * Registers one view type rendered as a main-area tab, two ribbon buttons (PowerShell, Git Bash)
 * and matching command-palette entries that open a fresh terminal of that shell, and the settings
 * tab. Each terminal is an independent piped shell process owned by its TerminalView — no PTY, no
 * native dependencies, so nothing to rebuild against Obsidian's Electron.
 */
export default class TerminalPlugin extends Plugin {
	settings: TerminalSettings = DEFAULT_SETTINGS

	async onload(): Promise<void> {
		await this._loadSettings()

		this.registerView( TERMINAL_VIEW_TYPE, leaf => new TerminalView( leaf, this ) )

		this.addRibbonIcon( SHELL_META.powershell.icon, 'Open PowerShell terminal', () => this.openTerminal( SHELL.POWERSHELL ) )
		this.addRibbonIcon( SHELL_META.bash.icon, 'Open Git Bash terminal', () => this.openTerminal( SHELL.BASH ) )

		this.addCommand( {
			id: 'open-powershell',
			name: 'Open PowerShell terminal',
			callback: () => this.openTerminal( SHELL.POWERSHELL )
		} )
		this.addCommand( {
			id: 'open-bash',
			name: 'Open Git Bash terminal',
			callback: () => this.openTerminal( SHELL.BASH )
		} )

		this.addSettingTab( new TerminalSettingTab( this.app, this ) )
	}

	/** Open a new terminal tab running the given shell and focus it. */
	async openTerminal( shell: ShellId ): Promise<void> {
		const leaf = this.app.workspace.getLeaf( 'tab' )
		await leaf.setViewState( { type: TERMINAL_VIEW_TYPE, active: true, state: { shell } } )
		this.app.workspace.revealLeaf( leaf )

		const view = leaf.view
		if( view instanceof TerminalView ) view.initShell( shell )
	}

	/** Resolve the working directory for new terminals: configured dir, else the vault root. */
	getCwd(): string {
		if( this.settings.startupDir ) return this.settings.startupDir

		const adapter = this.app.vault.adapter
		if( adapter instanceof FileSystemAdapter ) return adapter.getBasePath()
		return process.cwd()
	}

	async saveSettings(): Promise<void> {
		await this.saveData( this.settings )
	}

	private async _loadSettings(): Promise<void> {
		this.settings = Object.assign( {}, DEFAULT_SETTINGS, await this.loadData() )
	}
}
