import * as esbuild from 'esbuild';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

// Only process API handler files (the actual serverless functions)
// Exclude tsconfig.json from glob
const apiFiles = await glob('api/**/*.ts', { ignore: ['**/tsconfig.json'] });

console.log('Building API files:', apiFiles);

// Build each API file - bundle everything including lib/ dependencies
for (const file of apiFiles) {
  const outfile = file.replace('.ts', '.js');

  await esbuild.build({
    entryPoints: [file],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile,
    external: ['@vercel/node'],
    // Ensure lib/ files are bundled into each function
    alias: {
      '@lib': path.resolve('./lib'),
    },
  });

  // Fix the export: Vercel expects module.exports = handler, not exports.default = handler
  let content = fs.readFileSync(outfile, 'utf8');

  // Add a line at the end to re-export default as module.exports
  content += '\n// Vercel compatibility: re-export default as module.exports\nmodule.exports = module.exports.default || module.exports;\n';

  fs.writeFileSync(outfile, content);

  console.log(`Built: ${file} -> ${outfile}`);
}

// Delete .ts files from api/ so Vercel only sees .js files
console.log('Removing .ts files to prevent Vercel from recompiling...');
for (const file of apiFiles) {
  fs.unlinkSync(file);
  console.log(`Deleted: ${file}`);
}

// Also delete api/tsconfig.json as it's no longer needed
const apiTsConfig = 'api/tsconfig.json';
if (fs.existsSync(apiTsConfig)) {
  fs.unlinkSync(apiTsConfig);
  console.log(`Deleted: ${apiTsConfig}`);
}

console.log('API build complete!');
