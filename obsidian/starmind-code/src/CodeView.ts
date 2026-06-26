import type { WorkspaceLeaf } from 'obsidian'
import { TextFileView } from 'obsidian'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { codeFolding, foldGutter, foldKeymap, indentUnit } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { resolveSupport } from './languages'
import type StarMindCodePlugin from './StarMindCodePlugin'

export const VIEW_TYPE_CODE = 'starmind-code'

export class CodeView extends TextFileView {

	private _editor: EditorView | null = null
	private _plugin: StarMindCodePlugin

	// Holds the settings-driven extensions (indent, editability) so they can be
	// swapped live without rebuilding the whole editor.
	private _cfg = new Compartment()

	constructor( leaf: WorkspaceLeaf, plugin: StarMindCodePlugin ) {
		super( leaf )
		this._plugin = plugin
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

	// Re-apply the current indent/editability settings to a live editor.
	applySettings(): void {
		this._editor?.dispatch( {
			effects: this._cfg.reconfigure( this._settingsExtensions() ),
		} )
	}

	// ── private ─────────────────────────────────────────────────────────────

	private _mount( content: string ): void {
		this._destroy()
		this.contentEl.empty()
		this.contentEl.addClass( 'starmind-code-view' )

		const ext     = this.file?.extension ?? ''
		const support = resolveSupport( ext )
		const langExt = support ? [ support ] : []

		const state = EditorState.create( {
			doc: content,
			extensions: [
				...langExt,
				oneDark,
				lineNumbers(),
				codeFolding( { placeholderText: '⋯' } ),
				foldGutter( { markerDOM: this._makeFoldMarker } ),
				history(),
				keymap.of( [ indentWithTab, ...foldKeymap, ...defaultKeymap, ...historyKeymap ] ),
				this._cfg.of( this._settingsExtensions() ),
				EditorView.updateListener.of( ( u ) => { if ( u.docChanged ) this.requestSave() } ),
			],
		} )

		this._editor = new EditorView( {
			state,
			parent: this.contentEl,
		} )
	}

	// Indent + editability, derived from plugin settings. Lives in a compartment
	// so a settings change can reconfigure an open editor in place.
	private _settingsExtensions(): Extension {
		const s    = this._plugin.settings
		const unit = s.indentType === 'tabs' ? '\t' : ' '.repeat( s.tabSize )
		return [
			EditorState.tabSize.of( s.tabSize ),
			indentUnit.of( unit ),
			EditorState.readOnly.of( !s.editable ),
			EditorView.editable.of( s.editable ),
		]
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
