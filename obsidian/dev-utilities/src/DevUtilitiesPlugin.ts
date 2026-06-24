import { Plugin } from 'obsidian'
import { DevUtilitiesView, VIEW_TYPE_DEV_UTILITIES } from './DevUtilitiesView'

export default class DevUtilitiesPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(
			VIEW_TYPE_DEV_UTILITIES,
			( leaf ) => new DevUtilitiesView( leaf, this ),
		)

		this.addCommand( {
			id: 'reveal-dev-utilities',
			name: 'Reveal Dev Utilities panel',
			callback: () => this._openPanel(),
		} )

		this.app.workspace.onLayoutReady( () => {
			this._openPanel()
		} )
	}

	private async _openPanel(): Promise<void> {
		const { workspace } = this.app
		if ( workspace.getLeavesOfType( VIEW_TYPE_DEV_UTILITIES ).length > 0 ) return

		// Place alongside Favorites in the same tab group if it exists
		const favLeaves = workspace.getLeavesOfType( 'favorites-view' )
		if ( favLeaves.length > 0 ) {
			const parent = ( favLeaves[ 0 ] as any ).parent
			const leaf = ( workspace as any ).createLeafInParent( parent, parent.children.length )
			await leaf.setViewState( { type: VIEW_TYPE_DEV_UTILITIES, active: false } )
			return
		}

		// Fallback: open in a new left sidebar leaf
		const leaf = workspace.getLeftLeaf( true )
		if ( !leaf ) return
		await leaf.setViewState( { type: VIEW_TYPE_DEV_UTILITIES, active: false } )
	}
}
