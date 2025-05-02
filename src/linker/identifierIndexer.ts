// Logic for building and querying the identifier index
import * as vscode from 'vscode';
import { parseFileForIdentifiers } from './identifierParser';

// In-memory index: Map<identifierString, Set<fileUriString>>
const identifierIndex: Map<string, Set<string>> = new Map();
// Index for function calls: Map<callerFileUriString, Set<calledFunctionId>>
const functionCallIndex: Map<string, Set<string>> = new Map();

// --- Index Management ---

export async function buildIndex(context: vscode.ExtensionContext, progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
    console.log("Building identifier index...");
    identifierIndex.clear();
    functionCallIndex.clear(); // Clear function call index too

    const config = vscode.workspace.getConfiguration("mrt.linker");
    const includePattern = config.get<string>('filesToIndex', '**/*.{json,mcfunction,lang}');
    const excludePattern = config.get<string>('excludePattern', '**/node_modules/**,**/dist/**,**/out/**');

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
            const parseResult = parseFileForIdentifiers(document);
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
        } catch (error) {
            // Log errors but continue processing other files
            console.error(`Error processing file ${fileUri.fsPath}:`, error);
        } finally {
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

export async function updateIndexForFile(document: vscode.TextDocument): Promise<boolean> {
    const uriString = document.uri.toString();
    let indexChanged = false;
    console.log(`Updating index for ${uriString}`);

    // --- Remove old entries for this file --- 
    const oldIdentifiersForFile = new Set<string>();
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
    const parseResult = parseFileForIdentifiers(document);
    // Add identifiers
    for (const id of parseResult.identifiers) {
        if (!identifierIndex.has(id)) {
            identifierIndex.set(id, new Set());
        }
        const uriSet = identifierIndex.get(id)!; // We know it exists now
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
    for(const oldId of oldIdentifiersForFile) {
        if (!parseResult.identifiers.has(oldId)) {
            indexChanged = true; // Mark change if an identifier was fully removed by this file change
            break;
        }
    }

    if (indexChanged) {
        console.log(`Index updated for ${uriString}`);
    } else {
        console.log(`Index unchanged for ${uriString}`);
    }
    return indexChanged;
}

// --- Querying Function --- 

export function getLinkedFiles(identifier: string): vscode.Uri[] {
    const uriStrings = identifierIndex.get(identifier) || new Set();
    return Array.from(uriStrings).map(uriStr => vscode.Uri.parse(uriStr));
}

// Function to find files that call a specific function ID
export function getFunctionCallers(functionId: string): vscode.Uri[] {
    const callerUris: vscode.Uri[] = [];
    for (const [callerUriString, calledFunctions] of functionCallIndex.entries()) {
        if (calledFunctions.has(functionId)) {
            callerUris.push(vscode.Uri.parse(callerUriString));
        }
    }
    return callerUris;
}

