# VS Code Extension Installation Help

This guide provides step-by-step instructions for properly building and installing the Minecraft Resource Toolkit VS Code extension from source.

## Prerequisites

1. Install Node.js and npm (Node Package Manager)
2. Install the required development tools:
   ```bash
   npm install -g @vscode/vsce typescript
   ```

## Building the Extension from Source

1. Extract the source code archive (`mrn-v0.2.2-src.zip`) to a folder (e.g., `mrn-v0.2.2-src`)
2. Navigate to the extracted directory
3. Create a new directory for the extension:
   ```bash
   mkdir mrn
   cd mrn
   ```
4. Initialize a new npm project:
   ```bash
   npm init -y
   ```
5. Install required dependencies:
   ```bash
   npm install --save-dev @types/vscode @types/node typescript
   ```
6. Copy the source files from the parent directory:
   ```bash
   cp -r ../src ./
   cp -r ../resources ./
   cp ../manifest.json ./package.json
   cp ../README.md ./
   cp ../CHANGELOG.md ./
   cp ../GUIDE_FOR_USERS.md ./
   ```
7. Create a tsconfig.json file:
   ```bash
   # Create tsconfig.json file
   echo '{
     "compilerOptions": {
       "module": "commonjs",
       "target": "ES2020",
       "outDir": "out",
       "lib": ["ES2020"],
       "sourceMap": true,
       "rootDir": "src",
       "strict": true,
       "esModuleInterop": true,
       "resolveJsonModule": true
     },
     "exclude": ["node_modules", ".vscode-test"]
   }' > tsconfig.json
   ```
8. Compile the TypeScript code:
   ```bash
   tsc -p ./
   ```
9. Package the extension:
   ```bash
   vsce package
   ```

This will create a `.vsix` file that you can install in VS Code.

## Installing the Extension

1. Open VS Code
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window
3. Click on the "..." menu at the top of the Extensions view
4. Select "Install from VSIX..."
5. Navigate to the `.vsix` file you created
6. Click "Install"

## Troubleshooting

### Error: Cannot find tsconfig.json

If you get an error saying "Cannot find a tsconfig.json file", make sure you've created the tsconfig.json file as outlined in step 7 above.

### Error: Cannot find module

If you encounter "Cannot find module" errors during compilation, ensure all dependencies are correctly installed:

```bash
npm install
```

### Error during packaging

If `vsce package` fails, check that your package.json (copied from manifest.json) has all required fields:
- name
- displayName
- version
- publisher (you may need to add this field)
- engines (with vscode version)
- main (should point to "out/extension.js")
- activationEvents
- contributes section

## Additional Resources

- [VS Code Extension Development](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)