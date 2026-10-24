const fs = require('fs');
let s = fs.readFileSync('server/src/utils.js', 'utf8');
// Fix the single quote escape: .replace(/'/g, ''') -> .replace(/'/g, '&apos;')
s = s.replace(".replace(/'/g, ''');", ".replace(/'/g, '&apos;');");
fs.writeFileSync('server/src/utils.js', s);
console.log('Fixed');