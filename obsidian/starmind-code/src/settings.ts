import { PluginSettingTab, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type StarMindCodePlugin from './StarMindCodePlugin'
import { LANGUAGE_DEFS } from './languages'

export type IndentType = 'spaces' | 'tabs'

// Settings shape: per-library on/off flags plus editor behaviour.
export interface StarMindCodeSettings {
	enabled:    Record<string, boolean>   // language id → on/off
	tabSize:    number                    // indent width, in columns
	indentType: IndentType                // insert spaces or a real tab
	editable:   boolean                   // false = read-only viewer
}

// Every library ships enabled — the plugin is whole out of the box; the panel
// only lets you pare it back. Editing defaults on at a 3-wide space indent.
export const DEFAULT_SETTINGS: StarMindCodeSettings = {
	enabled:    Object.fromEntries( LANGUAGE_DEFS.map( ( d ) => [ d.id, true ] ) ),
	tabSize:    3,
	indentType: 'spaces',
	editable:   true,
}

export class StarMindCodeSettingTab extends PluginSettingTab {

	private plugin: StarMindCodePlugin

	constructor( app: App, plugin: StarMindCodePlugin ) {
		super( app, plugin )
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting( containerEl )
			.setName( 'Code libraries' )
			.setDesc( 'Turn a language on to open its files in the read-only code viewer with '
				+ 'syntax highlighting. Turn it off to hand those files back to Obsidian. '
				+ 'Changes apply immediately.' )
			.setHeading()

		for ( const def of LANGUAGE_DEFS ) {
			new Setting( containerEl )
				.setName( def.label )
				.setDesc( def.extensions.map( ( e ) => `.${ e }` ).join( '  ·  ' ) )
				.addToggle( ( toggle ) => toggle
					.setValue( this.plugin.settings.enabled[ def.id ] ?? true )
					.onChange( async ( value ) => {
						this.plugin.settings.enabled[ def.id ] = value
						await this.plugin.saveSettings()
						this.plugin.applyExtensions()
					} ),
				)
		}

		new Setting( containerEl )
			.setName( 'Editor' )
			.setDesc( 'How the code viewer indents and whether it lets you type. '
				+ 'Changes apply to open files immediately.' )
			.setHeading()

		new Setting( containerEl )
			.setName( 'Editable' )
			.setDesc( 'Allow typing and saving. Turn off for a read-only viewer.' )
			.addToggle( ( toggle ) => toggle
				.setValue( this.plugin.settings.editable )
				.onChange( async ( value ) => {
					this.plugin.settings.editable = value
					await this.plugin.saveSettings()
					this.plugin.refreshViews()
				} ),
			)

		new Setting( containerEl )
			.setName( 'Tab type' )
			.setDesc( 'Insert spaces or a real tab character when you indent.' )
			.addDropdown( ( dropdown ) => dropdown
				.addOption( 'spaces', 'Spaces' )
				.addOption( 'tabs', 'Tabs' )
				.setValue( this.plugin.settings.indentType )
				.onChange( async ( value ) => {
					this.plugin.settings.indentType = value as IndentType
					await this.plugin.saveSettings()
					this.plugin.refreshViews()
				} ),
			)

		new Setting( containerEl )
			.setName( 'Tab width' )
			.setDesc( 'Indent size, in columns.' )
			.addDropdown( ( dropdown ) => dropdown
				.addOption( '2', '2' )
				.addOption( '3', '3' )
				.addOption( '4', '4' )
				.addOption( '8', '8' )
				.setValue( String( this.plugin.settings.tabSize ) )
				.onChange( async ( value ) => {
					this.plugin.settings.tabSize = parseInt( value, 10 )
					await this.plugin.saveSettings()
					this.plugin.refreshViews()
				} ),
			)
	}
}
