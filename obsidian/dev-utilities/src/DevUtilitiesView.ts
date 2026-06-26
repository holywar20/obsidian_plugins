import { ItemView, Menu, Notice, WorkspaceLeaf } from 'obsidian'
import { readFileSync, existsSync } from 'fs'
import { join, extname, isAbsolute } from 'path'
import { exec } from 'child_process'
import type DevUtilitiesPlugin from './DevUtilitiesPlugin'

export const VIEW_TYPE_DEV_UTILITIES = 'dev-utilities-view'

const COMMANDS_FILE = 'commands.json'

// One button on the deck. A single script may appear under many commands (different args) — e.g.
// git-ops.js surfaces as Pull / Push / Status. `group` clusters buttons under a header.
interface Command {
	group: string
	label: string
	icon: string
	run: string
	args: string
}

export class DevUtilitiesView extends ItemView {
	private _plugin: DevUtilitiesPlugin
	private _configOpen = false

	constructor( leaf: WorkspaceLeaf, plugin: DevUtilitiesPlugin ) {
		super( leaf )
		this._plugin = plugin
	}

	getViewType() { return VIEW_TYPE_DEV_UTILITIES }
	getDisplayText() { return 'Command Deck' }
	getIcon() { return 'terminal' }

	async onOpen(): Promise<void> {
		this.contentEl.addClass( 'dev-utilities-panel' )
		this.refresh()
	}

	async onClose(): Promise<void> {
		this.contentEl.empty()
	}

	// The deck folder may be given as an absolute path (portable across projects — just paste the
	// full path) or as a path relative to the vault root. Absolute wins as-is; relative is anchored
	// to the vault root.
	private _dir(): string {
		const deckPath = this._plugin.settings.deckPath
		if ( isAbsolute( deckPath ) ) return deckPath
		const basePath = ( this.app.vault.adapter as any ).basePath as string
		return join( basePath, deckPath )
	}

	refresh(): void {
		this.contentEl.empty()
		this._renderHeader()
		if ( this._configOpen ) this._renderConfig()

		const deckPath = this._plugin.settings.deckPath
		const commands = this._load( join( this._dir(), COMMANDS_FILE ) )

		if ( commands === null ) {
			this.contentEl.createEl( 'div', { cls: 'dev-utilities-empty', text: `No ${ COMMANDS_FILE } in ${ deckPath }` } )
			return
		}
		if ( commands.length === 0 ) {
			this.contentEl.createEl( 'div', { cls: 'dev-utilities-empty', text: `${ COMMANDS_FILE } has no commands.` } )
			return
		}

		this._renderDeck( commands )
	}

	private _load( path: string ): Command[] | null {
		if ( !existsSync( path ) ) return null
		try {
			const raw = JSON.parse( readFileSync( path, 'utf8' ) ) as Partial<Command>[]
			return raw.map( ( c ): Command => ( {
				group: c.group ?? '',
				label: c.label ?? c.run ?? '?',
				icon:  c.icon  ?? '⚡',
				run:   c.run   ?? '',
				args:  c.args  ?? '',
			} ) )
		} catch {
			new Notice( `Command Deck: ${ COMMANDS_FILE } is invalid JSON` )
			return []
		}
	}

	private _renderHeader(): void {
		const header = this.contentEl.createEl( 'div', { cls: 'dev-utilities-header' } )
		header.createEl( 'div', { cls: 'dev-utilities-breadcrumb', text: 'command deck' } )

		const actions = header.createEl( 'div', { cls: 'dev-utilities-actions' } )

		const configBtn = actions.createEl( 'button', { cls: 'dev-utilities-icon-btn', title: 'Configure deck folder' } )
		configBtn.setText( '⚙' )
		configBtn.toggleClass( 'is-active', this._configOpen )
		configBtn.addEventListener( 'click', () => {
			this._configOpen = !this._configOpen
			this.refresh()
		} )

		const refreshBtn = actions.createEl( 'button', { cls: 'dev-utilities-icon-btn', title: `Reload ${ COMMANDS_FILE }` } )
		refreshBtn.setText( '↺' )
		refreshBtn.addEventListener( 'click', () => this.refresh() )
	}

