import { Plugin } from 'obsidian'
import { CodeView, VIEW_TYPE_CODE } from './CodeView'
import { LANGUAGE_DEFS } from './languages'
import { DEFAULT_SETTINGS, StarMindCodeSettingTab } from './settings'
import type { StarMindCodeSettings } from './settings'

// Obsidian's view registry. `Plugin.registerExtensions` only *adds* handlers
// (auto-cleaned on unload, no public remove), so to toggle libraries live we
// drive registration here directly and reverse it ourselves in onunload.
interface ViewRegistry {
	registerExtensions(   extensions: string[], viewType: string ): void
	unregisterExtensions( extensions: string[] ): void
}

export default class StarMindCodePlugin extends Plugin {

	settings: StarMindCodeSettings = DEFAULT_SETTINGS

	private _registered: string[] = []

	async onload(): Promise<void> {
		await this.loadSettings()

		this.registerView( VIEW_TYPE_CODE, ( leaf ) => new CodeView( leaf, this ) )
		this.addSettingTab( new StarMindCodeSettingTab( this.app, this ) )

		this.applyExtensions()
	}

	async onunload(): Promise<void> {
		this._unregister()
		this.app.workspace.detachLeavesOfType( VIEW_TYPE_CODE )
	}

	// Register exactly the extensions of the currently-enabled libraries,
	// replacing whatever was registered before. Safe to call repeatedly —
	// every call unregisters the prior set first, so nothing double-registers.
	applyExtensions(): void {
		this._unregister()

		const exts = LANGUAGE_DEFS
			.filter( ( d ) => this.settings.enabled[ d.id ] )
			.flatMap( ( d ) => d.extensions )

		if ( exts.length ) {
			this._viewRegistry().registerExtensions( exts, VIEW_TYPE_CODE )
			this._registered = exts
		}
	}

	async loadSettings(): Promise<void> {
		// Merge persisted flags over defaults so libraries added in a later
		// version default to on rather than undefined.
		const data = await this.loadData()
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			enabled: { ...DEFAULT_SETTINGS.enabled, ...( data?.enabled ?? {} ) },
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData( this.settings )
	}

	// Push current indent/editability settings into every open code view.
	refreshViews(): void {
		for ( const leaf of this.app.workspace.getLeavesOfType( VIEW_TYPE_CODE ) ) {
			const view = leaf.view
			if ( view instanceof CodeView ) view.applySettings()
		}
	}

	// ── private ─────────────────────────────────────────────────────────────

	private _unregister(): void {
		if ( this._registered.length ) {
			this._viewRegistry().unregisterExtensions( this._registered )
			this._registered = []
		}
	}

	private _viewRegistry(): ViewRegistry {
		return ( this.app as unknown as { viewRegistry: ViewRegistry } ).viewRegistry
	}
}
