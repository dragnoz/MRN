/**
 * Represents a location where a scoreboard objective is used
 */
export interface ScoreboardLocation {
    file: string;
    line: number;
    context?: string;
}

/**
 * Represents a scoreboard objective
 */
export interface Scoreboard {
    name: string;
    type?: string;
    usageCount: number;
    locations: ScoreboardLocation[];
}