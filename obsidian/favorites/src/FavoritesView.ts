import { ItemView, Menu, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import * as nodePath from 'path';
import { FolderNameModal } from './FolderNameModal';
import type FavoritesPlugin from './FavoritesPlugin';

export const VIEW_TYPE_FAVORITES = 'favorites-view';

export class FavoritesView extends ItemView {
	private _plugin: FavoritesPlugin;

	constructor( leaf: WorkspaceLeaf, plugin: FavoritesPlugin ) {
		super( leaf );
		this._plugin = plugin;
	}

	getViewType() { return VIEW_TYPE_FAVORITES; }
	getDisplayText() { return 'Favorites'; }
	getIcon() { return 'star'; }

	async onOpen() {
		this.contentEl.addClass( 'favorites-panel' );
		this.contentEl.addEventListener( 'contextmenu', ( e ) => {
			this._showPanelMenu( e );
		} );
		this.refresh();
	}

	async onClose() {
		this.contentEl.empty();
	}

	refresh() {
		this.contentEl.empty();
		const { root, folders } = this._plugin.store.data;
		const total = this._plugin.store.totalCount();

		if ( total === 0 ) {
			this.contentEl.createEl( 'div', {
				cls: 'favorites-empty',
				text: 'Right-click a file to add a favorite.',
			} );
			return;
		}

		const scroll = this.contentEl.createEl( 'div', { cls: 'favorites-scroll' } );
		if ( total > 10 ) scroll.addClass( 'favorites-scroll--overflow' );

		root.forEach( ( path ) => { this._renderItem( scroll, path, null, false ); } );

		for ( const folder of folders ) {
			const isCollapsed = this._plugin.store.isFolderCollapsed( folder.name );
			const folderEl = scroll.createEl( 'div', { cls: 'favorites-folder' } );
			const header = folderEl.createEl( 'div', { cls: 'favorites-folder-header' } );
			if ( isCollapsed ) header.addClass( 'is-collapsed' );
			header.createEl( 'span', { cls: 'favorites-folder-caret', text: isCollapsed ? '▸' : '▾' } );
			header.createEl( 'span', { cls: 'favorites-folder-icon', text: '📁' } );
			header.createEl( 'span', { cls: 'favorites-folder-name', text: folder.name } );
			header.addEventListener( 'click', async () => {
				this._plugin.store.setFolderCollapsed( folder.name, !isCollapsed );
				await this._plugin.store.save();
				this.refresh();
			} );
			header.addEventListener( 'contextmenu', ( e ) => {
				e.stopPropagation();
				this._showFolderMenu( e, folder.name );
			} );
			if ( !isCollapsed ) {
				// Stripe counter resets per folder so banding stays contained within each folder.
				let folderRow = 0;
				folder.items.forEach( ( path ) => { this._renderItem( folderEl, path, folder.name, folderRow++ % 2 === 1 ); } );
			}
		}
	}

	private _renderItem( parent: HTMLElement, path: string, folderName: string | null, stripe: boolean ) {
		const item = parent.createEl( 'div', { cls: 'favorites-item' } );
		if ( stripe ) item.addClass( 'favorites-row--stripe' );

		const isExternal = this._plugin.store.isExternal( path );
		const label = path.split( '/' ).pop()?.replace( /\.md$/, '' ) ?? path;
		item.createEl( 'span', { cls: 'favorites-item-icon', text: isExternal ? '🔗' : '📄' } );
		item.createEl( 'span', { cls: 'favorites-item-name', text: label } );
		item.title = isExternal
			? `${ path }\n→ ${ this._plugin.store.getExternalPath( path ) ?? '' }`
			: path;

		item.addEventListener( 'click', () => this._openFile( path ) );
		item.addEventListener( 'contextmenu', ( e ) => {
			e.stopPropagation();
			this._showItemMenu( e, path, folderName );
		} );
	}

	private _openFile( path: string ) {
		const file = this.app.vault.getAbstractFileByPath( path );
		if ( !( file instanceof TFile ) ) {
			const msg = this._plugin.store.isExternal( path )
				? 'Linked file not found — the original may have moved or been deleted.'
				: 'File not found in vault.';
			new Notice( msg );
			return;
		}
		this.app.workspace.getLeaf( false ).openFile( file );
	}

	private _showItemMenu( e: MouseEvent, path: string, folderName: string | null ) {
		const menu = new Menu();
		const { folders } = this._plugin.store.data;

		const isExternal = this._plugin.store.isExternal( path );
		const vaultBase = ( this.app.vault.adapter as any ).basePath as string;
		const systemPath = isExternal
			? ( this._plugin.store.getExternalPath( path ) ?? nodePath.join( vaultBase, path ) )
			: nodePath.join( vaultBase, path );

		menu.addItem( ( item ) => {
			item.setTitle( 'Copy path' ).setIcon( 'copy' ).onClick( async () => {
				await navigator.clipboard.writeText( systemPath );
				new Notice( `Copied: ${ systemPath }` );
			} );
		} );

		menu.addSeparator();

		menu.addItem( ( item ) => {
			item.setTitle( 'Remove from Favorites' ).setIcon( 'trash' ).onClick( async () => {
				await this._plugin.removeFavorite( path );
			} );
		} );

		const moveCandidates = folders.filter( f => f.name !== folderName );
		const hasMovements = folderName !== null || moveCandidates.length > 0;
		if ( !hasMovements ) { menu.showAtMouseEvent( e ); return; }

		menu.addSeparator();

		if ( folderName !== null ) {
			menu.addItem( ( item ) => {
				item.setTitle( 'Move to root' ).setIcon( 'arrow-up-left' ).onClick( async () => {
					this._plugin.store.moveToRoot( path );
					await this._plugin.store.save();
					this.refresh();
				} );
			} );
		}

		for ( const folder of moveCandidates ) {
			const name = folder.name;
			menu.addItem( ( item ) => {
				item.setTitle( `Move to "${ name }"` ).setIcon( 'folder' ).onClick( async () => {
					this._plugin.store.moveToFolder( path, name );
					await this._plugin.store.save();
					this.refresh();
				} );
			} );
		}

		menu.showAtMouseEvent( e );
	}

	private _showFolderMenu( e: MouseEvent, folderName: string ) {
		const menu = new Menu();

		menu.addItem( ( item ) => {
			item.setTitle( 'Copy paths' ).setIcon( 'copy' ).onClick( async () => {
				const folder = this._plugin.store.data.folders.find( f => f.name === folderName );
				if ( !folder || folder.items.length === 0 ) {
					new Notice( 'Folder is empty.' );
					return;
				}
				const paths = folder.items.join( '\n' );
				await navigator.clipboard.writeText( paths );
				new Notice( `Copied ${ folder.items.length } path${ folder.items.length === 1 ? '' : 's' }.` );
			} );
		} );

		menu.addItem( ( item ) => {
			item.setTitle( 'Rename folder' ).setIcon( 'pencil' ).onClick( () => {
				new FolderNameModal( this.app, folderName, ( newName ) => {
					if ( newName === folderName ) return;
					const ok = this._plugin.store.renameFolder( folderName, newName );
					if ( !ok ) { new Notice( `Folder "${ newName }" already exists.` ); return; }
					this._plugin.store.save();
					this.refresh();
				} ).open();
			} );
		} );

		menu.addItem( ( item ) => {
			item.setTitle( 'Remove folder' ).setIcon( 'trash' ).onClick( async () => {
				this._plugin.store.removeFolder( folderName );
				await this._plugin.store.save();
				this.refresh();
			} );
		} );

		menu.showAtMouseEvent( e );
	}

	private _showPanelMenu( e: MouseEvent ) {
		const menu = new Menu();

		menu.addItem( ( item ) => {
			item.setTitle( 'New folder' ).setIcon( 'folder-plus' ).onClick( () => {
				new FolderNameModal( this.app, '', ( name ) => {
					const ok = this._plugin.store.createFolder( name );
					if ( !ok ) { new Notice( `Folder "${ name }" already exists.` ); return; }
					this._plugin.store.save();
					this.refresh();
				} ).open();
			} );
		} );

		menu.showAtMouseEvent( e );
	}
}
