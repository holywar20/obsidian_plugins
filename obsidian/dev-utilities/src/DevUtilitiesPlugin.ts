import { Plugin, PluginSettingTab, Setting, App } from 'obsidian'
import { DevUtilitiesView, VIEW_TYPE_DEV_UTILITIES } from './DevUtilitiesView'

export interface CommandDeckSettings {
	deckPath: string
}

const DEFAULT_SETTINGS: CommandDeckSettings = {
	deckPath: 'dev-utilities',
}

export default class DevUtilitiesPlugin extends Plugin {
	settings: CommandDeckSettings = { ...DEFAULT_SETTINGS }

	async onload(): Promise<void> {
		await this._loadSettings()

		this.registerView(
			VIEW_TYPE_DEV_UTILITIES,
			( leaf ) => new DevUtilitiesView( leaf, this ),
		)

		this.addSettingTab( new CommandDeckSettingsTab( this.app, this ) )

		this.addCommand( {
			id: 'reveal-dev-utilities',
			name: 'Reveal Command Deck panel',
			callback: () => this._openPanel(),
		} )

		this.app.workspace.onLayoutReady( () => {
			this._openPanel()
		} )
	}

	async saveSettings(): Promise<void> {
		await this.saveData( this.settings )
	}

	private async _loadSettings(): Promise<void> {
		this.settings = Object.assign( {}, DEFAULT_SETTINGS, await this.loadData() )
	}

	private async _openPanel(): Promise<void> {
		const { workspace } = this.app
		if ( workspace.getLeavesOfType( VIEW_TYPE_DEV_UTILITIES ).length > 0 ) return

		// Place alongside Favorites in the same tab group if it exists
		const favLeaves = workspace.getLeavesOfType( 'favorites-view' )
		if ( favLeaves.length > 0 ) {
			const parent = ( favLeaves[ 0 ] as any ).parent
			const leaf = ( workspace as any ).createLeafInParent( parent, parent.children.length )
			await leaf.setViewState( { type: VIEW_TYPE_DEV_UTILITIES, active: false } )
			return
		}

		// Fallback: open in a new left sidebar leaf
		const leaf = workspace.getLeftLeaf( true )
		if ( !leaf ) return
		await leaf.setViewState( { type: VIEW_TYPE_DEV_UTILITIES, active: false } )
	}
}

class CommandDeckSettingsTab extends PluginSettingTab {
	private _plugin: DevUtilitiesPlugin

	constructor( app: App, plugin: DevUtilitiesPlugin ) {
		super( app, plugin )
		this._plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting( containerEl )
			.setName( 'Deck folder' )
			.setDesc( 'Path to the folder containing commands.json, relative to the vault root.' )
			.addText( text => text
				.setPlaceholder( 'dev-utilities' )
				.setValue( this._plugin.settings.deckPath )
				.onChange( async ( value ) => {
					this._plugin.settings.deckPath = value.trim() || DEFAULT_SETTINGS.deckPath
					await this._plugin.saveSettings()
					this.app.workspace.getLeavesOfType( VIEW_TYPE_DEV_UTILITIES )
						.forEach( leaf => ( leaf.view as DevUtilitiesView ).refresh() )
				} ),
			)
	}
}
