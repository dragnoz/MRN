# Minecraft Resource Toolkit User Guide

This guide will help you make the most of the Minecraft Resource Toolkit extension features.

## Snippet Repository

### What Is It?
The snippet repository allows you to store, organize, and quickly access frequently used code snippets for Minecraft development. Instead of rewriting the same command blocks, function code, or configuration settings, you can save them once and reuse them with a click.

### Working with Snippets

#### Viewing Snippets
1. Open VS Code with your Minecraft project
2. Look for the "MC Snippet Repository" section in the Explorer sidebar
3. Expand the section to see categories of snippets
4. Click on any snippet to see its details

#### Adding a New Snippet
1. Click the "Add Snippet" button in the MC Snippet Repository header
2. Fill in the required information:
   - Name: A descriptive name for your snippet
   - Content: The actual code or text
   - Category: A group for organization (e.g., "Commands", "Functions", "Resources")
   - Tags: Keywords to help search for this snippet later

#### Searching Snippets
1. Click the "Search Snippets" button in the MC Snippet Repository header
2. Type your search query (it will match against snippet names, content, and tags)
3. Results will update in real-time

#### Using a Snippet
1. Find the snippet you want to use
2. Click on it to copy its content to your clipboard
3. Paste it into your code file

## Scoreboard Objective Tracker

### What Is It?
The scoreboard tracker automatically scans your project files to find all scoreboard objectives used in your Minecraft functions. It shows you where each objective is defined and used, helping you maintain a clean and organized scoreboard system.

### Working with Scoreboard Objectives

#### Viewing Scoreboard Objectives
1. Open VS Code with your Minecraft project
2. Look for the "MC Scoreboard Objectives" section in the Explorer sidebar
3. Expand the section to see all detected objectives
4. For each objective, you'll see:
   - Name: The scoreboard objective name
   - Usage Count: How many times it's referenced in your project
   - Type: The criterion type (if detected)

#### Navigating to Locations
1. Expand any scoreboard objective to see the list of locations where it's used
2. Click on any location to open the file and jump to that line
3. The context of how the objective is used will be displayed

#### Refreshing Scoreboard Objectives
1. Click the "Refresh Scoreboard Objectives" button in the MC Scoreboard Objectives header
2. The extension will rescan your project for updated information

## Tips & Tricks

### Organizing Snippets
- Use consistent categories to group similar snippets
- Add relevant tags to make searching easier
- Include comments in your snippets to explain what they do

### Managing Scoreboards
- Use the objective tracker to find unused objectives that can be cleaned up
- Check for typos in objective names by looking for similar names with low usage counts
- Use the location feature to understand how objectives are used across your project

### Performance
- For large projects, disable the "scan on startup" option in settings
- Manually refresh scoreboard objectives when needed

## Troubleshooting

### Snippets Not Showing
- Check if you have set a custom snippets path in the extension settings
- Verify the extension is activated (look for "Minecraft Development Toolkit is now active!" in the Output panel)

### Scoreboard Objectives Not Detected
- Ensure your files use the `.mcfunction` extension
- Check that your scoreboard commands follow standard Minecraft format
- Try refreshing the objectives manually

### Extension Not Working
- Make sure VS Code is updated to the latest version
- Check the Output panel for any error messages
- Reinstall the extension if necessary

---

For more information or to report issues, visit [https://github.com/dragnoz/Noz-MCkit](https://github.com/dragnoz/Noz-MCkit)