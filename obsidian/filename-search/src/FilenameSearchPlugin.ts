import { Plugin } from 'obsidian';
import { CooperativeExtensionRegistry } from './CooperativeRegistry';
import { FilenameSearchSettings } from './FilenameSearchSettings';
import { FilenameSearchSettingsTab } from './FilenameSearchSettingsTab';
import { FilenameSearchView, VIEW_TYPE_FILENAME_SEARCH } from './FilenameSearchView';
import { RawTextView, RAW_TEXT_VIEW_TYPE } from './RawTextView';

/**
 * A dedicated, persistent sidebar panel for vault-wide filename search — the
 * engineer's complement to core content Search. Never mandatory: the host is
 * whole without it, and onunload reverses onload (registry claims released,
 * our views detached).
 */
export default class FilenameSearchPlugin extends Plugin {
	settings: FilenameSearchSettings;
	registry: CooperativeExtensionRegistry;

	async onload() {
		this.settings = new FilenameSearchSettings( this );
		await this.settings.load();

		// Orphans (types nothing else opens) register to RawTextView. Swap this
		// fallback to the 'vscode-editor' view type if you'd rather orphans open in Monaco.
		this.registry = new CooperativeExtensionRegistry( this.app, RAW_TEXT_VIEW_TYPE );

		this.registerView(
			VIEW_TYPE_FILENAME_SEARCH,
			( leaf ) => new FilenameSearchView( leaf, this ),
		);
		this.registerView(
			RAW_TEXT_VIEW_TYPE,
			( leaf ) => new RawTextView( leaf ),
		);

		this.addSettingTab( new FilenameSearchSettingsTab( this.app, this ) );

		// 'file-search' is a document-with-magnifier — distinct from core Search's plain magnifier.
		this.addRibbonIcon( 'file-search', 'Filename search', () => {
			this.revealPanel();
		} );

		this.addCommand( {
			id: 'open-filename-search',
			name: 'Open filename search',
			callback: () => {
				this.revealPanel();
			},
		} );

		// Claims wait for layout-ready: by then every plugin has registered, so an
		// already-owned type (ts/js via vscode-editor) reads as owned and we no-op
		// instead of stomping it. Claiming at onload would race plugin load order.
		this.app.workspace.onLayoutReady( () => {
			for ( const ext of this.settings.enabledSet() ) this.registry.claim( ext );
			this._ensurePanel();
		} );
	}

	onunload() {
		this.registry.releaseAll();
		this.app.workspace.detachLeavesOfType( RAW_TEXT_VIEW_TYPE );
	}

	/** Re-run the open view's query after an external change. */
	refreshView() {
		const leaves = this.app.workspace.getLeavesOfType( VIEW_TYPE_FILENAME_SEARCH );
		for ( const leaf of leaves ) {
			if ( leaf.view instanceof FilenameSearchView ) leaf.view.refresh();
		}
	}

	/** Rebuild the type-card strip after custom types are added or removed. */
	refreshCards() {
		const leaves = this.app.workspace.getLeavesOfType( VIEW_TYPE_FILENAME_SEARCH );
		for ( const leaf of leaves ) {
			if ( leaf.view instanceof FilenameSearchView ) leaf.view.refreshCards();
		}
	}

	/** Open the panel if absent, then bring it forward and focus the input. */
	async revealPanel() {
		await this._ensurePanel();
		const leaf = this.app.workspace.getLeavesOfType( VIEW_TYPE_FILENAME_SEARCH )[ 0 ];
		if ( !leaf ) return;
		this.app.workspace.revealLeaf( leaf );
		if ( leaf.view instanceof FilenameSearchView ) leaf.view.focusInput();
	}

	private async _ensurePanel() {
		const { workspace } = this.app;
		if ( workspace.getLeavesOfType( VIEW_TYPE_FILENAME_SEARCH ).length > 0 ) return;
		const leaf = workspace.getLeftLeaf( false );
		if ( !leaf ) return;
		await leaf.setViewState( { type: VIEW_TYPE_FILENAME_SEARCH, active: false } );
	}
}
