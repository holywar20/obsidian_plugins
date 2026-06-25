import { Plugin } from 'obsidian'
import { CodeView, VIEW_TYPE_CODE } from './CodeView'
import { EXTENSIONS } from './languages'

export default class StarMindCodePlugin extends Plugin {

	async onload(): Promise<void> {
		this.registerView( VIEW_TYPE_CODE, ( leaf ) => new CodeView( leaf ) )
		this.registerExtensions( EXTENSIONS, VIEW_TYPE_CODE )
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType( VIEW_TYPE_CODE )
	}
}
