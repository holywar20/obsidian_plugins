import { Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import type FavoritesPlugin from './FavoritesPlugin';

const LINKED_FOLDER = '_linked';

export class ExternalLinksManager {
	private _plugin: FavoritesPlugin;

	constructor( plugin: FavoritesPlugin ) {
		this._plugin = plugin;
	}

	private _vaultBase(): string {
		return ( this._plugin.app.vault.adapter as any ).basePath as string;
	}

	private _linkedDir(): string {
		return path.join( this._vaultBase(), LINKED_FOLDER );
	}

	private _ensureLinkedDir() {
		const dir = this._linkedDir();
		if ( !fs.existsSync( dir ) ) fs.mkdirSync( dir );
	}

	private _linkExists( absLinkPath: string ): boolean {
		try { fs.lstatSync( absLinkPath ); return true; } catch { return false; }
	}

	/**
	 * Create a symlink inside _linked/ pointing to absolutePath.
	 * Returns the vault-relative path of the new link.
	 * Handles filename collisions by appending -2, -3, etc.
	 * Throws if the target file does not exist.
	 */
	createLink( absolutePath: string ): string {
		if ( !fs.existsSync( absolutePath ) ) {
			throw new Error( `File not found: ${ absolutePath }` );
		}
		this._ensureLinkedDir();

		const ext = path.extname( absolutePath );
		const base = path.basename( absolutePath, ext );
		const dir = this._linkedDir();

		let filename = path.basename( absolutePath );
		let counter = 2;
		while ( this._linkExists( path.join( dir, filename ) ) ) {
			filename = `${ base }-${ counter }${ ext }`;
			counter++;
		}

		fs.symlinkSync( absolutePath, path.join( dir, filename ) );
		return `${ LINKED_FOLDER }/${ filename }`;
	}

	/**
	 * Remove a symlink. Uses lstatSync (not existsSync) so it finds
	 * broken symlinks whose targets are already gone.
	 */
	removeLink( vaultPath: string ) {
		const absLinkPath = path.join( this._vaultBase(), vaultPath );
		try {
			if ( this._linkExists( absLinkPath ) ) fs.unlinkSync( absLinkPath );
		} catch ( e ) {
			console.error( '[Favorites] Failed to remove symlink', absLinkPath, e );
		}
	}

	/**
	 * On startup: for each tracked external, ensure the symlink exists on disk.
	 * Recreates missing links whose real targets are still alive.
	 * Fires a Notice (but does not auto-purge) for entries whose real file is gone.
	 */
	reconcile() {
		const externals = this._plugin.store.data.externals;
		let deadCount = 0;

		for ( const [ vaultPath, realPath ] of Object.entries( externals ) ) {
			if ( !fs.existsSync( realPath ) ) {
				deadCount++;
				continue;
			}
			const absLinkPath = path.join( this._vaultBase(), vaultPath );
			if ( !this._linkExists( absLinkPath ) ) {
				try {
					this._ensureLinkedDir();
					fs.symlinkSync( realPath, absLinkPath );
				} catch ( e ) {
					console.error( '[Favorites] Failed to recreate symlink for', vaultPath, e );
				}
			}
		}

		if ( deadCount > 0 ) {
			new Notice(
				`Favorites: ${ deadCount } linked file${ deadCount > 1 ? 's' : '' } can no longer be found at their original location. Check your Favorites to clean them up.`,
				8000,
			);
		}
	}
}
