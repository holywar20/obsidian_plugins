import { ItemView, Menu, Modal, Notice, TFile, WorkspaceLeaf, prepareFuzzySearch } from 'obsidian';
import { getFavoritesPlugin } from './FavoritesCompat';
import type FilenameSearchPlugin from './FilenameSearchPlugin';

export const VIEW_TYPE_FILENAME_SEARCH = 'filename-search-view';

/* Beyond this, the list is noise — refine the query instead of scrolling. */
const RESULT_CAP = 100;

/**
 * The sidebar panel, top to bottom: a collapsible strip of type-cards, a pinned
 * search input, and a live fuzzy-ranked result list. Scope is the set of enabled
 * cards; matching is on the file NAME only (not path, not content).
 */
export class FilenameSearchView extends ItemView {
	private _plugin: FilenameSearchPlugin;
	private _query = '';
	private _cardsEl: HTMLElement;
	private _inputEl: HTMLInputElement;
	private _resultsEl: HTMLElement;

	constructor( leaf: WorkspaceLeaf, plugin: FilenameSearchPlugin ) {
		super( leaf );
		this._plugin = plugin;
	}

	getViewType() { return VIEW_TYPE_FILENAME_SEARCH; }
	getDisplayText() { return 'Filename search'; }
	getIcon() { return 'file-search'; }

