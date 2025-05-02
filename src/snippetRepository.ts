import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { Snippet } from './models/snippet';
import { getWorkspaceFolder, ensureDirectoryExists } from './utils/fileSystem';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);

/**
 * Manages a repository of code snippets
 */
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
        if (this.initialized) {
            return;
        }

        try {
            // Determine where to store snippets
            const config = vscode.workspace.getConfiguration('minecraftDevToolkit');
            const configuredPath = config.get<string>('snippetsPath', '');
            
            const workspaceFolder = getWorkspaceFolder();
            if (!workspaceFolder) {
                vscode.window.showWarningMessage('No workspace folder open. Snippets will be stored in extension storage.');
                this.snippetsFile = undefined;
            } else {
                const storagePath = configuredPath || path.join(workspaceFolder, '.vscode');
                await ensureDirectoryExists(storagePath);
                this.snippetsFile = path.join(storagePath, 'mc-snippets.json');
            }

            // Load snippets
            await this.loadSnippets();
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing snippet repository:', error);
            vscode.window.showErrorMessage(`Failed to initialize snippet repository: ${error}`);
        }
    }

    private async loadSnippets(): Promise<void> {
        try {
            // Try loading from file first
            if (this.snippetsFile && await exists(this.snippetsFile)) {
                const content = await readFile(this.snippetsFile, 'utf-8');
                this.snippets = JSON.parse(content);
                return;
            }
            
            // If no file exists, try loading from extension storage
            const snippets = this.context.globalState.get<Snippet[]>('mcSnippets');
            if (snippets) {
                this.snippets = snippets;
            } else {
                // Initialize with empty array if nothing exists
                this.snippets = [];
            }
        } catch (error) {
            console.error('Error loading snippets:', error);
            vscode.window.showErrorMessage(`Failed to load snippets: ${error}`);
            this.snippets = [];
        }
    }

    private async saveSnippets(): Promise<void> {
        try {
            // Save to file if path is configured
            if (this.snippetsFile) {
                await writeFile(this.snippetsFile, JSON.stringify(this.snippets, null, 2), 'utf-8');
            }
            
            // Always save to extension storage as backup
            await this.context.globalState.update('mcSnippets', this.snippets);
        } catch (error) {
            console.error('Error saving snippets:', error);
            vscode.window.showErrorMessage(`Failed to save snippets: ${error}`);
        }
    }

    public async getSnippets(): Promise<Snippet[]> {
        await this.initialize();
        return [...this.snippets];
    }

    public async getSnippetById(id: string): Promise<Snippet | undefined> {
        await this.initialize();
        return this.snippets.find(snippet => snippet.id === id);
    }

    public async getSnippetsByTag(tag: string): Promise<Snippet[]> {
        await this.initialize();
        return this.snippets.filter(snippet => 
            snippet.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
    }

    public async getSnippetsByCategory(category: string): Promise<Snippet[]> {
        await this.initialize();
        return this.snippets.filter(snippet => 
            snippet.category.toLowerCase() === category.toLowerCase()
        );
    }

    public async addSnippet(snippet: Snippet): Promise<void> {
        await this.initialize();
        this.snippets.push(snippet);
        await this.saveSnippets();
    }

    public async updateSnippet(updatedSnippet: Snippet): Promise<void> {
        await this.initialize();
        const index = this.snippets.findIndex(s => s.id === updatedSnippet.id);
        if (index >= 0) {
            this.snippets[index] = updatedSnippet;
            await this.saveSnippets();
        }
    }

    public async deleteSnippet(id: string): Promise<void> {
        await this.initialize();
        const index = this.snippets.findIndex(s => s.id === id);
        if (index >= 0) {
            this.snippets.splice(index, 1);
            await this.saveSnippets();
        }
    }

    public async searchSnippets(query: string): Promise<Snippet[]> {
        await this.initialize();
        const lowerQuery = query.toLowerCase();
        
        return this.snippets.filter(snippet => 
            snippet.name.toLowerCase().includes(lowerQuery) ||
            snippet.content.toLowerCase().includes(lowerQuery) ||
            snippet.category.toLowerCase().includes(lowerQuery) ||
            snippet.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    public async getCategories(): Promise<string[]> {
        await this.initialize();
        const categories = new Set<string>();
        
        this.snippets.forEach(snippet => {
            categories.add(snippet.category);
        });
        
        return Array.from(categories).sort();
    }

    public async getTags(): Promise<string[]> {
        await this.initialize();
        const tags = new Set<string>();
        
        this.snippets.forEach(snippet => {
            snippet.tags.forEach(tag => {
                tags.add(tag);
            });
        });
        
        return Array.from(tags).sort();
    }
}