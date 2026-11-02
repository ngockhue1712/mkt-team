import './compose.mjs';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../public',import.meta.url),{recursive:true});
await copyFile(new URL('../ui.html',import.meta.url),new URL('../public/index.html',import.meta.url));
console.log('Vercel static assets ready; API functions in api/.');
