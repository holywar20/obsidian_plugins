import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { join } from 'path';
import { ExternalLinkModal } from './ExternalLinkModal';
import { ExternalLinksManager } from './ExternalLinksManager';
import { FavoritesStore } from './FavoritesStore';
import { FavoritesView, VIEW_TYPE_FAVORITES } from './FavoritesView';
import { FolderNameModal } from './FolderNameModal';

export interface FavoritesSettings {
	deckPath: string;
}

const DEFAULT_SETTINGS: FavoritesSettings = {
	deckPath: 'dev-utilities',
};

const FAVORITES_FILE = 'favorites.json';

export default class FavoritesPlugin extends Plugin {
	store: FavoritesStore;
	manager: ExternalLinksManager;
	settings: FavoritesSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		this.settings = Object.assign( {}, DEFAULT_SETTINGS, await this.loadData() );

		this.store = new FavoritesStore();
		this.manager = new ExternalLinksManager( this );
		this.store.load( this._favoritesPath() );

		this.registerView(
			VIEW_TYPE_FAVORITES,
			( leaf ) => new FavoritesView( leaf, this ),
		);

		this.addSettingTab( new FavoritesSettingsTab( this.app, this ) );

		this.addCommand( {
			id: 'add-external-favorite',
			name: 'Add external file',
			callback: () => {
				new ExternalLinkModal( this.app, this.store, async ( absolutePath, folderName ) => {
					try {
						const vaultPath = this.manager.createLink( absolutePath );
						if ( folderName ) {
							this.store.addToFolder( vaultPath, folderName );
						} else {
							this.store.addToRoot( vaultPath );
						}
						this.store.addExternal( vaultPath, absolutePath );
						this.store.save();
						this.refreshView();
						new Notice( 'External file added to Favorites.' );
					} catch ( e ) {
						new Notice( `Could not link file: ${ ( e as Error ).message }` );
					}
				} ).open();
			},
		} );

		this.registerEvent(
			this.app.workspace.on( 'file-menu', ( menu, file ) => {
				this._onFileMenu( menu, file );
			} ),
		);

		this.registerEvent(
			this.app.vault.on( 'delete', ( file ) => {
				this._onFileDelete( file );
			} ),
		);

