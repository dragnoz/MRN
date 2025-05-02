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
exports.ScoreboardTreeItem = exports.ScoreboardTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Tree view provider for the scoreboards explorer
 */
class ScoreboardTreeDataProvider {
    constructor(scoreboardTracker) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.scoreboardTracker = scoreboardTracker;
        // Register open location command
        vscode.commands.registerCommand('minecraftDevToolkit.openScoreboardLocation', async (location) => {
            await this.scoreboardTracker.openScoreboardLocation(location);
        });
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        // Root level - show scoreboard objectives
        if (!element) {
            const scoreboards = await this.scoreboardTracker.getScoreboards();
            // Sort by name
            scoreboards.sort((a, b) => a.name.localeCompare(b.name));
            return scoreboards.map(scoreboard => new ScoreboardTreeItem(`${scoreboard.name} (${scoreboard.usageCount})`, vscode.TreeItemCollapsibleState.Collapsed, scoreboard));
        }
        // Scoreboard level - show locations
        if (element.scoreboard) {
            return element.scoreboard.locations.map(location => {
                // Extract file name from path
                const fileName = location.file.split(/[\\/]/).pop() || location.file;
                // Create label with location information
                const label = `${fileName}:${location.line}`;
                // Create the tree item
                const item = new ScoreboardTreeItem(label, vscode.TreeItemCollapsibleState.None, undefined, location);
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
exports.ScoreboardTreeDataProvider = ScoreboardTreeDataProvider;
class ScoreboardTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, scoreboard, location) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.scoreboard = scoreboard;
        this.location = location;
        // Set appropriate icon
        if (location) {
            this.contextValue = 'location';
            this.iconPath = {
                light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'light', 'go-to-file.svg')),
                dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'resources', 'dark', 'go-to-file.svg'))
            };
        }
        else if (scoreboard) {
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
exports.ScoreboardTreeItem = ScoreboardTreeItem;
//# sourceMappingURL=scoreboardTreeDataProvider.js.map