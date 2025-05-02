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
exports.getWorkspaceFolder = getWorkspaceFolder;
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.getFilesWithExtension = getFilesWithExtension;
exports.readFileContent = readFileContent;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const readdir = (0, util_1.promisify)(fs.readdir);
const stat = (0, util_1.promisify)(fs.stat);
const readFile = (0, util_1.promisify)(fs.readFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const exists = (0, util_1.promisify)(fs.exists);
/**
 * Gets the first workspace folder path or undefined if no workspace is open
 */
function getWorkspaceFolder() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}
/**
 * Ensures a directory exists, creating it if necessary
 */
async function ensureDirectoryExists(dirPath) {
    try {
        if (!(await exists(dirPath))) {
            await mkdir(dirPath, { recursive: true });
        }
    }
    catch (error) {
        console.error(`Error creating directory ${dirPath}:`, error);
        throw error;
    }
}
/**
 * Recursively gets all files with the specified extension in a directory
 */
async function getFilesWithExtension(dir, extension) {
    const results = [];
    async function recursiveSearch(currentDir) {
        try {
            const files = await readdir(currentDir);
            for (const file of files) {
                const filePath = path.join(currentDir, file);
                const fileStat = await stat(filePath);
                if (fileStat.isDirectory()) {
                    await recursiveSearch(filePath);
                }
                else if (path.extname(file).toLowerCase() === extension.toLowerCase()) {
                    results.push(filePath);
                }
            }
        }
        catch (error) {
            console.error(`Error searching directory ${currentDir}:`, error);
        }
    }
    await recursiveSearch(dir);
    return results;
}
/**
 * Reads a file and returns its content as string
 */
async function readFileContent(filePath) {
    try {
        return await readFile(filePath, 'utf-8');
    }
    catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
}
//# sourceMappingURL=fileSystem.js.map