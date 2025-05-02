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
exports.SnippetRepository = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const fileSystem_1 = require("./utils/fileSystem");
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const exists = (0, util_1.promisify)(fs.exists);
/**
 * Manages a repository of code snippets
 */
class SnippetRepository {
    constructor(context) {
        this.snippets = [];
        this.initialized = false;
        this.context = context;
        this.initialize();
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Determine where to store snippets
            const config = vscode.workspace.getConfiguration('minecraftDevToolkit');
            const configuredPath = config.get('snippetsPath', '');
            const workspaceFolder = (0, fileSystem_1.getWorkspaceFolder)();
            if (!workspaceFolder) {
                vscode.window.showWarningMessage('No workspace folder open. Snippets will be stored in extension storage.');
                this.snippetsFile = undefined;
            }
            else {
                const storagePath = configuredPath || path.join(workspaceFolder, '.vscode');
                await (0, fileSystem_1.ensureDirectoryExists)(storagePath);
                this.snippetsFile = path.join(storagePath, 'mc-snippets.json');
            }
            // Load snippets
            await this.loadSnippets();
            this.initialized = true;
        }
        catch (error) {
            console.error('Error initializing snippet repository:', error);
            vscode.window.showErrorMessage(`Failed to initialize snippet repository: ${error}`);
        }
    }
    async loadSnippets() {
        try {
            // Try loading from file first
            if (this.snippetsFile && await exists(this.snippetsFile)) {
                const content = await readFile(this.snippetsFile, 'utf-8');
                this.snippets = JSON.parse(content);
                return;
            }
            // If no file exists, try loading from extension storage
            const snippets = this.context.globalState.get('mcSnippets');
            if (snippets) {
                this.snippets = snippets;
            }
            else {
                // Initialize with empty array if nothing exists
                this.snippets = [];
            }
        }
        catch (error) {
            console.error('Error loading snippets:', error);
            vscode.window.showErrorMessage(`Failed to load snippets: ${error}`);
            this.snippets = [];
        }
    }
    async saveSnippets() {
        try {
            // Save to file if path is configured
            if (this.snippetsFile) {
                await writeFile(this.snippetsFile, JSON.stringify(this.snippets, null, 2), 'utf-8');
            }
            // Always save to extension storage as backup
            await this.context.globalState.update('mcSnippets', this.snippets);
        }
        catch (error) {
            console.error('Error saving snippets:', error);
            vscode.window.showErrorMessage(`Failed to save snippets: ${error}`);
        }
    }
    async getSnippets() {
        await this.initialize();
        return [...this.snippets];
    }
    async getSnippetById(id) {
        await this.initialize();
        return this.snippets.find(snippet => snippet.id === id);
    }
    async getSnippetsByTag(tag) {
        await this.initialize();
        return this.snippets.filter(snippet => snippet.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }
    async getSnippetsByCategory(category) {
        await this.initialize();
        return this.snippets.filter(snippet => snippet.category.toLowerCase() === category.toLowerCase());
    }
    async addSnippet(snippet) {
        await this.initialize();
        this.snippets.push(snippet);
        await this.saveSnippets();
    }
    async updateSnippet(updatedSnippet) {
        await this.initialize();
        const index = this.snippets.findIndex(s => s.id === updatedSnippet.id);
        if (index >= 0) {
            this.snippets[index] = updatedSnippet;
            await this.saveSnippets();
        }
    }
    async deleteSnippet(id) {
        await this.initialize();
        const index = this.snippets.findIndex(s => s.id === id);
        if (index >= 0) {
            this.snippets.splice(index, 1);
            await this.saveSnippets();
        }
    }
    async searchSnippets(query) {
        await this.initialize();
        const lowerQuery = query.toLowerCase();
        return this.snippets.filter(snippet => snippet.name.toLowerCase().includes(lowerQuery) ||
            snippet.content.toLowerCase().includes(lowerQuery) ||
            snippet.category.toLowerCase().includes(lowerQuery) ||
            snippet.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
    }
    async getCategories() {
        await this.initialize();
        const categories = new Set();
        this.snippets.forEach(snippet => {
            categories.add(snippet.category);
        });
        return Array.from(categories).sort();
    }
    async getTags() {
        await this.initialize();
        const tags = new Set();
        this.snippets.forEach(snippet => {
            snippet.tags.forEach(tag => {
                tags.add(tag);
            });
        });
        return Array.from(tags).sort();
    }
}
exports.SnippetRepository = SnippetRepository;
//# sourceMappingURL=snippetRepository.js.map