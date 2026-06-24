import { Plugin } from 'obsidian'
import { VueView, VIEW_TYPE_VUE } from './VueView'

export default class VueViewerPlugin extends Plugin {

	async onload(): Promise<void> {
		this.registerView( VIEW_TYPE_VUE, ( leaf ) => new VueView( leaf ) )
		this.registerExtensions( [ 'vue' ], VIEW_TYPE_VUE )
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType( VIEW_TYPE_VUE )
	}
}
