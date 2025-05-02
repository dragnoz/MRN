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
exports.ScoreboardTracker = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const fileSystem_1 = require("./utils/fileSystem");
const parser_1 = require("./utils/parser");
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const exists = (0, util_1.promisify)(fs.exists);
/**
 * Tracks scoreboard objectives across a Minecraft project
 */
class ScoreboardTracker {
    constructor(context) {
        this.scoreboards = new Map();
        this.initialized = false;
        this.context = context;
        this.initialize();
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Determine file path to store scoreboards data
            const workspaceFolder = (0, fileSystem_1.getWorkspaceFolder)();
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
        }
        catch (error) {
            console.error('Error initializing scoreboard tracker:', error);
            vscode.window.showErrorMessage(`Failed to initialize scoreboard tracker: ${error}`);
        }
    }
    async loadScoreboards() {
        try {
            // Load from file first if it exists
            if (this.scoreboardsFile && await exists(this.scoreboardsFile)) {
                const data = await readFile(this.scoreboardsFile, 'utf-8');
                const scoreboardArray = JSON.parse(data);
                // Convert array to map
                this.scoreboards = new Map();
                scoreboardArray.forEach(scoreboard => {
                    this.scoreboards.set(scoreboard.name, scoreboard);
                });
                return;
            }
            // Try loading from extension storage if file doesn't exist
            const scoreboardArray = this.context.globalState.get('mcScoreboards');
            if (scoreboardArray) {
                this.scoreboards = new Map();
                scoreboardArray.forEach(scoreboard => {
                    this.scoreboards.set(scoreboard.name, scoreboard);
                });
            }
        }
        catch (error) {
            console.error('Error loading scoreboards:', error);
            vscode.window.showErrorMessage(`Failed to load scoreboards: ${error}`);
            this.scoreboards = new Map();
        }
    }
    async saveScoreboards() {
        try {
            // Convert map to array for saving
            const scoreboardArray = Array.from(this.scoreboards.values());
            // Save to file if path is configured
            if (this.scoreboardsFile) {
                await writeFile(this.scoreboardsFile, JSON.stringify(scoreboardArray, null, 2), 'utf-8');
            }
            // Always save to extension storage as backup
            await this.context.globalState.update('mcScoreboards', scoreboardArray);
        }
        catch (error) {
            console.error('Error saving scoreboards:', error);
            vscode.window.showErrorMessage(`Failed to save scoreboards: ${error}`);
        }
    }
    async getScoreboards() {
        await this.initialize();
        return Array.from(this.scoreboards.values());
    }
    async scanWorkspace() {
        await this.initialize();
        const workspaceFolder = (0, fileSystem_1.getWorkspaceFolder)();
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder open. Cannot scan for scoreboard objectives.');
            return;
        }
        try {
            // Clear existing scoreboards
            this.scoreboards.clear();
            // Get all .mcfunction files in workspace
            const mcfunctionFiles = await (0, fileSystem_1.getFilesWithExtension)(workspaceFolder, '.mcfunction');
            // Parse each file
            for (const filePath of mcfunctionFiles) {
                try {
                    const content = await (0, fileSystem_1.readFileContent)(filePath);
                    const fileScoreboards = (0, parser_1.parseScoreboardObjectives)(content, filePath);
                    // Merge results with existing data
                    for (const scoreboard of fileScoreboards) {
                        if (this.scoreboards.has(scoreboard.name)) {
                            // Merge with existing scoreboard
                            const existing = this.scoreboards.get(scoreboard.name);
                            existing.usageCount += scoreboard.usageCount;
                            existing.locations.push(...scoreboard.locations);
                            // Set type if we found it and didn't have it before
                            if (scoreboard.type && !existing.type) {
                                existing.type = scoreboard.type;
                            }
                        }
                        else {
                            // Add new scoreboard
                            this.scoreboards.set(scoreboard.name, scoreboard);
                        }
                    }
                }
                catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                }
            }
            // Save updated scoreboards
            await this.saveScoreboards();
        }
        catch (error) {
            console.error('Error scanning workspace for scoreboard objectives:', error);
            vscode.window.showErrorMessage(`Failed to scan workspace: ${error}`);
        }
    }
    async scanFile(uri) {
        await this.initialize();
        try {
            const filePath = uri.fsPath;
            const content = await (0, fileSystem_1.readFileContent)(filePath);
            const fileScoreboards = (0, parser_1.parseScoreboardObjectives)(content, filePath);
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
                    const existing = this.scoreboards.get(scoreboard.name);
                    existing.usageCount += scoreboard.usageCount;
                    existing.locations.push(...scoreboard.locations);
                    // Set type if we found it and didn't have it before
                    if (scoreboard.type && !existing.type) {
                        existing.type = scoreboard.type;
                    }
                }
                else {
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
        }
        catch (error) {
            console.error(`Error scanning file ${uri.fsPath}:`, error);
        }
    }
    async rescanlWorkspace() {
        // Just an alias for scanWorkspace for clarity in code
        return this.scanWorkspace();
    }
    async openScoreboardLocation(location) {
        try {
            const document = await vscode.workspace.openTextDocument(location.file);
            const editor = await vscode.window.showTextDocument(document);
            // Set cursor position (accounting for 0-indexed lines)
            const position = new vscode.Position(location.line, 0);
            editor.selection = new vscode.Selection(position, position);
            // Scroll the editor to bring this line into view
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            console.error(`Error opening location ${location.file}:${location.line}:`, error);
            vscode.window.showErrorMessage(`Failed to open location: ${error}`);
        }
    }
}
exports.ScoreboardTracker = ScoreboardTracker;
//# sourceMappingURL=scoreboardTracker.js.map