"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScoreboardObjectives = parseScoreboardObjectives;
/**
 * Parses a Minecraft function file to find scoreboard objectives
 *
 * @param content The content of the file to parse
 * @param filePath The path to the file being parsed
 * @returns Array of scoreboard objectives found in the file
 */
function parseScoreboardObjectives(content, filePath) {
    // Map to store unique scoreboards
    const scoreboardMap = new Map();
    // Split content into lines for better context tracking
    const lines = content.split('\n');
    // Regular expressions for different scoreboard patterns
    const addPattern = /scoreboard\s+objectives\s+add\s+([A-Za-z0-9._-]+)\s+([A-Za-z0-9._-]+)(?:\s+(?:"|')(.+)(?:"|'))?/;
    const removePattern = /scoreboard\s+objectives\s+remove\s+([A-Za-z0-9._-]+)/;
    const setDisplayPattern = /scoreboard\s+objectives\s+setdisplay\s+[A-Za-z0-9._-]+\s+([A-Za-z0-9._-]+)/;
    const modifyPattern = /scoreboard\s+players\s+(?:set|add|remove|reset|enable|operation)\s+[^"]*\s+([A-Za-z0-9._-]+)/;
    // Process each line in the file
    lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
            return;
        }
        // Check for objective add command
        const addMatch = trimmedLine.match(addPattern);
        if (addMatch) {
            const [, name, type, displayName] = addMatch;
            updateScoreboard(name, lineIndex, line, type);
            return;
        }
        // Check for objectives being referenced in other commands
        [removePattern, setDisplayPattern, modifyPattern].forEach(pattern => {
            const match = trimmedLine.match(pattern);
            if (match && match[1]) {
                updateScoreboard(match[1], lineIndex, line);
            }
        });
    });
    function updateScoreboard(name, lineIndex, context, type) {
        if (scoreboardMap.has(name)) {
            // Update existing scoreboard
            const scoreboard = scoreboardMap.get(name);
            scoreboard.usageCount++;
            scoreboard.locations.push({
                file: filePath,
                line: lineIndex,
                context: context.trim()
            });
            // If we've found the type and didn't have it before
            if (type && !scoreboard.type) {
                scoreboard.type = type;
            }
        }
        else {
            // Create new scoreboard
            const scoreboard = {
                name,
                type,
                usageCount: 1,
                locations: [{
                        file: filePath,
                        line: lineIndex,
                        context: context.trim()
                    }]
            };
            scoreboardMap.set(name, scoreboard);
        }
    }
    // Convert map to array and return
    return Array.from(scoreboardMap.values());
}
//# sourceMappingURL=parser.js.map