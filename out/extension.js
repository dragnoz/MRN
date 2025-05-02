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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const snippetRepository_1 = require("./snippetRepository");
const scoreboardTracker_1 = require("./scoreboardTracker");
const snippetTreeDataProvider_1 = require("./providers/snippetTreeDataProvider");
const scoreboardTreeDataProvider_1 = require("./providers/scoreboardTreeDataProvider");
const linkedFilesViewProvider_1 = require("./linker/linkedFilesViewProvider");
// This method is called when your extension is activated
function activate(context) {
    console.log('Activating Minecraft Development Toolkit extension');
    // Initialize repositories
    const snippetRepository = new snippetRepository_1.SnippetRepository(context);
    const scoreboardTracker = new scoreboardTracker_1.ScoreboardTracker(context);
    // Initialize tree view providers
    const snippetTreeProvider = new snippetTreeDataProvider_1.SnippetTreeDataProvider(snippetRepository);
    const scoreboardTreeProvider = new scoreboardTreeDataProvider_1.ScoreboardTreeDataProvider(scoreboardTracker);
    // Register tree view providers
    vscode.window.registerTreeDataProvider('linkedFilesView', new linkedFilesViewProvider_1.LinkedFilesViewProvider(context));
    vscode.window.createTreeView('snippetExplorer', {
        treeDataProvider: snippetTreeProvider,
        showCollapseAll: true
    });
    vscode.window.createTreeView('scoreboardExplorer', {
        treeDataProvider: scoreboardTreeProvider,
        showCollapseAll: true
    });
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('minecraftDevToolkit.refreshSnippets', () => {
        snippetTreeProvider.refresh();
        vscode.window.showInformationMessage('Snippet repository refreshed');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('minecraftDevToolkit.addSnippet', async () => {
        // Create a new snippet using input boxes
        const name = await vscode.window.showInputBox({
            placeHolder: 'Enter a name for the snippet',
            prompt: 'Snippet Name'
        });
        if (!name) {
            return; // User cancelled
        }
        // For multiple lines, we use a different approach since multiline is not 
        // directly supported in showInputBox
        const document = await vscode.workspace.openTextDocument({
            content: '',
            language: 'plaintext'
        });
        const editor = await vscode.window.showTextDocument(document);
        await editor.edit(edit => edit.insert(new vscode.Position(0, 0), '// Enter your snippet here'));
        // Let the user edit the document
        const content = await new Promise(resolve => {
            const disposable = vscode.window.onDidChangeActiveTextEditor(e => {
                if (e && e.document !== document) {
                    disposable.dispose();
                    resolve(document.getText());
                }
            });
            // Also provide a way to confirm via command
            vscode.commands.registerCommand('minecraftDevToolkit.confirmSnippetContent', () => {
                disposable.dispose();
                resolve(document.getText());
            });
            // Show info message with instructions
            vscode.window.showInformationMessage('Edit the snippet content and then either switch to another editor or run the "Confirm Snippet Content" command', 'Confirm Content').then(selected => {
                if (selected === 'Confirm Content') {
                    disposable.dispose();
                    resolve(document.getText());
                }
            });
        });
        if (!content) {
            return; // User cancelled
        }
        const tagsInput = await vscode.window.showInputBox({
            placeHolder: 'Enter tags separated by commas (e.g., command, function, redstone)',
            prompt: 'Snippet Tags'
        });
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        const categories = await snippetRepository.getCategories();
        let category = await vscode.window.showQuickPick([
            ...categories,
            '+ Create new category'
        ], {
            placeHolder: 'Select or create a category'
        });
        if (!category) {
            return; // User cancelled
        }
        if (category === '+ Create new category') {
            category = await vscode.window.showInputBox({
                placeHolder: 'Enter a new category name',
                prompt: 'New Category'
            });
            if (!category) {
                return; // User cancelled
            }
        }
        // Create the snippet
        await snippetRepository.addSnippet({
            id: Date.now().toString(),
            name,
            content,
            tags,
            category
        });
        snippetTreeProvider.refresh();
        vscode.window.showInformationMessage(`Snippet "${name}" added to repository`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('minecraftDevToolkit.refreshScoreboards', async () => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning for scoreboard objectives',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Scanning workspace...' });
            await scoreboardTracker.scanWorkspace();
            scoreboardTreeProvider.refresh();
            vscode.window.showInformationMessage('Scoreboard objectives refreshed');
        });
    }));
    // Run initial scoreboard scan on startup if configured
    const config = vscode.workspace.getConfiguration('minecraftDevToolkit');
    if (config.get('scanOnStartup', true)) {
        vscode.commands.executeCommand('minecraftDevToolkit.refreshScoreboards');
    }
    // Register file system watchers for .mcfunction files
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.mcfunction');
    watcher.onDidChange(async (uri) => {
        await scoreboardTracker.scanFile(uri);
        scoreboardTreeProvider.refresh();
    });
    watcher.onDidCreate(async (uri) => {
        await scoreboardTracker.scanFile(uri);
        scoreboardTreeProvider.refresh();
    });
    watcher.onDidDelete(() => {
        // On file deletion, rescan entire workspace to ensure accurate results
        vscode.commands.executeCommand('minecraftDevToolkit.refreshScoreboards');
    });
    context.subscriptions.push(watcher);
}
// This method is called when your extension is deactivated
function deactivate() {
    console.log('Minecraft Development Toolkit extension deactivated');
}
//# sourceMappingURL=extension.js.map