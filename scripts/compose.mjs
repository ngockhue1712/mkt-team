import {readFile,writeFile} from 'node:fs/promises';
const page=await readFile(new URL('../ui.html',import.meta.url),'utf8');
const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const office=await readFile(new URL('../voxel-office.js',import.meta.url),'utf8');
const style=await readFile(new URL('../voxel-ui.css',import.meta.url),'utf8');
const poster=await readFile(new URL('../lib/poster.mjs',import.meta.url),'utf8');
const officeUI=await readFile(new URL('../office-ui.js',import.meta.url),'utf8');
await writeFile(new URL('../worker/index.js',import.meta.url),'const POSTER_MODULE='+JSON.stringify(poster)+';\nconst HTML='+JSON.stringify(page)+';\nconst OFFICE_JS='+JSON.stringify(office)+';\nconst OFFICE_CSS='+JSON.stringify(style)+';\nconst OFFICE_UI_JS='+JSON.stringify(officeUI)+';\n'+server);
