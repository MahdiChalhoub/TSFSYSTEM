const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(findFiles(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = findFiles('src');

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.match(/<Plus/g)) {
        // check if Plus is imported
        if (!content.match(/import\s+{([^}]*?)}\s+from\s+['"]lucide-(react|vue-next|solid)['"]/g)?.some(match => /\bPlus\b/.test(match))) {
            console.log("Fixing missing Plus import in " + file);
            // Replace lucide react import
            if (content.includes("lucide-react")) {
                content = content.replace(/import\s+{([^}]*?)}\s+from\s+['"]lucide-react['"]/, (match, p1) => {
                    return `import { Plus, ${p1} } from "lucide-react"`;
                });
            } else {
                content = `import { Plus } from "lucide-react";\n` + content;
            }
            fs.writeFileSync(file, content);
        }
    }
}
