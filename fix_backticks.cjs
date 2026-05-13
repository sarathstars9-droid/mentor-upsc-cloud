const fs = require('fs');
let content = fs.readFileSync('src/components/mains/air1Review/Air1ReviewMode.jsx', 'utf8');
content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/mains/air1Review/Air1ReviewMode.jsx', content);