	// Inline path editor, toggled by the gear. Reads/writes the same setting as the plugin's
	// settings tab — surfacing it here so a deck can be re-pointed per-project without leaving
	// the panel. Prefilled with the current path for easy copy-out.
	private _renderConfig(): void {
		const row = this.contentEl.createEl( 'div', { cls: 'dev-utilities-config' } )
		row.createEl( 'label', { cls: 'dev-utilities-config-label', text: 'Deck folder — absolute path, or relative to vault root' } )

		const field = row.createEl( 'div', { cls: 'dev-utilities-config-field' } )

		const input = field.createEl( 'input', { cls: 'dev-utilities-config-input', type: 'text' } )
		input.value = this._plugin.settings.deckPath
		input.placeholder = '_Claude/dev-utilities'
		input.spellcheck = false

		const save = field.createEl( 'button', { cls: 'dev-utilities-config-save', text: 'Save' } )

		const commit = async (): Promise<void> => {
			const value = input.value.trim()
			if ( !value ) { new Notice( 'Command Deck: path cannot be empty' ); return }
			this._plugin.settings.deckPath = value
			await this._plugin.saveSettings()
			this._configOpen = false
			this.refresh()
		}

		save.addEventListener( 'click', () => { void commit() } )
		input.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' )  { e.preventDefault(); void commit() }
			if ( e.key === 'Escape' ) { e.preventDefault(); this._configOpen = false; this.refresh() }
		} )

		input.focus()
		input.select()
	}

	private _renderDeck( commands: Command[] ): void {
		const deck = this.contentEl.createEl( 'div', { cls: 'dev-utilities-deck' } )

		let lastGroup: string | null = null
		let grid: HTMLElement | null = null

		for ( const cmd of commands ) {
			if ( grid === null || cmd.group !== lastGroup ) {
				lastGroup = cmd.group
				if ( cmd.group ) deck.createEl( 'div', { cls: 'dev-utilities-group', text: cmd.group } )
				grid = deck.createEl( 'div', { cls: 'dev-utilities-grid' } )
			}
			this._renderButton( grid, cmd )
		}
	}

	private _renderButton( grid: HTMLElement, cmd: Command ): void {
		const card = grid.createEl( 'div', { cls: 'dev-utilities-card' } )
		card.title = `${ cmd.run } ${ cmd.args }`.trim()

		card.createEl( 'div', { cls: 'dev-utilities-card-icon', text: cmd.icon } )
		card.createEl( 'div', { cls: 'dev-utilities-card-name', text: cmd.label } )

		card.addEventListener( 'click', () => this._launch( cmd ) )
		card.addEventListener( 'contextmenu', ( e ) => {
			e.stopPropagation()
			this._showMenu( e, cmd )
		} )
	}

	private _launch( cmd: Command ): void {
		if ( !cmd.run ) { new Notice( 'Command has no "run" script' ); return }
		const interp = extname( cmd.run ).toLowerCase() === '.py' ? 'python' : 'node'
		const path   = join( this._dir(), cmd.run ).replace( /\\/g, '/' )
		const args   = cmd.args ? ` ${ cmd.args }` : ''
		exec( `start "" powershell.exe -NoExit -Command "& ${ interp } '${ path }'${ args }"` )
		new Notice( `Running ${ cmd.label }` )
	}

	private _showMenu( e: MouseEvent, cmd: Command ): void {
		const menu = new Menu()

		menu.addItem( ( i ) => i.setTitle( 'Run' ).setIcon( 'play' ).onClick( () => this._launch( cmd ) ) )
		menu.addSeparator()
		menu.addItem( ( i ) => i.setTitle( 'Reveal script' ).setIcon( 'folder-open' ).onClick( () => {
			const winPath = join( this._dir(), cmd.run ).replace( /\//g, '\\' )
			exec( `explorer /select,"${ winPath }"` )
		} ) )

		menu.showAtMouseEvent( e )
	}
}
