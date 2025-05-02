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
exports.triggerUpdateDecorations = triggerUpdateDecorations;
exports.initializeGlyphDecorator = initializeGlyphDecorator;
exports.disposeGlyphDecorations = disposeGlyphDecorations;
// Logic for rendering custom glyphs using editor decorations
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs")); // Re-add fs module import
const logger_1 = require("../logger"); // Import logger functions
const decorationTypes = new Map();
let updateTimeout = undefined;
// Cache for found glyph configs to avoid repeated searches
let cachedGlyphConfigs = null;
let isSearchingGlyphs = false;
// Function to find glyph files in the workspace and create configs
async function findAndCreateGlyphConfigs(context) {
    if (isSearchingGlyphs) {
        // Avoid concurrent searches
        (0, logger_1.logInfo)("Glyph search already in progress, skipping.");
        return cachedGlyphConfigs || [];
    }
    isSearchingGlyphs = true;
    (0, logger_1.logInfo)("Searching for glyph atlas files in workspace...");
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        (0, logger_1.logInfo)(`Workspace folders: ${workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);
    }
    else {
        (0, logger_1.logInfo)("No workspace folders open.");
    }
    const searchPattern = "**/font/glyph_E*.png";
    (0, logger_1.logInfo)(`Using search pattern: ${searchPattern}`);
    const configs = [];
    try {
        // Search for glyph_E*.png files within any resource_packs/font directory
        const glyphFiles = await vscode.workspace.findFiles(searchPattern, "**/node_modules/**");
        (0, logger_1.logInfo)(`Raw files found by findFiles: ${glyphFiles.map(uri => vscode.workspace.asRelativePath(uri)).join(", ") || "None"}`);
        if (glyphFiles.length === 0) {
            (0, logger_1.logError)("MRT: No glyph atlas files (glyph_E*.png) found in '**/font/'. Custom glyphs will not be rendered.");
        }
        for (const fileUri of glyphFiles) {
            const fileName = path.basename(fileUri.fsPath);
            const match = fileName.match(/glyph_E([0-9A-Fa-f])\.png/i);
            if (match && match[1]) {
                const rangePrefixHex = match[1].toUpperCase(); // E.g., '0', '1', 'F'
                const rangeStart = parseInt(`E${rangePrefixHex}00`, 16);
                const rangeEnd = parseInt(`E${rangePrefixHex}FF`, 16);
                const decorationKey = `glyphE${rangePrefixHex}`;
                // Use regex that matches the actual Unicode characters in the range
                const startChar = String.fromCharCode(rangeStart);
                const endChar = String.fromCharCode(rangeEnd);
                const regex = new RegExp(`[${startChar}-${endChar}]`, 'gu');
                (0, logger_1.logInfo)(`Found glyph atlas: ${fileName}, mapping to range U+${rangeStart.toString(16).toUpperCase()} - U+${rangeEnd.toString(16).toUpperCase()}`);
                configs.push({
                    uri: fileUri,
                    rangeStart: rangeStart,
                    rangeEnd: rangeEnd,
                    regex: regex,
                    decorationKey: decorationKey
                });
            }
            else {
                (0, logger_1.logWarn)(`MRT: Found file ${fileName} but could not parse range prefix (E0-EF).`);
            }
        }
    }
    catch (error) {
        (0, logger_1.logError)("MRT: Error searching for glyph files:", error);
    }
    finally {
        isSearchingGlyphs = false;
    }
    // Sort configs by rangeStart for predictable order
    configs.sort((a, b) => a.rangeStart - b.rangeStart);
    cachedGlyphConfigs = configs; // Cache the result
    return configs;
}
// Create or update decoration types based on found glyph files
async function updateDecorationTypes(context) {
    const config = vscode.workspace.getConfiguration("mrt.glyphs");
    const tileSize = config.get("tileSize", 16);
    const glyphConfigs = await findAndCreateGlyphConfigs(context);
    // Dispose old types not in current config
    const currentKeys = new Set(glyphConfigs.map(c => c.decorationKey));
    for (const [key, type] of decorationTypes.entries()) {
        if (!currentKeys.has(key)) {
            type.dispose();
            decorationTypes.delete(key);
            (0, logger_1.logInfo)(`Disposed unused glyph decoration type: ${key}`);
        }
    }
    // Create/update types for current config
    for (const glyphConfig of glyphConfigs) {
        // Dispose existing type if recreating (e.g., tileSize changed)
        if (decorationTypes.has(glyphConfig.decorationKey)) {
            decorationTypes.get(glyphConfig.decorationKey)?.dispose();
        }
        // Revert to original decoration type definition (before backgroundImage attempt)
        const decorationType = vscode.window.createTextEditorDecorationType({
            // Hide the original text character
            textDecoration: "none; font-size: 0px;",
            // Define the space the icon will occupy using "before"
            before: {
                width: `${tileSize}px`,
                height: `${tileSize}px`,
                margin: `0 ${tileSize / 4}px 0 0`,
            },
            // isWholeLine: false, // Ensure it applies inline
        });
        decorationTypes.set(glyphConfig.decorationKey, decorationType);
    }
    (0, logger_1.logInfo)(`Glyph decoration types updated. Found ${glyphConfigs.length} configurations.`);
} // Function to create an SVG data URI for a specific glyph tile using viewBox
function createGlyphSvgDataUri(atlasUri, tileSize, col, row) {
    try {
        // Read the PNG file content
        const pngData = fs.readFileSync(atlasUri.fsPath);
        // Encode PNG data to base64
        const base64Png = pngData.toString("base64");
        // Create a data URI for the PNG
        const pngDataUri = `data:image/png;base64,${base64Png}`;
        // Calculate viewBox values
        const viewBoxX = col * tileSize;
        const viewBoxY = row * tileSize;
        // Create SVG using viewBox to clip the image
        const svg = `<svg width="${tileSize}" height="${tileSize}" viewBox="${viewBoxX} ${viewBoxY} ${tileSize} ${tileSize}" xmlns="http://www.w3.org/2000/svg">` +
            // Use preserveAspectRatio="none" to ensure the selected part fills the SVG
            `<image href="${pngDataUri}" width="256" height="256" preserveAspectRatio="none" />` +
            `</svg>`;
        const base64Svg = Buffer.from(svg).toString("base64");
        return vscode.Uri.parse(`data:image/svg+xml;base64,${base64Svg}`);
    }
    catch (error) {
        (0, logger_1.logError)(`Error creating SVG data URI for ${atlasUri.fsPath}:`, error);
        return null; // Return null if there was an error reading the file or creating the SVG
    }
}
// Apply decorations to the active editor
async function applyDecorations(editor, context) {
    if (!editor || !cachedGlyphConfigs) {
        // If configs haven't been loaded yet, trigger an update
        if (!cachedGlyphConfigs && !isSearchingGlyphs) {
            (0, logger_1.logInfo)("Glyph configs not ready, triggering update...");
            await updateDecorationTypes(context);
        }
        // If still no configs after update, or editor is gone, return
        if (!editor || !cachedGlyphConfigs)
            return;
    }
    const config = vscode.workspace.getConfiguration("mrt.glyphs");
    const tileSize = config.get("tileSize", 16);
    const text = editor.document.getText();
    const decorationsMap = new Map();
    // Initialize map entries for active decoration types
    for (const key of decorationTypes.keys()) {
        decorationsMap.set(key, []);
    }
    // Iterate through the dynamically found glyph configurations
    for (const glyphConfig of cachedGlyphConfigs) {
        if (!decorationTypes.has(glyphConfig.decorationKey))
            continue;
        // const decorationType = decorationTypes.get(glyphConfig.decorationKey)!; // Not needed here
        const currentDecorations = [];
        // const atlasUri = glyphConfig.uri; // Not needed here
        const rangeStart = glyphConfig.rangeStart;
        const regex = glyphConfig.regex;
        let match;
        regex.lastIndex = 0; // Reset regex state for global flag
        let loggedFirstMatch = false;
        while ((match = regex.exec(text)) !== null) {
            // Ensure match[0] is not empty before calculating endPos
            if (match[0].length === 0) {
                regex.lastIndex++; // Prevent infinite loop on zero-length match
                continue;
            }
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            try {
                const charCode = match[0].charCodeAt(0); // Use first char for simplicity
                const glyphIndex = charCode - rangeStart;
                if (glyphIndex >= 0 && glyphIndex < 256) { // Basic check
                    const row = Math.floor(glyphIndex / 16); // Assuming 16 columns
                    const col = glyphIndex % 16;
                    const iconUri = createGlyphSvgDataUri(glyphConfig.uri, tileSize, col, row);
                    // Check if iconUri is null (error occurred during SVG creation)
                    if (!iconUri) {
                        continue; // Skip this glyph if SVG couldn't be created
                    }
                    const decoration = {
                        range,
                        renderOptions: {
                            before: {
                                // Use contentIconPath with the generated SVG data URI
                                contentIconPath: iconUri,
                            }
                        }
                    };
                    currentDecorations.push(decoration);
                    // Log details for the first match found for this config
                    if (!loggedFirstMatch) {
                        (0, logger_1.logInfo)(` -> Match: ${match[0]}, CharCode: ${charCode}, GlyphIndex: ${glyphIndex}, Row: ${row}, Col: ${col}`);
                        (0, logger_1.logInfo)(` -> Applying decoration for key ${glyphConfig.decorationKey} at range ${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`);
                        (0, logger_1.logInfo)(` -> SVG (viewBox): ${iconUri.toString().substring(0, 300)}...`); // Update log message
                        loggedFirstMatch = true;
                    }
                }
                else {
                    (0, logger_1.logWarn)(` -> Match (${match[0]}) charCode ${charCode} out of expected range ${rangeStart}-${rangeStart + 255}`);
                }
            }
            catch (e) {
                (0, logger_1.logError)(` -> Error processing match ${match[0]}: ${e}`);
            }
        }
        // Set decorations for this type
        if (decorationsMap.has(glyphConfig.decorationKey)) {
            decorationsMap.set(glyphConfig.decorationKey, currentDecorations);
        }
        else {
            (0, logger_1.logWarn)(` -> Decoration key ${glyphConfig.decorationKey} not found in decorationsMap during application.`);
        }
    }
    // Apply all decorations
    for (const [key, decorations] of decorationsMap.entries()) {
        const decorationType = decorationTypes.get(key);
        if (decorationType) {
            editor.setDecorations(decorationType, decorations);
        }
    }
}
// Trigger update, debounced
function triggerUpdateDecorations(editor, context) {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
        updateTimeout = undefined;
    }
    updateTimeout = setTimeout(async () => {
        if (editor) {
            // Ensure configs are loaded before applying
            if (!cachedGlyphConfigs && !isSearchingGlyphs) {
                await updateDecorationTypes(context);
            }
            // Apply decorations if editor still exists and configs are loaded
            if (editor && cachedGlyphConfigs) {
                applyDecorations(editor, context);
            }
        }
    }, 250);
}
// Initialize and setup listeners
async function initializeGlyphDecorator(context) {
    // Initial search and setup
    await updateDecorationTypes(context);
    // Apply decorations immediately to the active editor if available after initial setup
    if (vscode.window.activeTextEditor && cachedGlyphConfigs) {
        (0, logger_1.logInfo)("Applying initial decorations to active editor...");
        // Use applyDecorations directly to bypass debounce for the first load
        applyDecorations(vscode.window.activeTextEditor, context);
    }
    // Update when config changes (e.g., tileSize)
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('mrt.glyphs.tileSize')) {
            (0, logger_1.logInfo)("Glyph tileSize configuration changed, updating types...");
            // Re-run the type update which uses the new tileSize
            await updateDecorationTypes(context);
            // Re-apply to active editor immediately
            if (vscode.window.activeTextEditor) {
                triggerUpdateDecorations(vscode.window.activeTextEditor, context);
            }
        }
    }));
    // Update when active editor changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            triggerUpdateDecorations(editor, context);
        }
    }));
    // Update when text changes in active editor
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            triggerUpdateDecorations(vscode.window.activeTextEditor, context);
        }
    }));
    // Re-scan for glyph files if workspace folders change
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        (0, logger_1.logInfo)("Workspace folders changed, re-scanning for glyphs...");
        cachedGlyphConfigs = null; // Clear cache
        await updateDecorationTypes(context);
        if (vscode.window.activeTextEditor) {
            triggerUpdateDecorations(vscode.window.activeTextEditor, context);
        }
    }));
    // TODO: Add FileSystemWatcher for resource_packs/fonts directory?
    // This would allow updates if glyph files are added/removed without reloading.
    // const watcher = vscode.workspace.createFileSystemWatcher('**/resource_packs/fonts/glyph_E*.png');
    // watcher.onDidChange(uri => { console.log(`Glyph file changed: ${uri.fsPath}`); /* Rescan */ });
    // watcher.onDidCreate(uri => { console.log(`Glyph file created: ${uri.fsPath}`); /* Rescan */ });
    // watcher.onDidDelete(uri => { console.log(`Glyph file deleted: ${uri.fsPath}`); /* Rescan */ });
    // context.subscriptions.push(watcher);
    // Initial application for the currently active editor
    if (vscode.window.activeTextEditor) {
        triggerUpdateDecorations(vscode.window.activeTextEditor, context);
    }
}
// Dispose decoration types on deactivation
function disposeGlyphDecorations() {
    for (const type of decorationTypes.values()) {
        type.dispose();
    }
    decorationTypes.clear();
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    cachedGlyphConfigs = null; // Clear cache
    (0, logger_1.logInfo)("Glyph decorations disposed.");
}
//# sourceMappingURL=glyphDecorator.js.map