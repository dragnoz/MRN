import * as vscode from 'vscode';
import { SnippetRepository } from './snippetRepository';
import { ScoreboardTracker } from './scoreboardTracker';
import { SnippetTreeDataProvider } from './providers/snippetTreeDataProvider';
import { ScoreboardTreeDataProvider } from './providers/scoreboardTreeDataProvider';
import { LinkedFilesViewProvider } from './linker/linkedFilesViewProvider';



// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Activating Minecraft Development Toolkit extension');

    // Initialize repositories
    const snippetRepository = new SnippetRepository(context);
    const scoreboardTracker = new ScoreboardTracker(context);

    // Initialize tree view providers
    const snippetTreeProvider = new SnippetTreeDataProvider(snippetRepository);
    const scoreboardTreeProvider = new ScoreboardTreeDataProvider(scoreboardTracker);

    // Register tree view providers
    vscode.window.registerTreeDataProvider(
        'linkedFilesView',
        new LinkedFilesViewProvider(context)
      );
      
    vscode.window.createTreeView('snippetExplorer', {
        treeDataProvider: snippetTreeProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('scoreboardExplorer', {
        treeDataProvider: scoreboardTreeProvider,
        showCollapseAll: true
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('minecraftDevToolkit.refreshSnippets', () => {
            snippetTreeProvider.refresh();
            vscode.window.showInformationMessage('Snippet repository refreshed');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('minecraftDevToolkit.addSnippet', async () => {
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
            const content = await new Promise<string | undefined>(resolve => {
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
                vscode.window.showInformationMessage(
                    'Edit the snippet content and then either switch to another editor or run the "Confirm Snippet Content" command',
                    'Confirm Content'
                ).then(selected => {
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
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('minecraftDevToolkit.refreshScoreboards', async () => {
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
        })
    );

    // Run initial scoreboard scan on startup if configured
    const config = vscode.workspace.getConfiguration('minecraftDevToolkit');
    if (config.get<boolean>('scanOnStartup', true)) {
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
export function deactivate() {
    console.log('Minecraft Development Toolkit extension deactivated');
}