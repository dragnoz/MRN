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
exports.LinkedFilesViewProvider = void 0;
// TreeView provider for displaying linked files
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path")); // Add missing path import
const identifierIndexer_1 = require("./identifierIndexer"); // Import getFunctionCallers
const identifierParser_1 = require("./identifierParser");
class LinkedFilesViewProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.isIndexReady = false; // Track if the initial index build is complete
    }
    // Method to signal that the index is ready
    setIndexReady(ready) {
        this.isIndexReady = ready;
        this.refresh(); // Refresh the view when index readiness changes
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    updateCurrentDocument(document) {
        const newUri = document?.uri;
        // Refresh only if the document URI actually changes
        if (newUri?.toString() !== this.currentDocumentUri?.toString()) {
            this.currentDocumentUri = newUri;
            this.refresh();
        }
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!this.isIndexReady) {
            // Optionally show a "Building index..." message
            return Promise.resolve([new LinkedItem("Building index...", undefined, vscode.TreeItemCollapsibleState.None, 'status')]);
        }
        if (!this.currentDocumentUri) {
            return Promise.resolve([new LinkedItem("Open a relevant file to see links", undefined, vscode.TreeItemCollapsibleState.None, 'status')]);
        }
        const currentDocUriString = this.currentDocumentUri.toString();
        if (element) {
            // If element is an identifier, return its linked files (where the ID is defined/used)
            if (element.contextValue === "identifier") {
                const linkedUris = (0, identifierIndexer_1.getLinkedFiles)(element.identifierValue);
                const items = linkedUris
                    .filter(uri => uri.toString() !== currentDocUriString) // Exclude current file
                    .map(uri => {
                    const label = relativePathLabel(uri);
                    return new LinkedItem(label, uri, vscode.TreeItemCollapsibleState.None, "file");
                });
                items.sort((a, b) => a.label.localeCompare(b.label));
                return Promise.resolve(items);
            }
            // If element is the "Called By" root, return the caller function files
            else if (element.contextValue === "caller_root") {
                const callerUris = (0, identifierIndexer_1.getFunctionCallers)(element.identifierValue);
                const items = callerUris
                    .filter(uri => uri.toString() !== currentDocUriString) // Exclude current file if it calls itself (unlikely but possible)
                    .map(uri => {
                    const label = `FF: ${relativePathLabel(uri)}`; // Add FF: prefix
                    return new LinkedItem(label, uri, vscode.TreeItemCollapsibleState.None, "file");
                });
                items.sort((a, b) => a.label.localeCompare(b.label));
                return Promise.resolve(items);
            }
            // If element is a file or status, it has no children
            return Promise.resolve([]);
        }
        else {
            // If no element, return the identifiers found in the current document that link elsewhere
            try { // Add missing try block
                const document = await vscode.workspace.openTextDocument(this.currentDocumentUri);
                const parseResult = (0, identifierParser_1.parseFileForIdentifiers)(document);
                const identifiers = parseResult.identifiers; // Get identifiers from parse result
                const items = [];
                // 1. Add identifiers found IN this file
                const identifierItems = Array.from(identifiers).map(id => {
                    const linkedUris = (0, identifierIndexer_1.getLinkedFiles)(id);
                    const otherLinks = linkedUris.filter(uri => uri.toString() !== currentDocUriString);
                    if (otherLinks.length > 0) {
                        const label = `${id} (${otherLinks.length})`;
                        return new LinkedItem(label, undefined, vscode.TreeItemCollapsibleState.Collapsed, "identifier", id);
                    }
                    else {
                        return null;
                    }
                }).filter(item => item !== null);
                items.push(...identifierItems);
                // 2. If current file is a function, add callers
                if (document.languageId === "mcfunction") {
                    const currentFunctionId = getFunctionIdFromUri(this.currentDocumentUri);
                    if (currentFunctionId) {
                        const callerUris = (0, identifierIndexer_1.getFunctionCallers)(currentFunctionId);
                        const otherCallers = callerUris.filter(uri => uri.toString() !== currentDocUriString);
                        if (otherCallers.length > 0) {
                            // Add a root node for callers
                            const callerRoot = new LinkedItem(`Called By (${otherCallers.length})`, undefined, vscode.TreeItemCollapsibleState.Collapsed, "caller_root", currentFunctionId);
                            items.push(callerRoot);
                        }
                    }
                }
                if (items.length === 0) {
                    return Promise.resolve([new LinkedItem("No links found for this file", undefined, vscode.TreeItemCollapsibleState.None, "status")]);
                }
                // Sort top-level items alphabetically (identifiers first, then "Called By")
                items.sort((a, b) => {
                    if (a.contextValue === "caller_root" && b.contextValue !== "caller_root")
                        return 1;
                    if (a.contextValue !== "caller_root" && b.contextValue === "caller_root")
                        return -1;
                    return a.label.localeCompare(b.label);
                });
                return Promise.resolve(items);
            }
            catch (error) {
                console.error(`Error getting children for TreeView:`, error);
                return Promise.resolve([new LinkedItem("Error loading links for this file", undefined, vscode.TreeItemCollapsibleState.None, "status")]);
            }
        }
    }
}
exports.LinkedFilesViewProvider = LinkedFilesViewProvider;
class LinkedItem extends vscode.TreeItem {
    constructor(// Add missing constructor keyword
    label, resourceUriOrUndefined, // Renamed to avoid conflict
    collapsibleState, 
    // Use more specific context values
    contextValue, // Add caller_root
    identifierValue = "" // Store identifier if contextValue is "identifier" or "caller_root"
    ) {
        // Pass resourceUri only if it's a file item for proper icon behavior
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.identifierValue = identifierValue;
        this.resourceUri = contextValue === "file" ? resourceUriOrUndefined : undefined;
        this.tooltip = `${this.label}`;
        // Set command and icon based on context
        if (contextValue === "file" && resourceUriOrUndefined) {
            this.command = {
                command: "vscode.open",
                title: "Open File",
                arguments: [resourceUriOrUndefined],
            };
            this.iconPath = vscode.ThemeIcon.File;
            // Add full path to tooltip?
            this.tooltip = `${relativePathLabel(resourceUriOrUndefined)}\n${resourceUriOrUndefined.fsPath}`;
        }
        else if (contextValue === "identifier") {
            this.iconPath = new vscode.ThemeIcon("tag");
            this.tooltip = `Identifier: ${identifierValue}`;
        }
        else if (contextValue === "caller_root") { // Handle caller_root
            this.iconPath = new vscode.ThemeIcon("references"); // Use a suitable icon
            this.tooltip = `Files calling function: ${identifierValue}`;
        }
        else { // status message
            this.iconPath = new vscode.ThemeIcon("info");
        }
    } // Add missing closing brace for constructor
}
// Helper to get a potentially shorter relative path label with RP/BP prefixes
function relativePathLabel(uri) {
    const relativePath = vscode.workspace.asRelativePath(uri, false); // Don't include workspace folder name
    if (relativePath.startsWith("resource_packs/")) {
        // Remove "resource_packs/" and the next segment (pack name)
        const pathParts = relativePath.split("/");
        if (pathParts.length > 2) {
            return `RP: ${pathParts.slice(2).join("/")}`;
        }
        // Handle case like resource_packs/manifest.json (though unlikely for linked files)
        return `RP: ${pathParts.slice(1).join("/")}`;
    }
    else if (relativePath.startsWith("behavior_packs/")) {
        // Remove "behavior_packs/" and the next segment (pack name)
        const pathParts = relativePath.split("/");
        if (pathParts.length > 2) {
            return `BP: ${pathParts.slice(2).join("/")}`;
        }
        // Handle case like behavior_packs/manifest.json
        return `BP: ${pathParts.slice(1).join("/")}`;
    }
    // If not in RP or BP, return the original relative path
    return relativePath;
}
// Helper to derive function ID from URI (e.g., my_pack:folder/my_func)
function getFunctionIdFromUri(uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder)
        return null;
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
    // Expected format: behavior_packs/<pack_name>/functions/<function_path>.mcfunction
    const bpMatch = relativePath.match(/^behavior_packs\/([^/]+)\/functions\/(.+)\.mcfunction$/);
    if (bpMatch && bpMatch[1] && bpMatch[2]) {
        // We don't have the pack name directly, but Minecraft often uses the folder name
        // or relies on context. For linking, we need a unique ID. Using the path relative
        // to functions/ seems the most practical approach for now.
        // TODO: Consider how to reliably get a namespace if needed.
        // For now, let's just use the path relative to functions/ as the ID.
        return bpMatch[2]; // e.g., "folder/my_func"
    }
    return null;
}
//# sourceMappingURL=linkedFilesViewProvider.js.map