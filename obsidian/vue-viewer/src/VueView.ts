import type { WorkspaceLeaf } from 'obsidian'
import { TextFileView } from 'obsidian'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, StateEffect } from '@codemirror/state'
import { codeFolding, foldGutter, foldKeymap, foldable, foldEffect, ensureSyntaxTree } from '@codemirror/language'
import { vue } from '@codemirror/lang-vue'
import { oneDark } from '@codemirror/theme-one-dark'

export const VIEW_TYPE_VUE = 'vue-viewer'

/**
 * Read-only Vue SFC viewer.
 *
 * Extends TextFileView so Obsidian handles file load/unload automatically.
 * We implement setViewData / getViewData / clear; the rest is lifecycle glue.
 */
export class VueView extends TextFileView {

	private _editor: EditorView | null = null

	constructor( leaf: WorkspaceLeaf ) {
		super( leaf )
		this.contentEl.addClass( 'vue-viewer-view' )
	}

	getViewType(): string    { return VIEW_TYPE_VUE }
	getDisplayText(): string { return this.file?.basename ?? 'Vue' }
	getIcon(): string        { return 'code-2' }

	/**
	 * Called by TextFileView after it reads the file.
	 * `clear` = true when switching to a new file; false on in-place refresh.
	 */
	setViewData( data: string, clear: boolean ): void {
		if ( clear || !this._editor ) {
			this._mount( data )
		}
	}

	/** Required by TextFileView — read-only, so this is a no-op source. */
	getViewData(): string {
		return this._editor?.state.doc.toString() ?? ''
	}

	/** Called by TextFileView just before the file is unloaded. */
	clear(): void {
		this._destroy()
		this.contentEl.empty()
		this.contentEl.addClass( 'vue-viewer-view' )
	}

	async onClose(): Promise<void> {
		this._destroy()
	}

	// ── private ─────────────────────────────────────────────────────────────

	private _mount( content: string ): void {
		this._destroy()
		this.contentEl.empty()
		this.contentEl.addClass( 'vue-viewer-view' )

		const state = EditorState.create( {
			doc: content,
			extensions: [
				vue(),
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

		this._collapseTopLevel()
	}

	/** VS Code-style gutter chevron: ⌄ when open, › when collapsed. CSS handles hover-reveal. */
	private _makeFoldMarker( open: boolean ): HTMLElement {
		const marker = document.createElement( 'span' )
		marker.className = open ? 'vue-fold-marker is-open' : 'vue-fold-marker is-closed'
		marker.textContent = open ? '⌄' : '›'
		return marker
	}

	/**
	 * Open as a skeleton: fold every top-level SFC block so a review starts from the
	 * outline. ensureSyntaxTree forces the parse far enough to know each block's end.
	 */
	private _collapseTopLevel(): void {
		const view = this._editor
		if( !view ) return

		const tree = ensureSyntaxTree( view.state, view.state.doc.length, 5000 )
		if( !tree ) return

		const effects: StateEffect<unknown>[] = []
		const seenLines = new Set<number>()

		for( let node = tree.topNode.firstChild; node; node = node.nextSibling ) {
			const line = view.state.doc.lineAt( node.from )
			if( seenLines.has( line.from ) ) continue
			seenLines.add( line.from )

			const range = foldable( view.state, line.from, line.to )
			if( range ) effects.push( foldEffect.of( range ) )
		}

		if( effects.length ) view.dispatch( { effects } )
	}

	private _destroy(): void {
		this._editor?.destroy()
		this._editor = null
	}
}