	async onOpen() {
		this.contentEl.addClass( 'filename-search-panel' );
		this._cardsEl = this.contentEl.createEl( 'div', { cls: 'filename-search-cards' } );
		this._buildInput();
		this._resultsEl = this.contentEl.createEl( 'div', { cls: 'filename-search-results' } );
		this._renderCards();
		this._render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	/** Re-run the current query — called on keystroke and when settings change. */
	refresh() {
		this._render();
	}

	/** Rebuild the type-card strip — called after custom types are added or removed. */
	refreshCards() {
		this._renderCards();
	}

	focusInput() {
		this._inputEl.focus();
		this._inputEl.select();
	}

	// ── type cards ──────────────────────────────────────────────────────────

	private _renderCards() {
		this._cardsEl.empty();
		const collapsed = this._plugin.settings.collapsed;

		const header = this._cardsEl.createEl( 'div', { cls: 'filename-search-cards-header' } );
		if ( collapsed ) header.addClass( 'is-collapsed' );
		header.createEl( 'span', { cls: 'filename-search-cards-caret', text: '▾' } );
		header.createEl( 'span', { text: 'Types' } );
		header.addEventListener( 'click', () => {
			this._plugin.settings.setCollapsed( !collapsed );
			this._plugin.settings.save();
			this._renderCards();
		} );

		if ( collapsed ) return;

		const grid = this._cardsEl.createEl( 'div', { cls: 'filename-search-cardgrid' } );
		for ( const ext of this._plugin.settings.catalog() ) this._renderChip( grid, ext );
	}

	private _renderChip( grid: HTMLElement, ext: string ) {
		const enabled = this._plugin.settings.isEnabled( ext );
		const chip = grid.createEl( 'div', { cls: 'filename-search-chip', text: ext } );

		if ( enabled ) chip.addClass( 'is-on' );
		if ( enabled && this._plugin.registry.ownedByUs( ext ) ) chip.addClass( 'is-ours' );

		// State is shown by colour, not words; the tooltip carries the detail.
		chip.title = this._ownerHint( ext, enabled );
		chip.addEventListener( 'click', () => this._toggleType( ext ) );
	}

	/** Tooltip text: enabled state plus who actually opens this type. */
	private _ownerHint( ext: string, enabled: boolean ): string {
		const owner = this._plugin.registry.owner( ext );
		if ( !enabled ) {
			return owner ? `.${ ext } — off · opens via ${ owner }` : `.${ ext } — off · no in-app viewer`;
		}
		if ( this._plugin.registry.ownedByUs( ext ) ) return `.${ ext } — in scope · unlocked here`;
		if ( owner ) return `.${ ext } — in scope · opens via ${ owner }`;
		return `.${ ext } — in scope · no in-app viewer`;
	}

	private _toggleType( ext: string ) {
		const settings = this._plugin.settings;
		if ( settings.isEnabled( ext ) ) {
			settings.disable( ext );
			this._plugin.registry.release( ext );
		} else {
			settings.enable( ext );
			this._plugin.registry.claim( ext );
		}
		settings.save();
		this._renderCards();   // chip colours follow the new state
		this._render();        // scope changed — re-run the search
	}

	// ── search input + results ──────────────────────────────────────────────

	private _buildInput() {
		const wrap = this.contentEl.createEl( 'div', { cls: 'filename-search-inputwrap' } );
		this._inputEl = wrap.createEl( 'input', { cls: 'filename-search-input', type: 'text' } );
		this._inputEl.placeholder = 'Search filenames…';

		// The input is built once and lives until the view closes, so register
		// through the Component helper — auto-removed on unload, no manual teardown.
		this.registerDomEvent( this._inputEl, 'input', () => {
			this._query = this._inputEl.value;
			this._render();
		} );
		this.registerDomEvent( this._inputEl, 'keydown', ( e ) => {
			if ( e.key === 'Enter' ) this._openFirst();
		} );
	}

	private _render() {
		this._resultsEl.empty();
		const query = this._query.trim();

		if ( query.length === 0 ) {
			this._showNotice( 'Type to search filenames.' );
			return;
		}

		const hits = this._collectHits( query );
		if ( hits.length === 0 ) {
			this._showNotice( 'No matching files.' );
			return;
		}

		const shown = hits.slice( 0, RESULT_CAP );
		for ( const file of shown ) this._renderRow( file );

		if ( hits.length > RESULT_CAP ) {
			this._resultsEl.createEl( 'div', {
				cls: 'filename-search-more',
				text: `+${ hits.length - RESULT_CAP } more — refine your search.`,
			} );
		}
	}

	/** Fuzzy-match every in-scope file by name, best score first. */
	private _collectHits( query: string ): TFile[] {
		const allowed = this._plugin.settings.enabledSet();
		const match = prepareFuzzySearch( query );
		const scored: { file: TFile; score: number }[] = [];

		for ( const file of this.app.vault.getFiles() ) {
			if ( !allowed.has( file.extension.toLowerCase() ) ) continue;
			const result = match( file.name );
			if ( !result ) continue;
			scored.push( { file, score: result.score } );
		}

		scored.sort( ( a, b ) => b.score - a.score );
		return scored.map( ( s ) => s.file );
	}

	private _renderRow( file: TFile ) {
		const row = this._resultsEl.createEl( 'div', { cls: 'filename-search-item' } );
		row.createEl( 'div', { cls: 'filename-search-item-name', text: file.name } );

		const folder = file.parent?.path ?? '';
		if ( folder.length > 0 && folder !== '/' ) {
			row.createEl( 'div', { cls: 'filename-search-item-path', text: folder } );
		}

		// Rows are torn down and rebuilt every render, so plain listeners die with
		// the node — no accumulation across keystrokes.
		row.addEventListener( 'click', () => this._openFile( file ) );
		row.addEventListener( 'contextmenu', ( e ) => {
			e.preventDefault();
			this._showRowMenu( e, file );
		} );
	}

	/** Right-click menu — copy-path is the Claude-bootstrap workhorse. */
	private _showRowMenu( e: MouseEvent, file: TFile ) {
		const menu = new Menu();

		menu.addItem( ( item ) => {
			item.setTitle( 'Copy path' ).setIcon( 'copy' ).onClick( async () => {
				await navigator.clipboard.writeText( file.path );
				new Notice( `Copied path: ${ file.path }` );
			} );
		} );
		menu.addItem( ( item ) => {
			item.setTitle( 'Copy filename' ).setIcon( 'file' ).onClick( async () => {
				await navigator.clipboard.writeText( file.name );
				new Notice( `Copied: ${ file.name }` );
			} );
		} );

		const fav = getFavoritesPlugin( this.app );
		if ( fav ) {
			menu.addSeparator();
			if ( fav.store.isAlreadyFavorite( file.path ) ) {
				menu.addItem( ( item ) => {
					item.setTitle( 'Remove from Favorites' ).setIcon( 'star-off' ).onClick( async () => {
						await fav.removeFavorite( file.path );
					} );
				} );
			} else {
				menu.addItem( ( item ) => {
					item.setTitle( 'Add to Favorites' ).setIcon( 'star' );
					const sub = ( item as any ).setSubmenu();

					sub.addItem( ( s ) => {
						s.setTitle( 'No folder' ).setIcon( 'home' ).onClick( async () => {
							fav.store.addToRoot( file.path );
							await fav.store.save();
							fav.refreshView();
						} );
					} );

					for ( const folder of fav.store.data.folders ) {
						const name = folder.name;
						sub.addItem( ( s ) => {
							s.setTitle( name ).setIcon( 'folder' ).onClick( async () => {
								fav.store.addToFolder( file.path, name );
								await fav.store.save();
								fav.refreshView();
							} );
						} );
					}

					sub.addSeparator();
					sub.addItem( ( s ) => {
						s.setTitle( 'New folder...' ).setIcon( 'folder-plus' ).onClick( () => {
							this._promptNewFolder( ( name ) => {
								fav.store.addToFolder( file.path, name );
								fav.store.save();
								fav.refreshView();
							} );
						} );
					} );
				} );
			}
		}

		menu.showAtMouseEvent( e );
	}

	/** Minimal folder-name modal. Reuses Favorites' CSS classes for visual consistency. */
	private _promptNewFolder( onSubmit: ( name: string ) => void ) {
		const modal = new Modal( this.app );
		modal.contentEl.addClass( 'favorites-modal' );
		modal.contentEl.createEl( 'h3', { text: 'New folder', cls: 'favorites-modal-title' } );

		const input = modal.contentEl.createEl( 'input', {
			cls: 'favorites-modal-input',
			attr: { type: 'text', placeholder: 'Folder name' },
		} );

		const _submit = () => {
			const name = input.value.trim();
			if ( !name ) return;
			modal.close();
			onSubmit( name );
		};

		input.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' ) _submit();
			if ( e.key === 'Escape' ) modal.close();
		} );

		const actions = modal.contentEl.createEl( 'div', { cls: 'favorites-modal-actions' } );
		actions.createEl( 'button', { text: 'OK', cls: 'mod-cta' } ).addEventListener( 'click', _submit );
		actions.createEl( 'button', { text: 'Cancel' } ).addEventListener( 'click', () => modal.close() );

		modal.open();
		input.focus();
	}

	private _openFirst() {
		const hits = this._collectHits( this._query.trim() );
		if ( hits.length === 0 ) return;
		this._openFile( hits[ 0 ] );
	}

	private _openFile( file: TFile ) {
		this.app.workspace.getLeaf( false ).openFile( file );
	}

	private _showNotice( text: string ) {
		this._resultsEl.createEl( 'div', { cls: 'filename-search-empty', text } );
	}
}
