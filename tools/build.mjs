// Bundles src/ into two single files: index.html (a complete page, for GitHub Pages) and dist/artifact.html (the
// same page without the document shell, for hosts that add their own).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const out = await build({ entryPoints: [root + 'src/main.js'], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2020', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const tpl = readFileSync(root + 'src/index.template.html', 'utf8');
const cut = tpl.indexOf('</style>') + '</style>'.length;   // everything up to here belongs in <head>
const head = tpl.slice(0, cut), rest = tpl.slice(cut).replace('/*__BUNDLE__*/', () => js), body = head + rest;
writeFileSync(root + 'index.html', `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n${head}\n</head>\n<body>${rest}</body>\n</html>\n`);
mkdirSync(root + 'dist', { recursive: true });
writeFileSync(root + 'dist/artifact.html', body);
console.log(`index.html ${(body.length / 1024).toFixed(0)} kB`);
