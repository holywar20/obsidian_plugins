import type { WorkspaceLeaf } from 'obsidian'
import { TextFileView } from 'obsidian'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { codeFolding, foldGutter, foldKeymap } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { LANGUAGES } from './languages'

export const VIEW_TYPE_CODE = 'starmind-code'

export class CodeView extends TextFileView {

	private _editor: EditorView | null = null

	constructor( leaf: WorkspaceLeaf ) {
		super( leaf )
		this.contentEl.addClass( 'starmind-code-view' )
	}

	getViewType(): string    { return VIEW_TYPE_CODE }
	getDisplayText(): string { return this.file?.basename ?? 'Code' }
	getIcon(): string        { return 'code-2' }

	setViewData( data: string, clear: boolean ): void {
		if ( clear || !this._editor ) this._mount( data )
	}

	getViewData(): string {
		return this._editor?.state.doc.toString() ?? ''
	}

	clear(): void {
		this._destroy()
		this.contentEl.empty()
		this.contentEl.addClass( 'starmind-code-view' )
	}

	async onClose(): Promise<void> {
		this._destroy()
	}

	// ── private ─────────────────────────────────────────────────────────────

	private _mount( content: string ): void {
		this._destroy()
		this.contentEl.empty()
		this.contentEl.addClass( 'starmind-code-view' )

		const ext     = this.file?.extension ?? ''
		const langFn  = LANGUAGES[ ext ]
		const langExt = langFn ? [ langFn() ] : []

		const state = EditorState.create( {
			doc: content,
			extensions: [
				...langExt,
				oneDark,
				lineNumbers(),
				codeFolding( { placeholderText: '⋯' } ),
				foldGutter( { markerDOM: this._makeFoldMarker } ),
				keymap.of( foldKeymap ),
				EditorView.editable.of( false ),
			],
		} )

		this._editor = new EditorView( {
			state,
			parent: this.contentEl,
		} )
	}

	private _makeFoldMarker( open: boolean ): HTMLElement {
		const marker = document.createElement( 'span' )
		marker.className = open ? 'sc-fold-marker is-open' : 'sc-fold-marker is-closed'
		marker.textContent = open ? '⌄' : '›'
		return marker
	}

	private _destroy(): void {
		this._editor?.destroy()
		this._editor = null
	}
}
