# Minecraft Resource Toolkit

A VS Code extension enhancement for Minecraft development that adds a code snippet repository with tagging and a scoreboard objective tracker to the explorer sidebar.

## Features

### 1. Snippet Repository
- Store and organize frequently used code snippets
- Tag snippets with categories (e.g., behavior, animation, functions)
- Search snippets by name, tag, or content
- Copy snippets directly into your editor
- View snippets in a dedicated sidebar view

### 2. Scoreboard Objective Tracker
- Automatically scan and track scoreboard objectives across your project
- Display usage count for each objective
- Navigate to locations where objectives are defined or used
- Automatically update when files change

## Installation

### Option 1: Install from VS Code Marketplace
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Minecraft Resource Toolkit"
4. Click Install

### Option 2: Install from VSIX
1. Download the `minecraft-resource-toolkit-v0.2.1.vsix` file
2. In VS Code, go to Extensions view (Ctrl+Shift+X)
3. Click the "..." menu at the top of the Extensions view
4. Select "Install from VSIX..."
5. Choose the downloaded file

## Usage

### Snippet Repository
- View snippets in the "MC Snippet Repository" section of the Explorer sidebar
- Add new snippets with the "Add Snippet" button in the sidebar
- Search snippets with the "Search Snippets" button
- Copy snippet content by clicking on a snippet

### Scoreboard Objective Tracker
- View scoreboard objectives in the "MC Scoreboard Objectives" section of the Explorer sidebar
- Refresh the list with the "Refresh Scoreboard Objectives" button
- See usage count and type for each objective
- Click on a location to jump to where the objective is used

## Extension Settings

* `minecraftDevToolkit.snippetsPath`: Path to store snippet repository JSON file (defaults to workspace folder)
* `minecraftDevToolkit.scanOnStartup`: Automatically scan for scoreboard objectives when extension activates (defaults to true)

## Development

### Building the Extension
1. Clone the repository
2. Run `npm install` to install dependencies
3. Make changes to the TypeScript source files in `src/`
4. Compile with `npm run compile`
5. Package with `vsce package`

### Project Structure
- `src/`: TypeScript source files
  - `extension.ts`: Main extension entry point
  - `models/`: Data models for snippets and scoreboards
  - `providers/`: Tree data providers for VS Code explorer integration
  - `utils/`: Utility functions for file system and parsing
- `resources/`: Icons and other resources
- `out/`: Compiled JavaScript files

## Release Notes

### 0.2.1
- Added tag support for code snippets
- Implemented a full scoreboard objective tracker
- Added jump-to-location functionality
- Improved UI with custom theme-aware icons
- Enhanced documentation

### 0.2.0
- Initial release
- Basic snippet repository
- Simple scoreboard objective tracking
- Explorer sidebar integration

## License

MIT

---

**Enjoy!**