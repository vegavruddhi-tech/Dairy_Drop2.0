import fs from 'fs';
import path from 'path';

const srcDir = 'C:\\Users\\prasa\\.gemini\\antigravity-ide\\brain\\84b21e1e-d0a4-4069-8202-8c90df5e9bf6';
const destDir = 'e:\\Dairy_Drop2.0\\next-app\\public\\products';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const map = {
  'product_paneer': 'paneer.jpg',
  'product_ghee': 'ghee.jpg',
  'product_dahi': 'dahi.jpg',
  'product_butter': 'butter.jpg',
  'product_chaas': 'chaas.jpg',
  'product_malai': 'malai.jpg',
  'product_lassi': 'lassi.jpg',
};

const files = fs.readdirSync(srcDir);
for (const [prefix, target] of Object.entries(map)) {
  const match = files.find(f => f.startsWith(prefix) && f.endsWith('.jpg'));
  if (match) {
    fs.copyFileSync(path.join(srcDir, match), path.join(destDir, target));
    console.log(`Copied ${match} -> ${target}`);
  }
}
console.log('Done copying product images.');
