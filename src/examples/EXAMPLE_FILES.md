# Example Code Files

This directory contains example code snippets for understanding the Minecraft Resource Toolkit extension. These are simplified versions of the actual implementation files.

## Core Components

### Snippet Repository

```typescript
// Example implementation of SnippetRepository
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Snippet } from './models/snippet';

export class SnippetRepository {
    private context: vscode.ExtensionContext;
    private snippetsFile: string | undefined;
    private snippets: Snippet[] = [];
    private initialized: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Get workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open. Snippet repository needs a workspace.");
            return;
        }

        // Set up snippets file path
        const config = vscode.workspace.getConfiguration('minecraftDevToolkit');
        const snippetsPath = config.get<string>('snippetsPath') || '';
        const basePath = snippetsPath || workspaceFolder;
        
        // Ensure directory exists
        await this.ensureDirectoryExists(basePath);
        this.snippetsFile = path.join(basePath, 'mc-snippets.json');
        
        // Load snippets
        await this.loadSnippets();
        this.initialized = true;
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
        } catch (error) {
            console.error("Error creating directory:", error);
        }
    }

    private async loadSnippets(): Promise<void> {
        if (!this.snippetsFile) return;

        try {
            if (fs.existsSync(this.snippetsFile)) {
                const data = await fs.promises.readFile(this.snippetsFile, 'utf8');
                this.snippets = JSON.parse(data);
            } else {
                // Initialize with empty array if file doesn't exist
                this.snippets = [];
                await this.saveSnippets();
            }
        } catch (error) {
            console.error("Error loading snippets:", error);
            this.snippets = [];
        }
    }

    private async saveSnippets(): Promise<void> {
        if (!this.snippetsFile) return;

        try {
            await fs.promises.writeFile(
                this.snippetsFile,
                JSON.stringify(this.snippets, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error("Error saving snippets:", error);
        }
    }

    public async getSnippets(): Promise<Snippet[]> {
        if (!this.initialized) await this.initialize();
        return this.snippets;
    }

    public async addSnippet(snippet: Snippet): Promise<void> {
        if (!this.initialized) await this.initialize();
        
        // Generate a unique ID if not provided
        if (!snippet.id) {
            snippet.id = Date.now().toString();
        }
        
        this.snippets.push(snippet);
        await this.saveSnippets();
    }

    public async updateSnippet(updatedSnippet: Snippet): Promise<void> {
        if (!this.initialized) await this.initialize();
        
        const index = this.snippets.findIndex(s => s.id === updatedSnippet.id);
        if (index !== -1) {
            this.snippets[index] = updatedSnippet;
            await this.saveSnippets();
        }
    }

    public async deleteSnippet(id: string): Promise<void> {
        if (!this.initialized) await this.initialize();
        
        this.snippets = this.snippets.filter(s => s.id !== id);
        await this.saveSnippets();
    }

    public async searchSnippets(query: string): Promise<Snippet[]> {
        if (!this.initialized) await this.initialize();
        
        const lowerQuery = query.toLowerCase();
        return this.snippets.filter(snippet => 
            snippet.name.toLowerCase().includes(lowerQuery) || 
            snippet.content.toLowerCase().includes(lowerQuery) ||
            snippet.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    public async getCategories(): Promise<string[]> {
        if (!this.initialized) await this.initialize();
        
        const categories = new Set<string>();
        this.snippets.forEach(snippet => {
            categories.add(snippet.category);
        });
        
        return Array.from(categories);
    }

    public async getTags(): Promise<string[]> {
        if (!this.initialized) await this.initialize();
        
        const tags = new Set<string>();
        this.snippets.forEach(snippet => {
            snippet.tags.forEach(tag => tags.add(tag));
        });
        
        return Array.from(tags);
    }
}
```

### Scoreboard Tracker

