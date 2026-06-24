import { TextFileView } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';

export const RAW_TEXT_VIEW_TYPE = 'filename-search-raw';

/**
 * The orphan fallback: a dead-simple, read-only text view so an extension that
 * NOTHING else handles (a `jsx`, `scss`, `toml`…) still opens in-app once it's
 * unlocked. It is the registration target the cooperative registry hands orphans.
 *
 * Deliberately dependency-free (no CodeMirror) — it dumps the file into a <pre>.
 * Want orphans in Monaco instead? Point the registry's fallback at the
 * 'vscode-editor' view type in FilenameSearchPlugin and this view is unused.
 */
export class RawTextView extends TextFileView {
	private _pre: HTMLElement | null = null;

	constructor( leaf: WorkspaceLeaf ) {
		super( leaf );
		this.contentEl.addClass( 'filename-search-raw-view' );
	}

	getViewType(): string { return RAW_TEXT_VIEW_TYPE; }
	getDisplayText(): string { return this.file?.basename ?? 'File'; }
	getIcon(): string { return 'file-code'; }

	/** Called by TextFileView after it reads the file off disk. */
	setViewData( data: string, _clear: boolean ): void {
		this.contentEl.empty();
		this.contentEl.addClass( 'filename-search-raw-view' );
		this._pre = this.contentEl.createEl( 'pre', { cls: 'filename-search-raw', text: data } );
	}

	/** Read-only — we echo back what we hold so TextFileView never writes garbage. */
	getViewData(): string {
		return this._pre?.textContent ?? '';
	}

	clear(): void {
		this.contentEl.empty();
		this._pre = null;
	}
}