		this.app.workspace.onLayoutReady( () => {
			this.manager.reconcile();
			this._openFavoritesPanel();
		} );
	}

	/** Called by the view's own refresh path AND by context-menu mutations. */
	refreshView() {
		const leaves = this.app.workspace.getLeavesOfType( VIEW_TYPE_FAVORITES );
		for ( const leaf of leaves ) {
			if ( leaf.view instanceof FavoritesView ) {
				leaf.view.refresh();
			}
		}
	}

	/**
	 * Central removal path. Cleans up the symlink for external favorites,
	 * then purges from the store.
	 */
	async removeFavorite( path: string ) {
		if ( this.store.isExternal( path ) ) {
			this.manager.removeLink( path );
		}
		this.store.purge( path );
		this.store.save();
		this.refreshView();
	}

	async saveSettings() {
		await this.saveData( this.settings );
	}

	/** Absolute path to the favorites JSON file. */
	_favoritesPath(): string {
		const basePath = ( this.app.vault.adapter as any ).basePath as string;
		return join( basePath, this.settings.deckPath, FAVORITES_FILE );
	}

	private _onFileMenu( menu: Menu, file: unknown ) {
		if ( !( file instanceof TFile ) ) return;
		if ( this.store.isAlreadyFavorite( file.path ) ) {
			this._addManageSubmenu( menu, file );
		} else {
			this._addAddSubmenu( menu, file );
		}
	}

	private _addAddSubmenu( menu: Menu, file: TFile ) {
		const folders = this.store.data.folders;
		menu.addItem( ( item ) => {
			item.setTitle( 'Add to Favorites' ).setIcon( 'star' );
			const submenu = ( item as any ).setSubmenu();

			submenu.addItem( ( sub ) => {
				sub.setTitle( 'No folder' ).setIcon( 'home' ).onClick( async () => {
					this.store.addToRoot( file.path );
					this.store.save();
					this.refreshView();
				} );
			} );

			for ( const folder of folders ) {
				const name = folder.name;
				submenu.addItem( ( sub ) => {
					sub.setTitle( name ).setIcon( 'folder' ).onClick( async () => {
						this.store.addToFolder( file.path, name );
						this.store.save();
						this.refreshView();
					} );
				} );
			}

			submenu.addSeparator();
			submenu.addItem( ( sub ) => {
				sub.setTitle( 'New folder...' ).setIcon( 'folder-plus' ).onClick( () => {
					new FolderNameModal( this.app, '', ( name ) => {
						this.store.addToFolder( file.path, name );
						this.store.save();
						this.refreshView();
					} ).open();
				} );
			} );
		} );
	}

	private _addManageSubmenu( menu: Menu, file: TFile ) {
		const folders = this.store.data.folders;
		const currentFolder = this.store.getFolder( file.path );

		menu.addItem( ( item ) => {
			item.setTitle( 'Favorites' ).setIcon( 'star' );
			const submenu = ( item as any ).setSubmenu();

			if ( currentFolder !== null ) {
				submenu.addItem( ( sub ) => {
					sub.setTitle( 'No folder' ).setIcon( 'home' ).onClick( async () => {
						this.store.moveToRoot( file.path );
						this.store.save();
						this.refreshView();
					} );
				} );
			}

			for ( const folder of folders ) {
				if ( folder.name === currentFolder ) continue;
				const name = folder.name;
				submenu.addItem( ( sub ) => {
					sub.setTitle( name ).setIcon( 'folder' ).onClick( async () => {
						this.store.moveToFolder( file.path, name );
						this.store.save();
						this.refreshView();
					} );
				} );
			}

			submenu.addItem( ( sub ) => {
				sub.setTitle( 'New folder...' ).setIcon( 'folder-plus' ).onClick( () => {
					new FolderNameModal( this.app, '', ( name ) => {
						this.store.moveToFolder( file.path, name );
						this.store.save();
						this.refreshView();
					} ).open();
				} );
			} );

			submenu.addSeparator();
			submenu.addItem( ( sub ) => {
				sub.setTitle( 'Remove from Favorites' ).setIcon( 'trash' ).onClick( async () => {
					await this.removeFavorite( file.path );
				} );
			} );
		} );
	}

	private async _onFileDelete( file: unknown ) {
		if ( !( file instanceof TFile ) ) return;
		if ( !this.store.isAlreadyFavorite( file.path ) ) return;
		// Symlink was already removed by Obsidian/OS — just clean the store record.
		this.store.purge( file.path );
		this.store.save();
		this.refreshView();
	}

	private async _openFavoritesPanel() {
		const { workspace } = this.app;
		if ( workspace.getLeavesOfType( VIEW_TYPE_FAVORITES ).length > 0 ) return;
		const leaf = workspace.getLeftLeaf( true );
		if ( !leaf ) return;
		await leaf.setViewState( { type: VIEW_TYPE_FAVORITES, active: false } );
	}
}

class FavoritesSettingsTab extends PluginSettingTab {
	private _plugin: FavoritesPlugin;

	constructor( app: App, plugin: FavoritesPlugin ) {
		super( app, plugin );
		this._plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting( containerEl )
			.setName( 'Deck folder' )
			.setDesc( 'Path to the shared dev-utilities folder, relative to the vault root. Favorites are stored as favorites.json inside it.' )
			.addText( text => text
				.setPlaceholder( 'dev-utilities' )
				.setValue( this._plugin.settings.deckPath )
				.onChange( async ( value ) => {
					this._plugin.settings.deckPath = value.trim() || DEFAULT_SETTINGS.deckPath;
					await this._plugin.saveSettings();
					this._plugin.store.load( this._plugin._favoritesPath() );
					this._plugin.refreshView();
				} ),
			);
	}
}
