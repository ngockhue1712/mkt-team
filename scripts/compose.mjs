import {readFile,writeFile} from 'node:fs/promises';
const page=await readFile(new URL('../ui.html',import.meta.url),'utf8');
const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
await writeFile(new URL('../worker/index.js',import.meta.url),'const HTML='+JSON.stringify(page)+';\n'+server);
