const fs = require('fs');
const path = require('path');

function copyFolder(src, dest) {
  try {
    if (fs.existsSync(src)) {
      const parent = path.dirname(dest);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }
      fs.cpSync(src, dest, { recursive: true });
      console.log(`Successfully copied ${src} to ${dest}`);
    } else {
      console.log(`Source does not exist: ${src}`);
    }
  } catch (err) {
    console.error(`Error copying ${src} to ${dest}:`, err);
    process.exit(1);
  }
}

copyFolder('.next/static', '.next/standalone/.next/static');
copyFolder('public', '.next/standalone/public');
