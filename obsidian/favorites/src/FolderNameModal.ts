import { App, Modal } from 'obsidian';

export class FolderNameModal extends Modal {
	private _initial: string;
	private _onSubmit: ( name: string ) => void;

	constructor( app: App, initial: string, onSubmit: ( name: string ) => void ) {
		super( app );
		this._initial = initial;
		this._onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass( 'favorites-modal' );
		contentEl.createEl( 'h3', { text: 'Folder name', cls: 'favorites-modal-title' } );

		const input = contentEl.createEl( 'input', {
			cls: 'favorites-modal-input',
			attr: { type: 'text', placeholder: 'e.g. Work' },
		} );
		input.value = this._initial;
		input.focus();
		if ( this._initial ) input.select();

		const _submit = () => {
			const name = input.value.trim();
			if ( !name ) return;
			this.close();
			this._onSubmit( name );
		};

		input.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' ) _submit();
			if ( e.key === 'Escape' ) this.close();
		} );

		const actions = contentEl.createEl( 'div', { cls: 'favorites-modal-actions' } );
		actions.createEl( 'button', { text: 'OK', cls: 'mod-cta' } ).addEventListener( 'click', _submit );
		actions.createEl( 'button', { text: 'Cancel' } ).addEventListener( 'click', () => this.close() );
	}

	onClose() {
		this.contentEl.empty();
	}
}
