const fs = require('fs');
const path = require('path');

const contentPath = 'C:\\Users\\carlo\\.gemini\\antigravity\\brain\\6461a7be-7f24-4f11-a343-f14b13c2eac2\\.system_generated\\steps\\1800\\content.md';
const content = fs.readFileSync(contentPath, 'utf8');

// The markdown file contains some header text and then the JSON.
// Let's find the JSON start:
const jsonStart = content.indexOf('{');
const jsonStr = content.substring(jsonStart);
const data = JSON.parse(jsonStr);

console.log('--- ALL SWAGGER ENDPOINTS ---');
const paths = Object.keys(data.paths);
paths.forEach(p => {
    if (p.includes('/instance')) {
        console.log(p, Object.keys(data.paths[p]));
    }
});
