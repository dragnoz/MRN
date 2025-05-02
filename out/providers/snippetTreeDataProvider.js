"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnippetTreeItem = exports.SnippetTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Tree view provider for the snippets explorer
 */
class SnippetTreeDataProvider {
    constructor(snippetRepository) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.searchQuery = '';
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
            if (!name)
                return;
            // Create input box for content
            const content = await vscode.window.showInputBox({
                placeHolder: 'Enter snippet content',
                prompt: 'Content of the snippet'
            });
            if (!content)
                return;
            // Create input box for category
            const category = await vscode.window.showInputBox({
                placeHolder: 'Enter category',
                prompt: 'Category for organization'
            });
            if (!category)
                return;
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
        vscode.commands.registerCommand('minecraftDevToolkit.copySnippet', async (snippet) => {
            await vscode.env.clipboard.writeText(snippet.content);
            vscode.window.showInformationMessage(`Snippet "${snippet.name}" copied to clipboard!`);
        });
        vscode.commands.registerCommand('minecraftDevToolkit.searchSnippets', async (treeProvider) => {
            const query = await vscode.window.showInputBox({
                placeHolder: 'Search snippets',
                prompt: 'Enter search query'
            });
            if (query !== undefined) {
                this.setSearchQuery(query);
            }
        });
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    setSearchQuery(query) {
        this.searchQuery = query;
        this.refresh();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        // If search query is set, show flat list of matching snippets
        if (this.searchQuery) {
            const snippets = await this.snippetRepository.searchSnippets(this.searchQuery);
            return snippets.map(snippet => this.createSnippetTreeItem(snippet));
        }
        // Root level - show categories
        if (!element) {
            const categories = await this.snippetRepository.getCategories();
            return categories.map(category => new SnippetTreeItem(category, vscode.TreeItemCollapsibleState.Collapsed));
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
    createSnippetTreeItem(snippet) {
        const item = new SnippetTreeItem(snippet.name, vscode.TreeItemCollapsibleState.None, snippet);
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
exports.SnippetTreeDataProvider = SnippetTreeDataProvider;
class SnippetTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, snippet) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.snippet = snippet;
        this.contextValue = snippet ? 'snippet' : 'category';
        if (this.contextValue === 'category') {
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'folder.svg')),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'folder.svg'))
            };
        }
        else if (snippet) {
            const tagIcon = snippet.tags.length > 0;
            if (tagIcon) {
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'tag.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'tag.svg'))
                };
            }
            else {
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'code.svg')),
                    dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'code.svg'))
                };
            }
        }
    }
}
exports.SnippetTreeItem = SnippetTreeItem;
//# sourceMappingURL=snippetTreeDataProvider.js.map