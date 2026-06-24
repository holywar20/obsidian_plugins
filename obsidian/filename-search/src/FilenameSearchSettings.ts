import type FilenameSearchPlugin from './FilenameSearchPlugin';

/* Built-in card stack. canvas added as a first-class type. */
export const TYPE_CATALOG: string[] = [
	'md', 'ts', 'js', 'jsx', 'tsx', 'mjs', 'json', 'css', 'scss', 'html', 'vue', 'py', 'canvas',
];

const DEFAULT_ENABLED: string[] = [ 'md', 'ts', 'js', 'json', 'css', 'html', 'vue' ];

interface SettingsData {
	enabled: string[];
	collapsed: boolean;
	customTypes: string[];
}

/**
 * Owns the plugin's persisted config: which type-cards are on, whether the
 * card strip is collapsed, and user-added custom extensions.
 * Mutate in memory, then call save().
 */
export class FilenameSearchSettings {
	private _plugin: FilenameSearchPlugin;
	private _data: SettingsData = { enabled: [ ...DEFAULT_ENABLED ], collapsed: false, customTypes: [] };

	constructor( plugin: FilenameSearchPlugin ) {
		this._plugin = plugin;
	}

	async load() {
		const saved = await this._plugin.loadData();
		if ( !saved ) return;
		this._data = {
			enabled: saved.enabled ?? [ ...DEFAULT_ENABLED ],
			collapsed: saved.collapsed ?? false,
			customTypes: saved.customTypes ?? [],
		};
	}

	async save() {
		await this._plugin.saveData( this._data );
	}

	get collapsed(): boolean { return this._data.collapsed; }
	setCollapsed( value: boolean ) { this._data.collapsed = value; }

	get customTypes(): string[] { return this._data.customTypes; }

	/** Full type list: built-in catalog + user-added types (deduped). */
	catalog(): string[] {
		const extra = this._data.customTypes.filter( e => !TYPE_CATALOG.includes( e ) );
		return [ ...TYPE_CATALOG, ...extra ];
	}

	/** True if the extension is in the built-in catalog or the custom list. */
	hasType( ext: string ): boolean {
		return TYPE_CATALOG.includes( ext ) || this._data.customTypes.includes( ext );
	}

	addCustomType( ext: string ) {
		if ( this._data.customTypes.includes( ext ) ) return;
		this._data.customTypes.push( ext );
	}

	removeCustomType( ext: string ) {
		this._data.customTypes = this._data.customTypes.filter( e => e !== ext );
		this.disable( ext );
	}

	isEnabled( ext: string ): boolean {
		return this._data.enabled.includes( ext );
	}

	/** The in-scope extensions, lowercased, as a Set for fast membership tests. */
	enabledSet(): Set<string> {
		const out = new Set<string>();
		for ( const ext of this._data.enabled ) out.add( ext.toLowerCase() );
		return out;
	}

	enable( ext: string ) {
		if ( this._data.enabled.includes( ext ) ) return;
		this._data.enabled.push( ext );
	}

	disable( ext: string ) {
		this._data.enabled = this._data.enabled.filter( ( e ) => e !== ext );
	}
}
