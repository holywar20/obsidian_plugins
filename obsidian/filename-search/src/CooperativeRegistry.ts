import { Notice } from 'obsidian';
import type { App } from 'obsidian';

/* Obsidian's view registry is internal and unsupported — not in the public
   typings. This is the minimal slice we drive. If a future Obsidian drops or
   renames it, `_registry()` returns null and we degrade to scope-only search
   rather than crashing the host. */
interface ViewRegistryLike {
	typeByExtension: Record<string, string>;
	registerExtensions( extensions: string[], viewType: string ): void;
	unregisterExtensions( extensions: string[] ): void;
}

/**
 * A soft, cooperative layer over Obsidian's extension → view registry.
 *
 * The two rules it enforces:
 *  - claim( ext ): make a type openable, but register ONLY if nobody owns it.
 *    A type another plugin already handles (vscode-editor, core, …) is left
 *    untouched — we never stomp it, and we never trip Obsidian's "already
 *    registered" throw.
 *  - release( ext ): only ever unregister a registration WE created. Another
 *    plugin's claim is never removed.
 *
 * Because claim() refuses to register an already-owned type, `_owned` only ever
 * holds orphans we introduced — so "deregister only if nothing else needs it"
 * falls out for free: anything owned elsewhere was never in `_owned` to begin with.
 *
 * Reusable by design: any future plugin can drive this same Thing to coexist
 * with the others instead of yolo-registering.
 */
export class CooperativeExtensionRegistry {
	private _app: App;
	private _fallbackViewType: string;
	private _owned = new Set<string>();

	constructor( app: App, fallbackViewType: string ) {
		this._app = app;
		this._fallbackViewType = fallbackViewType;
	}

	/** The viewType currently handling this extension, or null if nobody does. */
	owner( ext: string ): string | null {
		const reg = this._registry();
		if ( !reg ) return null;
		try {
			return reg.typeByExtension?.[ ext ] ?? null;
		} catch ( err ) {
			console.error( '[filename-search] registry owner() lookup failed', err );
			return null;
		}
	}

	/** True when WE introduced this extension's registration. */
	ownedByUs( ext: string ): boolean {
		return this._owned.has( ext );
	}

	/** Make ext openable in-app. No-op if anyone already owns it. */
	claim( ext: string ) {
		if ( this._owned.has( ext ) ) return;
		const reg = this._registry();
		if ( !reg ) return;
		if ( this.owner( ext ) ) return;   // already openable — leave it
		const ok = this._guard( 'register', ext, () => reg.registerExtensions( [ ext ], this._fallbackViewType ) );
		if ( ok ) this._owned.add( ext );
	}

	/** Undo only our own registration. Never touches another plugin's claim. */
	release( ext: string ) {
		if ( !this._owned.has( ext ) ) return;
		const reg = this._registry();
		if ( reg ) this._guard( 'unregister', ext, () => reg.unregisterExtensions( [ ext ] ) );
		this._owned.delete( ext );
	}

	/** onunload teardown — drop every registration we created. */
	releaseAll() {
		for ( const ext of [ ...this._owned ] ) this.release( ext );
	}

	/* Every write to the undocumented viewRegistry runs through here: if the
	   internals ever change shape and a call throws, surface it loudly (Notice +
	   console) so we know immediately, and report whether it actually landed. */
	private _guard( action: string, ext: string, fn: () => void ): boolean {
		try {
			fn();
			return true;
		} catch ( err ) {
			const msg = `[filename-search] registry ${ action } of ".${ ext }" failed — Obsidian's viewRegistry internals may have changed.`;
			console.error( msg, err );
			new Notice( msg );
			return false;
		}
	}

	private _registry(): ViewRegistryLike | null {
		const reg = ( this._app as unknown as { viewRegistry?: ViewRegistryLike } ).viewRegistry;
		if ( !reg ) return null;
		if ( typeof reg.registerExtensions !== 'function' ) return null;
		if ( typeof reg.unregisterExtensions !== 'function' ) return null;
		return reg;
	}
}