```typescript
// Example implementation of ScoreboardTracker
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Scoreboard, ScoreboardLocation } from './models/scoreboard';
import { getWorkspaceFolder, getFilesWithExtension, readFileContent } from './utils/fileSystem';
import { parseScoreboardObjectives } from './utils/parser';

export class ScoreboardTracker {
    private context: vscode.ExtensionContext;
    private scoreboardsFile: string | undefined;
    private scoreboards: Map<string, Scoreboard> = new Map();
    private initialized: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initialize();
        
        // Register file system watcher to track changes
        const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.mcfunction');
        
        fileWatcher.onDidChange(async uri => {
            await this.scanFile(uri);
        });
        
        fileWatcher.onDidCreate(async uri => {
            await this.scanFile(uri);
        });
        
        context.subscriptions.push(fileWatcher);
    }

    private async initialize(): Promise<void> {
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open. Scoreboard tracker needs a workspace.");
            return;
        }

        this.scoreboardsFile = path.join(workspaceFolder, '.mc-scoreboards.json');
        await this.loadScoreboards();
        this.initialized = true;
    }

    private async loadScoreboards(): Promise<void> {
        if (!this.scoreboardsFile) return;

        try {
            if (fs.existsSync(this.scoreboardsFile)) {
                const data = await fs.promises.readFile(this.scoreboardsFile, 'utf8');
                const scoreboardsArray = JSON.parse(data) as Scoreboard[];
                
                this.scoreboards.clear();
                scoreboardsArray.forEach(scoreboard => {
                    this.scoreboards.set(scoreboard.name, scoreboard);
                });
            }
        } catch (error) {
            console.error("Error loading scoreboards:", error);
            this.scoreboards.clear();
        }
    }

    private async saveScoreboards(): Promise<void> {
        if (!this.scoreboardsFile) return;

        try {
            const scoreboardsArray = Array.from(this.scoreboards.values());
            await fs.promises.writeFile(
                this.scoreboardsFile,
                JSON.stringify(scoreboardsArray, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error("Error saving scoreboards:", error);
        }
    }

    public async getScoreboards(): Promise<Scoreboard[]> {
        if (!this.initialized) await this.initialize();
        return Array.from(this.scoreboards.values());
    }

    public async scanWorkspace(): Promise<void> {
        if (!this.initialized) await this.initialize();
        
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) return;

        // Clear existing scoreboards
        this.scoreboards.clear();

        // Find all .mcfunction files
        const files = await getFilesWithExtension(workspaceFolder, '.mcfunction');
        
        // Process each file
        for (const file of files) {
            try {
                const content = await readFileContent(file);
                const scoreboardsInFile = parseScoreboardObjectives(content, file);
                
                // Merge into main scoreboard map
                scoreboardsInFile.forEach(scoreboard => {
                    if (this.scoreboards.has(scoreboard.name)) {
                        // If scoreboard already exists, update it
                        const existing = this.scoreboards.get(scoreboard.name)!;
                        
                        // Merge locations
                        scoreboard.locations.forEach(location => {
                            existing.locations.push(location);
                        });
                        
                        // Update usage count
                        existing.usageCount += scoreboard.usageCount;
                        
                        // Update type if it wasn't set before
                        if (!existing.type && scoreboard.type) {
                            existing.type = scoreboard.type;
                        }
                    } else {
                        // New scoreboard
                        this.scoreboards.set(scoreboard.name, scoreboard);
                    }
                });
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        }

        await this.saveScoreboards();
    }

    public async scanFile(uri: vscode.Uri): Promise<void> {
        if (!this.initialized) await this.initialize();
        
        try {
            const filePath = uri.fsPath;
            const content = await readFileContent(filePath);
            
            // Parse scoreboards in this file
            const scoreboardsInFile = parseScoreboardObjectives(content, filePath);
            
            // Remove all locations from this file
            this.scoreboards.forEach(scoreboard => {
                scoreboard.locations = scoreboard.locations.filter(loc => loc.file !== filePath);
            });
            
            // Add new locations from this file
            scoreboardsInFile.forEach(scoreboard => {
                if (this.scoreboards.has(scoreboard.name)) {
                    const existing = this.scoreboards.get(scoreboard.name)!;
                    
                    // Add locations
                    scoreboard.locations.forEach(location => {
                        existing.locations.push(location);
                    });
                    
                    // Update type if needed
                    if (!existing.type && scoreboard.type) {
                        existing.type = scoreboard.type;
                    }
                } else {
                    this.scoreboards.set(scoreboard.name, scoreboard);
                }
            });
            
            // Recalculate usage counts
            this.scoreboards.forEach(scoreboard => {
                scoreboard.usageCount = scoreboard.locations.length;
            });
            
            // Remove scoreboards with no locations
            for (const [name, scoreboard] of this.scoreboards.entries()) {
                if (scoreboard.locations.length === 0) {
                    this.scoreboards.delete(name);
                }
            }
            
            await this.saveScoreboards();
        } catch (error) {
            console.error(`Error scanning file ${uri.fsPath}:`, error);
        }
    }

    public async rescanlWorkspace(): Promise<void> {
        await this.scanWorkspace();
    }

    public async openScoreboardLocation(location: ScoreboardLocation): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(location.file);
            const editor = await vscode.window.showTextDocument(document);
            
            // Position is 0-based, but line numbers in our model are 1-based
            const position = new vscode.Position(location.line - 1, 0);
            
            // Reveal the position
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
            
            // Move cursor to the position
            editor.selection = new vscode.Selection(position, position);
        } catch (error) {
            console.error(`Error opening location:`, error);
            vscode.window.showErrorMessage(`Could not open file: ${location.file}`);
        }
    }
}
```

