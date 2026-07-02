const fs = require('fs');

const contentPath = 'C:\\Users\\carlo\\.gemini\\antigravity\\brain\\6461a7be-7f24-4f11-a343-f14b13c2eac2\\.system_generated\\steps\\1800\\content.md';
const content = fs.readFileSync(contentPath, 'utf8');

const jsonStart = content.indexOf('{');
const jsonStr = content.substring(jsonStart);
const data = JSON.parse(jsonStr);

console.log('--- CREATE INSTANCE ENDPOINT ---');
console.log(JSON.stringify(data.paths['/instance/create'], null, 2));

console.log('--- DEFINITIONS ---');
const schemaRef = data.paths['/instance/create'].post.parameters[0].schema.$ref;
const defName = schemaRef.split('/').pop();
console.log(defName, JSON.stringify(data.definitions[defName], null, 2));
