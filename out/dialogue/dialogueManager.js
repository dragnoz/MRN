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
exports.initializeDialogueFeatures = initializeDialogueFeatures;
// Manages the status bar item and commands for dialogue/language linking
const vscode = __importStar(require("vscode"));
const dialogueHelper_1 = require("./dialogueHelper");
const path = __importStar(require("path"));
let dialogueStatusBarItem;
let currentLangFolderUri;
let currentDialogueFileUri;
// Initialize the status bar item and command handlers
function initializeDialogueFeatures(context) {
    // Create Status Bar Item
    dialogueStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100); // Adjust priority as needed
    dialogueStatusBarItem.command = 'mrt.selectLanguage';
    context.subscriptions.push(dialogueStatusBarItem);
    // Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('mrt.selectLanguage', handleSelectLanguageCommand));
    context.subscriptions.push(vscode.commands.registerCommand('mrt.createNewLanguage', handleCreateNewLanguageCommand));
    // Update status bar on active editor change
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
    // Initial status bar update
    updateStatusBar(vscode.window.activeTextEditor);
}
// Update the status bar based on the active editor
async function updateStatusBar(editor) {
    if (editor && (0, dialogueHelper_1.isDialogueFile)(editor.document.uri)) {
        currentDialogueFileUri = editor.document.uri;
        currentLangFolderUri = await (0, dialogueHelper_1.findLanguageFolderUri)(currentDialogueFileUri);
        if (currentLangFolderUri) {
            // Try to find the default language file first
            const defaultLangUri = await (0, dialogueHelper_1.getDefaultLanguageFileUri)(currentLangFolderUri);
            if (defaultLangUri) {
                const langCode = path.basename(defaultLangUri.fsPath, '.lang');
                dialogueStatusBarItem.text = `$(book) Lang: ${langCode}`;
                dialogueStatusBarItem.tooltip = `Click to select language file (currently ${langCode})`;
                dialogueStatusBarItem.show();
                // Optionally open default lang file automatically?
                // await openLanguageFileBeside(defaultLangUri);
            }
            else {
                dialogueStatusBarItem.text = `$(book) Select Lang`;
                dialogueStatusBarItem.tooltip = `Click to select or create language file`;
                dialogueStatusBarItem.show();
            }
        }
        else {
            // Dialogue file, but couldn't find language folder
            dialogueStatusBarItem.text = `$(warning) Lang Folder?`;
            dialogueStatusBarItem.tooltip = `Could not find language folder ('${vscode.workspace.getConfiguration('mrt.dialogue').get('languageFolderName')}')`;
            dialogueStatusBarItem.show();
        }
    }
    else {
        // Not a dialogue file, hide status bar item
        currentDialogueFileUri = undefined;
        currentLangFolderUri = undefined;
        dialogueStatusBarItem.hide();
    }
}
// Command handler for selecting a language
async function handleSelectLanguageCommand() {
    if (!currentLangFolderUri) {
        vscode.window.showWarningMessage("Cannot select language: Language folder not found.");
        return;
    }
    const availableLangs = await (0, dialogueHelper_1.findAvailableLanguages)(currentLangFolderUri);
    const langItems = availableLangs.map(lang => ({
        label: lang.code,
        description: path.basename(lang.uri.fsPath),
        uri: lang.uri
    }));
    // Add option to create new
    langItems.push({ label: "$(add) Create New Language File...", createNew: true });
    const selected = await vscode.window.showQuickPick(langItems, {
        placeHolder: "Select a language file to open or create a new one"
    });
    if (selected) {
        if (selected.createNew) {
            // Trigger the create new command
            await vscode.commands.executeCommand('mrt.createNewLanguage');
        }
        else if (selected.uri) {
            // Open the selected language file
            await (0, dialogueHelper_1.openLanguageFileBeside)(selected.uri);
            // Update status bar text after opening
            dialogueStatusBarItem.text = `$(book) Lang: ${selected.label}`;
            dialogueStatusBarItem.tooltip = `Click to select language file (currently ${selected.label})`;
        }
    }
}
// Command handler for creating a new language file
async function handleCreateNewLanguageCommand() {
    if (!currentLangFolderUri) {
        vscode.window.showWarningMessage("Cannot create language file: Language folder not found.");
        return;
    }
    const newLangCode = await vscode.window.showInputBox({
        prompt: "Enter the new language code (e.g., fr_FR, es_ES)",
        placeHolder: "xx_YY",
        validateInput: input => {
            // Basic validation: should contain underscore and not be empty
            return input && input.includes('_') ? null : "Invalid language code format (should be xx_YY)";
        }
    });
    if (!newLangCode) {
        return; // User cancelled
    }
    const newFilePath = vscode.Uri.joinPath(currentLangFolderUri, `${newLangCode}.lang`);
    // Check if file already exists
    try {
        await vscode.workspace.fs.stat(newFilePath);
        vscode.window.showErrorMessage(`Language file '${newLangCode}.lang' already exists.`);
        return;
    }
    catch (e) { /* File does not exist, proceed */ }
    // --- Create the file --- 
    let initialContent = `# Language file for ${newLangCode}\n`;
    // Optionally copy keys from default language file
    const copyKeys = await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: "Copy keys from default language file?"
    });
    if (copyKeys === "Yes") {
        const defaultLangUri = await (0, dialogueHelper_1.getDefaultLanguageFileUri)(currentLangFolderUri);
        if (defaultLangUri) {
            try {
                const defaultContentBytes = await vscode.workspace.fs.readFile(defaultLangUri);
                const defaultContent = Buffer.from(defaultContentBytes).toString('utf-8');
                const lines = defaultContent.split('\n');
                lines.forEach(line => {
                    const uncommentedLine = line.split('#')[0].trim();
                    if (uncommentedLine.includes('=')) {
                        const key = uncommentedLine.split('=')[0].trim();
                        if (key) {
                            initialContent += `${key}=\n`; // Add key with empty value
                        }
                    }
                });
            }
            catch (error) {
                console.error("Failed to read default language file for keys:", error);
                initialContent += "# Failed to copy keys from default language file.\n";
            }
        }
        else {
            initialContent += "# Default language file not found to copy keys from.\n";
        }
    }
    try {
        // Write the new file
        await vscode.workspace.fs.writeFile(newFilePath, Buffer.from(initialContent, 'utf-8'));
        // Open the new file beside the dialogue file
        await (0, dialogueHelper_1.openLanguageFileBeside)(newFilePath);
        // Update status bar
        dialogueStatusBarItem.text = `$(book) Lang: ${newLangCode}`;
        dialogueStatusBarItem.tooltip = `Click to select language file (currently ${newLangCode})`;
    }
    catch (error) {
        console.error(`Error creating language file ${newFilePath.fsPath}:`, error);
        vscode.window.showErrorMessage(`Failed to create language file: ${newLangCode}.lang`);
    }
}
//# sourceMappingURL=dialogueManager.js.map