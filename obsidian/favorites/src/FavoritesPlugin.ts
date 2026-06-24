import { Menu, Notice, Plugin, TFile } from 'obsidian';
import { ExternalLinkModal } from './ExternalLinkModal';
import { ExternalLinksManager } from './ExternalLinksManager';
import { FavoritesStore } from './FavoritesStore';
import { FavoritesView, VIEW_TYPE_FAVORITES } from './FavoritesView';
import { FolderNameModal } from './FolderNameModal';

export default class FavoritesPlugin extends Plugin {
	store: FavoritesStore;
	manager: ExternalLinksManager;

	async onload() {
		this.store = new FavoritesStore( this );
		this.manager = new ExternalLinksManager( this );
		await this.store.load();

		this.registerView(
			VIEW_TYPE_FAVORITES,
			( leaf ) => new FavoritesView( leaf, this ),
		);

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
						await this.store.save();
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
		await this.store.save();
		this.refreshView();
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
					await this.store.save();
					this.refreshView();
				} );
			} );

			for ( const folder of folders ) {
				const name = folder.name;
				submenu.addItem( ( sub ) => {
					sub.setTitle( name ).setIcon( 'folder' ).onClick( async () => {
						this.store.addToFolder( file.path, name );
						await this.store.save();
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
						await this.store.save();
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
						await this.store.save();
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
		await this.store.save();
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
