import * as vscode from 'vscode';
import * as path from 'path';
import { SnippetRepository } from '../snippetRepository';
import { Snippet } from '../models/snippet';

/**
 * Tree view provider for the snippets explorer
 */
export class SnippetTreeDataProvider implements vscode.TreeDataProvider<SnippetTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SnippetTreeItem | undefined | null> = new vscode.EventEmitter<SnippetTreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<SnippetTreeItem | undefined | null> = this._onDidChangeTreeData.event;

    private snippetRepository: SnippetRepository;
    private searchQuery: string = '';

    constructor(snippetRepository: SnippetRepository) {
        this.snippetRepository = snippetRepository;

        // Register commands
        vscode.commands.registerCommand('minecraftDevToolkit.refreshSnippets', () => {
            this.refresh();
        });

        vscode.commands.registerCommand('minecraftDevToolkit.addSnippet', async () => {
            // Create input box for snippet name
            const name = await vscode.window.showInputBox({
                placeHolder: 'Enter snippet name',
                prompt: 'Name for the new snippet'
            });
            if (!name) return;

            // Create input box for content
            const content = await vscode.window.showInputBox({
                placeHolder: 'Enter snippet content',
                prompt: 'Content of the snippet'
            });
            if (!content) return;

            // Create input box for category
            const category = await vscode.window.showInputBox({
                placeHolder: 'Enter category',
                prompt: 'Category for organization'
            });
            if (!category) return;

            // Create input box for tags
            const tagsInput = await vscode.window.showInputBox({
                placeHolder: 'tag1, tag2, tag3',
                prompt: 'Tags (comma separated)'
            });
            const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

            // Add the snippet
            await this.snippetRepository.addSnippet({
                id: Date.now().toString(),
                name,
                content,
                category,
                tags
            });

            this.refresh();
            vscode.window.showInformationMessage(`Snippet "${name}" added!`);
        });

        vscode.commands.registerCommand('minecraftDevToolkit.copySnippet', async (snippet: Snippet) => {
            await vscode.env.clipboard.writeText(snippet.content);
            vscode.window.showInformationMessage(`Snippet "${snippet.name}" copied to clipboard!`);
        });

        vscode.commands.registerCommand('minecraftDevToolkit.searchSnippets', async (treeProvider: SnippetTreeDataProvider) => {
            const query = await vscode.window.showInputBox({
                placeHolder: 'Search snippets',
                prompt: 'Enter search query'
            });
            
            if (query !== undefined) {
                this.setSearchQuery(query);
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    setSearchQuery(query: string): void {
        this.searchQuery = query;
        this.refresh();
    }

    getTreeItem(element: SnippetTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SnippetTreeItem): Promise<SnippetTreeItem[]> {
        // If search query is set, show flat list of matching snippets
        if (this.searchQuery) {
            const snippets = await this.snippetRepository.searchSnippets(this.searchQuery);
            return snippets.map(snippet => this.createSnippetTreeItem(snippet));
        }

        // Root level - show categories
        if (!element) {
            const categories = await this.snippetRepository.getCategories();
            return categories.map(category => new SnippetTreeItem(
                category,
                vscode.TreeItemCollapsibleState.Collapsed
            ));
        }
        
        // Category level - show snippets in this category
        if (element.contextValue === 'category') {
            const snippets = await this.snippetRepository.getSnippets();
            return snippets
                .filter(snippet => snippet.category === element.label)
                .map(snippet => this.createSnippetTreeItem(snippet));
        }

        return [];
    }

    private createSnippetTreeItem(snippet: Snippet): SnippetTreeItem {
        const item = new SnippetTreeItem(
            snippet.name,
            vscode.TreeItemCollapsibleState.None,
            snippet
        );
        
        item.contextValue = 'snippet';
        item.tooltip = snippet.tags.length > 0 
            ? `Tags: ${snippet.tags.join(', ')}`
            : undefined;
            
        item.command = {
            command: 'minecraftDevToolkit.copySnippet',
            title: 'Copy Snippet',
            arguments: [snippet]
        };
        
        item.iconPath = {
            light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'code.svg')),
            dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'code.svg'))
        };
        
        return item;
    }
}

export class SnippetTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly snippet?: Snippet
    ) {
        super(label, collapsibleState);
        
        this.contextValue = snippet ? 'snippet' : 'category';
        
        if (this.contextValue === 'category') {
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'folder.svg')),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'folder.svg'))
            };
        } else if (snippet) {
            const tagIcon = snippet.tags.length > 0;
            
            if (tagIcon) {
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'tag.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'tag.svg'))
                };
            } else {
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'code.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'code.svg'))
                };
            }
        }
    }
}