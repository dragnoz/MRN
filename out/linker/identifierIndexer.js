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
exports.buildIndex = buildIndex;
exports.updateIndexForFile = updateIndexForFile;
exports.getLinkedFiles = getLinkedFiles;
exports.getFunctionCallers = getFunctionCallers;
// Logic for building and querying the identifier index
const vscode = __importStar(require("vscode"));
const identifierParser_1 = require("./identifierParser");
// In-memory index: Map<identifierString, Set<fileUriString>>
const identifierIndex = new Map();
// Index for function calls: Map<callerFileUriString, Set<calledFunctionId>>
const functionCallIndex = new Map();
// --- Index Management ---
async function buildIndex(context, progress) {
    console.log("Building identifier index...");
    identifierIndex.clear();
    functionCallIndex.clear(); // Clear function call index too
    const config = vscode.workspace.getConfiguration("mrt.linker");
    const includePattern = config.get('filesToIndex', '**/*.{json,mcfunction,lang}');
    const excludePattern = config.get('excludePattern', '**/node_modules/**,**/dist/**,**/out/**');
    progress?.report({ message: "Finding relevant files..." });
    const files = await vscode.workspace.findFiles(includePattern, excludePattern);
    console.log(`Found ${files.length} files matching pattern '${includePattern}' excluding '${excludePattern}'.`);
    progress?.report({ message: `Processing ${files.length} files...`, increment: 0 });
    const totalFiles = files.length;
    let processedFiles = 0;
    const reportIncrement = Math.max(1, Math.floor(totalFiles / 100)); // Report progress roughly every 1%
    // Process files in chunks to avoid overwhelming the system?
    // For now, process all concurrently
    const promises = files.map(async (fileUri) => {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const parseResult = (0, identifierParser_1.parseFileForIdentifiers)(document);
            const uriString = fileUri.toString();
            // Update identifier index
            for (const id of parseResult.identifiers) {
                if (!identifierIndex.has(id)) {
                    identifierIndex.set(id, new Set());
                }
                identifierIndex.get(id)?.add(uriString);
            }
            // Update function call index (caller -> called)
            if (parseResult.calledFunctions.size > 0) {
                functionCallIndex.set(uriString, parseResult.calledFunctions);
            }
        }
        catch (error) {
            // Log errors but continue processing other files
            console.error(`Error processing file ${fileUri.fsPath}:`, error);
        }
        finally {
            processedFiles++;
            if (processedFiles % reportIncrement === 0) {
                progress?.report({ message: `Processing ${totalFiles} files...`, increment: (reportIncrement / totalFiles) * 100 });
            }
        }
    });
    await Promise.all(promises);
    progress?.report({ message: "Index build complete.", increment: 100 });
    console.log(`Identifier index built. Found ${identifierIndex.size} unique identifiers across ${processedFiles} processed files.`);
}
async function updateIndexForFile(document) {
    const uriString = document.uri.toString();
    let indexChanged = false;
    console.log(`Updating index for ${uriString}`);
    // --- Remove old entries for this file --- 
    const oldIdentifiersForFile = new Set();
    for (const [id, uriSet] of identifierIndex.entries()) {
        if (uriSet.has(uriString)) {
            oldIdentifiersForFile.add(id);
            uriSet.delete(uriString);
            if (uriSet.size === 0) {
                identifierIndex.delete(id);
            }
            indexChanged = true; // Mark change if deletion occurred
        }
    }
    // Remove old function calls for this file
    if (functionCallIndex.has(uriString)) {
        functionCallIndex.delete(uriString);
        indexChanged = true; // Mark change if deletion occurred
    }
    // --- Add current identifiers and function calls for this file --- 
    const parseResult = (0, identifierParser_1.parseFileForIdentifiers)(document);
    // Add identifiers
    for (const id of parseResult.identifiers) {
        if (!identifierIndex.has(id)) {
            identifierIndex.set(id, new Set());
        }
        const uriSet = identifierIndex.get(id); // We know it exists now
        if (!uriSet.has(uriString)) {
            uriSet.add(uriString);
            indexChanged = true; // Mark change if addition occurred
        }
    }
    // Add function calls
    if (parseResult.calledFunctions.size > 0) {
        functionCallIndex.set(uriString, parseResult.calledFunctions);
        indexChanged = true; // Mark change if addition occurred (or if calls changed)
    }
    // Check if any identifiers were removed but not re-added
    for (const oldId of oldIdentifiersForFile) {
        if (!parseResult.identifiers.has(oldId)) {
            indexChanged = true; // Mark change if an identifier was fully removed by this file change
            break;
        }
    }
    if (indexChanged) {
        console.log(`Index updated for ${uriString}`);
    }
    else {
        console.log(`Index unchanged for ${uriString}`);
    }
    return indexChanged;
}
// --- Querying Function --- 
function getLinkedFiles(identifier) {
    const uriStrings = identifierIndex.get(identifier) || new Set();
    return Array.from(uriStrings).map(uriStr => vscode.Uri.parse(uriStr));
}
// Function to find files that call a specific function ID
function getFunctionCallers(functionId) {
    const callerUris = [];
    for (const [callerUriString, calledFunctions] of functionCallIndex.entries()) {
        if (calledFunctions.has(functionId)) {
            callerUris.push(vscode.Uri.parse(callerUriString));
        }
    }
    return callerUris;
}
//# sourceMappingURL=identifierIndexer.js.map