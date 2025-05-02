import * as vscode from 'vscode';
import * as path from 'path';
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
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'go-to-file.svg')),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'go-to-file.svg'))
            };
        } else if (scoreboard) {
            this.contextValue = 'scoreboard';
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'list-tree.svg')),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'list-tree.svg'))
            };
            
            // Add scoreboard type to the tooltip if available
            if (scoreboard.type) {
                this.tooltip = `Type: ${scoreboard.type}`;
            }
        }
    }
}