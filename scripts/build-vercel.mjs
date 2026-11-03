import './build-model-helper.mjs';
import './compose.mjs';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
await mkdir(new URL('../public',import.meta.url),{recursive:true});
await mkdir(new URL('../public/assets',import.meta.url),{recursive:true});
const page = await readFile(new URL('../ui.html',import.meta.url),'utf8');
const publicPage = page.replace('<html lang="vi">', '<html lang="vi" data-brief-inbox="remote">')
  .replace(/<button class="connection" id="connect">.*?<\/button>/,
    '<span class="connection" role="status"><span class="dot ok" id="connectionDot"></span><span id="connectionLabel">Agency tự chạy</span></span>');
await writeFile(new URL('../public/index.html',import.meta.url), publicPage);
await copyFile(new URL('../voxel-office.js',import.meta.url),new URL('../public/assets/voxel-office.js',import.meta.url));
await copyFile(new URL('../voxel-ui.css',import.meta.url),new URL('../public/assets/voxel-ui.css',import.meta.url));
await copyFile(new URL('../office-ui.js',import.meta.url),new URL('../public/assets/office-ui.js',import.meta.url));
console.log('Vercel static assets ready; API functions in api/.');