## Models

### Snippet Model

```typescript
/**
 * Represents a code snippet in the repository
 */
export interface Snippet {
    id: string;
    name: string;
    content: string;
    tags: string[];
    category: string;
}
```

### Scoreboard Model

```typescript
/**
 * Represents a location where a scoreboard objective is used
 */
export interface ScoreboardLocation {
    file: string;
    line: number;
    context?: string;
}

/**
 * Represents a scoreboard objective
 */
export interface Scoreboard {
    name: string;
    type?: string;
    usageCount: number;
    locations: ScoreboardLocation[];
}
```

## Tree Data Providers

### Snippet Tree Data Provider

```typescript
import * as vscode from 'vscode';
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
        
        item.iconPath = new vscode.ThemeIcon('code');
        
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
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
```

### Scoreboard Tree Data Provider

```typescript
import * as vscode from 'vscode';
import { ScoreboardTracker } from '../scoreboardTracker';
import { Scoreboard, ScoreboardLocation } from '../models/scoreboard';

/**
 * Tree view provider for the scoreboards explorer
 */
export class ScoreboardTreeDataProvider implements vscode.TreeDataProvider<ScoreboardTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ScoreboardTreeItem | undefined | null> = new vscode.EventEmitter<ScoreboardTreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<ScoreboardTreeItem | undefined | null> = this._onDidChangeTreeData.event;

    private scoreboardTracker: ScoreboardTracker;

    constructor(scoreboardTracker: ScoreboardTracker) {
        this.scoreboardTracker = scoreboardTracker;

        // Register open location command
        vscode.commands.registerCommand('minecraftDevToolkit.openScoreboardLocation', async (location: ScoreboardLocation) => {
            await this.scoreboardTracker.openScoreboardLocation(location);
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ScoreboardTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ScoreboardTreeItem): Promise<ScoreboardTreeItem[]> {
        // Root level - show scoreboard objectives
        if (!element) {
            const scoreboards = await this.scoreboardTracker.getScoreboards();
            
            // Sort by name
            scoreboards.sort((a, b) => a.name.localeCompare(b.name));
            
            return scoreboards.map(scoreboard => new ScoreboardTreeItem(
                `${scoreboard.name} (${scoreboard.usageCount})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                scoreboard
            ));
        }
        
        // Scoreboard level - show locations
        if (element.scoreboard) {
            return element.scoreboard.locations.map(location => {
                // Extract file name from path
                const fileName = location.file.split(/[\\/]/).pop() || location.file;
                
                // Create label with location information
                const label = `${fileName}:${location.line}`;
                
                // Create the tree item
                const item = new ScoreboardTreeItem(
                    label,
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    location
                );
                
                // Set tooltip to show the context if available
                if (location.context) {
                    item.tooltip = location.context;
                }
                
                // Set command to open the location
                item.command = {
                    command: 'minecraftDevToolkit.openScoreboardLocation',
                    title: 'Open Location',
                    arguments: [location]
                };
                
                return item;
            });
        }

        return [];
    }
}

export class ScoreboardTreeItem extends vscode.TreeItem {
    public scoreboard?: Scoreboard;
    public location?: ScoreboardLocation;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        scoreboard?: Scoreboard,
        location?: ScoreboardLocation
    ) {
        super(label, collapsibleState);
        
        this.scoreboard = scoreboard;
        this.location = location;
        
        // Set appropriate icon
        if (location) {
            this.contextValue = 'location';
            this.iconPath = new vscode.ThemeIcon('go-to-file');
        } else if (scoreboard) {
            this.contextValue = 'scoreboard';
            this.iconPath = new vscode.ThemeIcon('list-tree');
            
            // Add scoreboard type to the tooltip if available
            if (scoreboard.type) {
                this.tooltip = `Type: ${scoreboard.type}`;
            }
        }
    }
}
```

## Utilities

### Parser Utility

```typescript
import { Scoreboard } from '../models/scoreboard';

