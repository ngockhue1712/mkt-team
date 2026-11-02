import './compose.mjs';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../public',import.meta.url),{recursive:true});
await mkdir(new URL('../public/assets',import.meta.url),{recursive:true});
await copyFile(new URL('../ui.html',import.meta.url),new URL('../public/index.html',import.meta.url));
await copyFile(new URL('../voxel-office.js',import.meta.url),new URL('../public/assets/voxel-office.js',import.meta.url));
await copyFile(new URL('../voxel-ui.css',import.meta.url),new URL('../public/assets/voxel-ui.css',import.meta.url));
await copyFile(new URL('../office-ui.js',import.meta.url),new URL('../public/assets/office-ui.js',import.meta.url));
console.log('Vercel static assets ready; API functions in api/.');
