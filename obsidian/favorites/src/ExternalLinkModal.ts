import { App, Modal, Notice } from 'obsidian';
import type { FavoritesStore } from './FavoritesStore';

export class ExternalLinkModal extends Modal {
	private _store: FavoritesStore;
	private _onSubmit: ( absolutePath: string, folderName: string | null ) => void;

	constructor(
		app: App,
		store: FavoritesStore,
		onSubmit: ( absolutePath: string, folderName: string | null ) => void,
	) {
		super( app );
		this._store = store;
		this._onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass( 'favorites-modal' );
		contentEl.createEl( 'h3', { text: 'Add external file', cls: 'favorites-modal-title' } );
		contentEl.createEl( 'p', {
			text: 'Paste the full path to the file on disk.',
			cls: 'favorites-modal-hint',
		} );

		const pathInput = contentEl.createEl( 'input', {
			cls: 'favorites-modal-input',
			attr: { type: 'text', placeholder: 'e.g. C:\\Users\\you\\notes.md' },
		} );
		pathInput.focus();

		const { folders } = this._store.data;
		let selectedFolder: string | null = null;

		if ( folders.length > 0 ) {
			contentEl.createEl( 'p', { text: 'Add to folder (optional):', cls: 'favorites-modal-hint' } );
			const select = contentEl.createEl( 'select', { cls: 'favorites-modal-select' } );
			select.createEl( 'option', { text: '— No folder —', value: '' } );
			for ( const f of folders ) {
				select.createEl( 'option', { text: f.name, value: f.name } );
			}
			select.addEventListener( 'change', () => {
				selectedFolder = select.value || null;
			} );
		}

		const _submit = () => {
			const raw = pathInput.value.trim();
			if ( !raw ) { new Notice( 'Please enter a file path.' ); return; }
			this.close();
			this._onSubmit( raw, selectedFolder );
		};

		pathInput.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' ) _submit();
			if ( e.key === 'Escape' ) this.close();
		} );

		const actions = contentEl.createEl( 'div', { cls: 'favorites-modal-actions' } );
		actions.createEl( 'button', { text: 'Add', cls: 'mod-cta' } ).addEventListener( 'click', _submit );
		actions.createEl( 'button', { text: 'Cancel' } ).addEventListener( 'click', () => this.close() );
	}

	onClose() {
		this.contentEl.empty();
	}
}