/**
 * Parses a Minecraft function file to find scoreboard objectives
 * 
 * @param content The content of the file to parse
 * @param filePath The path to the file being parsed
 * @returns Array of scoreboard objectives found in the file
 */
export function parseScoreboardObjectives(content: string, filePath: string): Scoreboard[] {
    const lines = content.split('\n');
    const scoreboardMap = new Map<string, Scoreboard>();
    
    // Regex patterns for different scoreboard commands
    const objectivesAddPattern = /^scoreboard\s+objectives\s+add\s+(\w+)\s+(\w+)(?:\s+(.*))?/i;
    const objectivesRemovePattern = /^scoreboard\s+objectives\s+remove\s+(\w+)/i;
    const playersPattern = /^scoreboard\s+players\s+\w+\s+(\w+)\s+/i;
    const executeStorePattern = /execute\s+store\s+\w+\s+score\s+\w+\s+(\w+)\s+/i;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and comments
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }
        
        // Check for scoreboard objectives add
        let match = line.match(objectivesAddPattern);
        if (match) {
            const name = match[1];
            const type = match[2];
            updateScoreboard(name, i + 1, line, type);
            continue;
        }
        
        // Check for scoreboard objectives remove
        match = line.match(objectivesRemovePattern);
        if (match) {
            const name = match[1];
            updateScoreboard(name, i + 1, line);
            continue;
        }
        
        // Check for scoreboard players operations
        match = line.match(playersPattern);
        if (match) {
            const name = match[1];
            updateScoreboard(name, i + 1, line);
            continue;
        }
        
        // Check for execute store score
        match = line.match(executeStorePattern);
        if (match) {
            const name = match[1];
            updateScoreboard(name, i + 1, line);
            continue;
        }
    }
    
    function updateScoreboard(name: string, lineIndex: number, context: string, type?: string) {
        if (scoreboardMap.has(name)) {
            // Update existing scoreboard
            const scoreboard = scoreboardMap.get(name)!;
            
            // Add the location
            scoreboard.locations.push({
                file: filePath,
                line: lineIndex,
                context: context
            });
            
            // Update usage count
            scoreboard.usageCount += 1;
            
            // Update type if not already set
            if (!scoreboard.type && type) {
                scoreboard.type = type;
            }
        } else {
            // Create new scoreboard
            const scoreboard: Scoreboard = {
                name: name,
                type: type,
                usageCount: 1,
                locations: [{
                    file: filePath,
                    line: lineIndex,
                    context: context
                }]
            };
            
            scoreboardMap.set(name, scoreboard);
        }
    }
    
    return Array.from(scoreboardMap.values());
}
```

## Extension Entry Point

```typescript
import * as vscode from 'vscode';
import { SnippetRepository } from './snippetRepository';
import { ScoreboardTracker } from './scoreboardTracker';
import { SnippetTreeDataProvider } from './providers/snippetTreeDataProvider';
import { ScoreboardTreeDataProvider } from './providers/scoreboardTreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
    // Initialize core components
    const snippetRepository = new SnippetRepository(context);
    const scoreboardTracker = new ScoreboardTracker(context);
    
    // Initialize tree data providers
    const snippetProvider = new SnippetTreeDataProvider(snippetRepository);
    const scoreboardProvider = new ScoreboardTreeDataProvider(scoreboardTracker);
    
    // Register tree views
    vscode.window.registerTreeDataProvider('snippetExplorer', snippetProvider);
    vscode.window.registerTreeDataProvider('scoreboardExplorer', scoreboardProvider);
    
    // On startup, scan for scoreboard objectives if configured
    const config = vscode.workspace.getConfiguration('minecraftDevToolkit');
    if (config.get('scanOnStartup')) {
        scoreboardTracker.scanWorkspace().then(() => {
            scoreboardProvider.refresh();
        });
    }
    
    console.log('Minecraft Development Toolkit is now active!');
}

export function deactivate() {
    // Clean up resources on deactivation
}
```

## Extension Configuration

```json
{
    "configuration": {
        "title": "Minecraft Development Toolkit",
        "properties": {
            "minecraftDevToolkit.snippetsPath": {
                "type": "string",
                "default": "",
                "description": "Path to store snippet repository JSON file. If empty, uses the workspace folder."
            },
            "minecraftDevToolkit.scanOnStartup": {
                "type": "boolean",
                "default": true,
                "description": "Automatically scan for scoreboard objectives when extension activates."
            }
        }
    }
}
```