function parseMarkdownTablesToGrid(markdown) {
    const lines = markdown.split('\n');
    let grid = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
            
            // Skip markdown separator lines like |---|---|
            if (cells.every(c => c.replace(/-/g, '').trim() === '')) {
                continue;
            }
            grid.push(cells);
        }
    }
    
    return grid;
}

const md = `
Some text
| Name | Age |
|---|---|
| Alice | 30 |
| Bob | 25 |
More text
`;

console.log(parseMarkdownTablesToGrid(md));
