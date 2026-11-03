import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.platform==='linux'){
  execFileSync('cc',['-O2','-Wall','-Werror',fileURLToPath(new URL('../lib/memfile.c',import.meta.url)),'-o',fileURLToPath(new URL('../lib/memfile',import.meta.url))],{stdio:'inherit'});
}
