import { ItemView, Menu, Notice, WorkspaceLeaf } from 'obsidian'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
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

	private _dir(): string {
		const basePath = ( this.app.vault.adapter as any ).basePath as string
		return join( basePath, this._plugin.settings.deckPath )
	}

	refresh(): void {
		this.contentEl.empty()
		this._renderHeader()

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

		const refreshBtn = header.createEl( 'button', { cls: 'dev-utilities-refresh', title: `Reload ${ COMMANDS_FILE }` } )
		refreshBtn.setText( '↺' )
		refreshBtn.addEventListener( 'click', () => this.refresh() )
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
