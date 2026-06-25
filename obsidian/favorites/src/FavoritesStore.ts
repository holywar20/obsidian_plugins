import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export interface FolderEntry {
	name: string;
	items: string[];
	collapsed?: boolean;
}

export interface StoreData {
	root: string[];
	folders: FolderEntry[];
	/** Maps vault-relative symlink path (_linked/foo.md) → absolute real path on disk. */
	externals: Record<string, string>;
}

export class FavoritesStore {
	private _data: StoreData = { root: [], folders: [], externals: {} };
	private _filePath: string = '';

	load( filePath: string ) {
		this._filePath = filePath;
		if ( !existsSync( filePath ) ) return;
		try {
			const raw = JSON.parse( readFileSync( filePath, 'utf8' ) ) as StoreData;
			this._data = raw;
			if ( !this._data.externals ) this._data.externals = {};
		} catch { /* corrupt file — start fresh */ }
	}

	save() {
		if ( !this._filePath ) return;
		mkdirSync( dirname( this._filePath ), { recursive: true } );
		writeFileSync( this._filePath, JSON.stringify( this._data, null, 2 ) + '\n' );
	}

	get data() { return this._data; }

	totalCount(): number {
		const folderTotal = this._data.folders.reduce( ( n, f ) => n + f.items.length, 0 );
		return this._data.root.length + folderTotal;
	}

	isFolderCollapsed( name: string ): boolean {
		return this._data.folders.find( f => f.name === name )?.collapsed ?? false;
	}

	setFolderCollapsed( name: string, collapsed: boolean ) {
		const folder = this._data.folders.find( f => f.name === name );
		if ( folder ) folder.collapsed = collapsed;
	}

	/** Returns the folder name containing this path, or null if at root. */
	getFolder( path: string ): string | null {
		for ( const folder of this._data.folders ) {
			if ( folder.items.includes( path ) ) return folder.name;
		}
		return null;
	}

	isAlreadyFavorite( path: string ): boolean {
		if ( this._data.root.includes( path ) ) return true;
		return this._data.folders.some( f => f.items.includes( path ) );
	}

	isExternal( path: string ): boolean {
		return path in this._data.externals;
	}

	getExternalPath( vaultPath: string ): string | undefined {
		return this._data.externals[ vaultPath ];
	}

	addToRoot( path: string ) {
		if ( this.isAlreadyFavorite( path ) ) return;
		this._data.root.push( path );
	}

	/** Auto-creates the folder if it doesn't exist, then adds the file. */
	addToFolder( path: string, folderName: string ) {
		if ( this.isAlreadyFavorite( path ) ) return;
		let folder = this._data.folders.find( f => f.name === folderName );
		if ( !folder ) {
			folder = { name: folderName, items: [] };
			this._data.folders.push( folder );
		}
		folder.items.push( path );
	}

	/**
	 * Register vaultPath as a symlink-backed external file pointing to realPath.
	 * Call after the symlink is created on disk.
	 */
	addExternal( vaultPath: string, realPath: string ) {
		this._data.externals[ vaultPath ] = realPath;
	}

	/** Unregister the external mapping. Does not touch the symlink on disk — caller handles that. */
	removeExternal( vaultPath: string ) {
		delete this._data.externals[ vaultPath ];
	}

	/** Returns false if a folder with that name already exists. */
	createFolder( name: string ): boolean {
		if ( this._data.folders.find( f => f.name === name ) ) return false;
		this._data.folders.push( { name, items: [] } );
		return true;
	}

	/** Moves all folder items to root, then removes the folder entry. */
	removeFolder( name: string ) {
		const folder = this._data.folders.find( f => f.name === name );
		if ( !folder ) return;
		for ( const path of folder.items ) {
			if ( !this._data.root.includes( path ) ) this._data.root.push( path );
		}
		this._data.folders = this._data.folders.filter( f => f.name !== name );
	}

	/** Returns false if newName already exists. */
	renameFolder( oldName: string, newName: string ): boolean {
		if ( this._data.folders.find( f => f.name === newName ) ) return false;
		const folder = this._data.folders.find( f => f.name === oldName );
		if ( !folder ) return false;
		folder.name = newName;
		return true;
	}

	remove( path: string ) {
		this._data.root = this._data.root.filter( p => p !== path );
		for ( const folder of this._data.folders ) {
			folder.items = folder.items.filter( p => p !== path );
		}
	}

	moveToRoot( path: string ) {
		this.remove( path );
		this._data.root.push( path );
	}

	moveToFolder( path: string, folderName: string ) {
		const folder = this._data.folders.find( f => f.name === folderName );
		if ( !folder ) return;
		this.remove( path );
		folder.items.push( path );
	}

	/** Remove all references to a file, including its external mapping if any. */
	purge( path: string ) {
		this.remove( path );
		this.removeExternal( path );
	}
}
