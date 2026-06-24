import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type FilenameSearchPlugin from './FilenameSearchPlugin';

export class FilenameSearchSettingsTab extends PluginSettingTab {
	private _plugin: FilenameSearchPlugin;

	constructor( app: App, plugin: FilenameSearchPlugin ) {
		super( app, plugin );
		this._plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl( 'h2', { text: 'Filename search' } );

		let pendingExt = '';

		const addType = async () => {
			if ( !pendingExt ) return;
			const settings = this._plugin.settings;
			if ( settings.hasType( pendingExt ) ) {
				new Notice( `".${ pendingExt }" is already in the type list.` );
				return;
			}
			settings.addCustomType( pendingExt );
			await settings.save();
			this._plugin.refreshCards();
			this._plugin.refreshView();
			this.display();
		};

		new Setting( containerEl )
			.setName( 'Add file type' )
			.setDesc( 'Extension without the dot (e.g. "svg"). Built-in types are toggled via the type cards in the panel.' )
			.addText( ( text ) => {
				text.setPlaceholder( 'extension' ).onChange( ( value ) => {
					pendingExt = value.trim().toLowerCase().replace( /^\./, '' );
				} );
				text.inputEl.addEventListener( 'keydown', ( e ) => {
					if ( e.key === 'Enter' ) addType();
				} );
			} )
			.addButton( ( btn ) => {
				btn.setButtonText( 'Add' ).setCta().onClick( addType );
			} );

		const custom = this._plugin.settings.customTypes;
		if ( custom.length === 0 ) return;

		containerEl.createEl( 'h3', { text: 'Custom types' } );

		for ( const ext of [ ...custom ] ) {
			new Setting( containerEl )
				.setName( `.${ ext }` )
				.addButton( ( btn ) => {
					btn.setButtonText( 'Remove' ).setWarning().onClick( async () => {
						this._plugin.settings.removeCustomType( ext );
						this._plugin.registry.release( ext );
						await this._plugin.settings.save();
						this._plugin.refreshCards();
						this._plugin.refreshView();
						this.display();
					} );
				} );
		}
	}
}
