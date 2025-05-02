/**
 * Represents a code snippet in the repository
 */
export interface Snippet {
    id: string;
    name: string;
    content: string;
    tags: string[];
    category: string;
}