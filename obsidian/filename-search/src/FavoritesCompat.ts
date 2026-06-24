import type { App } from 'obsidian';

interface FavoritesStore {
	data: { folders: Array<{ name: string }> };
	isAlreadyFavorite( path: string ): boolean;
	addToRoot( path: string ): void;
	addToFolder( path: string, folderName: string ): void;
	save(): Promise<void>;
}

export interface FavoritesPluginAPI {
	store: FavoritesStore;
	removeFavorite( path: string ): Promise<void>;
	refreshView(): void;
}

export function getFavoritesPlugin( app: App ): FavoritesPluginAPI | null {
	return ( app as any ).plugins?.getPlugin?.( 'obsidian-favorites' ) ?? null;
}
