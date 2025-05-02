import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { Scoreboard, ScoreboardLocation } from './models/scoreboard';
import { getWorkspaceFolder, getFilesWithExtension, readFileContent } from './utils/fileSystem';
import { parseScoreboardObjectives } from './utils/parser';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);

/**
 * Tracks scoreboard objectives across a Minecraft project
 */
export class ScoreboardTracker {
    private context: vscode.ExtensionContext;
    private scoreboardsFile: string | undefined;
    private scoreboards: Map<string, Scoreboard> = new Map();
    private initialized: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initialize();
    }

    private async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Determine file path to store scoreboards data
            const workspaceFolder = getWorkspaceFolder();
            if (workspaceFolder) {
                const vscodeDir = path.join(workspaceFolder, '.vscode');
                
                // Create .vscode directory if it doesn't exist
                if (!fs.existsSync(vscodeDir)) {
                    fs.mkdirSync(vscodeDir, { recursive: true });
                }
                
                this.scoreboardsFile = path.join(vscodeDir, 'mc-scoreboards.json');
            }

            // Load previous scoreboard data
            await this.loadScoreboards();
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing scoreboard tracker:', error);
            vscode.window.showErrorMessage(`Failed to initialize scoreboard tracker: ${error}`);
        }
    }

    private async loadScoreboards(): Promise<void> {
        try {
            // Load from file first if it exists
            if (this.scoreboardsFile && await exists(this.scoreboardsFile)) {
                const data = await readFile(this.scoreboardsFile, 'utf-8');
                const scoreboardArray: Scoreboard[] = JSON.parse(data);
                
                // Convert array to map
                this.scoreboards = new Map();
                scoreboardArray.forEach(scoreboard => {
                    this.scoreboards.set(scoreboard.name, scoreboard);
                });
                
                return;
            }
            
            // Try loading from extension storage if file doesn't exist
            const scoreboardArray = this.context.globalState.get<Scoreboard[]>('mcScoreboards');
            if (scoreboardArray) {
                this.scoreboards = new Map();
                scoreboardArray.forEach(scoreboard => {
                    this.scoreboards.set(scoreboard.name, scoreboard);
                });
            }
        } catch (error) {
            console.error('Error loading scoreboards:', error);
            vscode.window.showErrorMessage(`Failed to load scoreboards: ${error}`);
            this.scoreboards = new Map();
        }
    }

    private async saveScoreboards(): Promise<void> {
        try {
            // Convert map to array for saving
            const scoreboardArray = Array.from(this.scoreboards.values());
            
            // Save to file if path is configured
            if (this.scoreboardsFile) {
                await writeFile(this.scoreboardsFile, JSON.stringify(scoreboardArray, null, 2), 'utf-8');
            }
            
            // Always save to extension storage as backup
            await this.context.globalState.update('mcScoreboards', scoreboardArray);
        } catch (error) {
            console.error('Error saving scoreboards:', error);
            vscode.window.showErrorMessage(`Failed to save scoreboards: ${error}`);
        }
    }

    public async getScoreboards(): Promise<Scoreboard[]> {
        await this.initialize();
        return Array.from(this.scoreboards.values());
    }

    public async scanWorkspace(): Promise<void> {
        await this.initialize();
        
        const workspaceFolder = getWorkspaceFolder();
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder open. Cannot scan for scoreboard objectives.');
            return;
        }

        try {
            // Clear existing scoreboards
            this.scoreboards.clear();
            
            // Get all .mcfunction files in workspace
            const mcfunctionFiles = await getFilesWithExtension(workspaceFolder, '.mcfunction');
            
            // Parse each file
            for (const filePath of mcfunctionFiles) {
                try {
                    const content = await readFileContent(filePath);
                    const fileScoreboards = parseScoreboardObjectives(content, filePath);
                    
                    // Merge results with existing data
                    for (const scoreboard of fileScoreboards) {
                        if (this.scoreboards.has(scoreboard.name)) {
                            // Merge with existing scoreboard
                            const existing = this.scoreboards.get(scoreboard.name)!;
                            existing.usageCount += scoreboard.usageCount;
                            existing.locations.push(...scoreboard.locations);
                            
                            // Set type if we found it and didn't have it before
                            if (scoreboard.type && !existing.type) {
                                existing.type = scoreboard.type;
                            }
                        } else {
                            // Add new scoreboard
                            this.scoreboards.set(scoreboard.name, scoreboard);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                }
            }
            
            // Save updated scoreboards
            await this.saveScoreboards();
        } catch (error) {
            console.error('Error scanning workspace for scoreboard objectives:', error);
            vscode.window.showErrorMessage(`Failed to scan workspace: ${error}`);
        }
    }

    public async scanFile(uri: vscode.Uri): Promise<void> {
        await this.initialize();
        
        try {
            const filePath = uri.fsPath;
            const content = await readFileContent(filePath);
            const fileScoreboards = parseScoreboardObjectives(content, filePath);
            
            // First, remove all locations from this file
            this.scoreboards.forEach(scoreboard => {
                scoreboard.locations = scoreboard.locations.filter(loc => loc.file !== filePath);
                
                // Recalculate usage count
                scoreboard.usageCount = scoreboard.locations.length;
            });
            
            // Then add the new locations
            for (const scoreboard of fileScoreboards) {
                if (this.scoreboards.has(scoreboard.name)) {
                    // Merge with existing scoreboard
                    const existing = this.scoreboards.get(scoreboard.name)!;
                    existing.usageCount += scoreboard.usageCount;
                    existing.locations.push(...scoreboard.locations);
                    
                    // Set type if we found it and didn't have it before
                    if (scoreboard.type && !existing.type) {
                        existing.type = scoreboard.type;
                    }
                } else {
                    // Add new scoreboard
                    this.scoreboards.set(scoreboard.name, scoreboard);
                }
            }
            
            // Clean up scoreboards with zero usage
            for (const [name, scoreboard] of this.scoreboards.entries()) {
                if (scoreboard.usageCount <= 0) {
                    this.scoreboards.delete(name);
                }
            }
            
            // Save updated scoreboards
            await this.saveScoreboards();
        } catch (error) {
            console.error(`Error scanning file ${uri.fsPath}:`, error);
        }
    }

    public async rescanlWorkspace(): Promise<void> {
        // Just an alias for scanWorkspace for clarity in code
        return this.scanWorkspace();
    }

    public async openScoreboardLocation(location: { file: string, line: number }): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(location.file);
            const editor = await vscode.window.showTextDocument(document);
            
            // Set cursor position (accounting for 0-indexed lines)
            const position = new vscode.Position(location.line, 0);
            editor.selection = new vscode.Selection(position, position);
            
            // Scroll the editor to bring this line into view
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        } catch (error) {
            console.error(`Error opening location ${location.file}:${location.line}:`, error);
            vscode.window.showErrorMessage(`Failed to open location: ${error}`);
        }
    }
}