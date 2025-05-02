import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

/**
 * Gets the first workspace folder path or undefined if no workspace is open
 */
export function getWorkspaceFolder(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Ensures a directory exists, creating it if necessary
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        if (!(await exists(dirPath))) {
            await mkdir(dirPath, { recursive: true });
        }
    } catch (error) {
        console.error(`Error creating directory ${dirPath}:`, error);
        throw error;
    }
}

/**
 * Recursively gets all files with the specified extension in a directory
 */
export async function getFilesWithExtension(dir: string, extension: string): Promise<string[]> {
    const results: string[] = [];

    async function recursiveSearch(currentDir: string) {
        try {
            const files = await readdir(currentDir);
            
            for (const file of files) {
                const filePath = path.join(currentDir, file);
                const fileStat = await stat(filePath);
                
                if (fileStat.isDirectory()) {
                    await recursiveSearch(filePath);
                } else if (path.extname(file).toLowerCase() === extension.toLowerCase()) {
                    results.push(filePath);
                }
            }
        } catch (error) {
            console.error(`Error searching directory ${currentDir}:`, error);
        }
    }

    await recursiveSearch(dir);
    return results;
}

/**
 * Reads a file and returns its content as string
 */
export async function readFileContent(filePath: string): Promise<string> {
    try {
        return await readFile(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
}