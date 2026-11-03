import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, stat, statfs, open, unlink } from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';

const repository = 'Qwen/Qwen2.5-1.5B-Instruct-GGUF';
const filename = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';
let loadPromise;
let active = false;

let memoryWeights;
async function memoryFile(){
  const child=spawn(fileURLToPath(new URL('./memfile',import.meta.url)),[],{stdio:['pipe','pipe','inherit']});
  const lines=createInterface({input:child.stdout});
  try {
    const descriptor=await new Promise((resolve,reject)=>{
      lines.once('line',resolve);child.once('error',reject);
      child.once('exit',()=>reject(Error('memory_file_unavailable')));
    });
    if(!/^\d+$/.test(descriptor))throw Error('invalid_memory_file');
    return await open('/proc/'+child.pid+'/fd/'+descriptor,'r+');
  }finally{lines.close();child.stdin.end();}
}
async function weights() {
  const metadata = await fetch('https://huggingface.co/api/models/' + repository + '?blobs=true', {signal:AbortSignal.timeout(20000)});
  if (!metadata.ok) throw Error('model_catalog_' + metadata.status);
  const manifest = await metadata.json();
  const file = manifest.siblings?.find(s => s.rfilename.toLowerCase() === filename);
  if (!file || !/^[a-f0-9]{40}$/.test(manifest.sha) || !/^[a-f0-9]{64}$/.test(file.lfs?.sha256 || '') || file.size > 1300000000) throw Error('model_manifest');
  const path = '/tmp/mkt-' + file.lfs.sha256 + '.gguf';
  if ((await stat(path).catch(()=>null))?.size === file.size) return path;
  const response = await fetch('https://huggingface.co/' + repository + '/resolve/' + manifest.sha + '/' + file.rfilename + '?download=true', {signal:AbortSignal.timeout(100000)});
  if (!response.ok || !response.body) throw Error('model_download_' + response.status);
  const space=await statfs('/tmp');
  if(space.bavail*space.bsize < file.size+20000000){
    const handle=await memoryFile();
    try{
      const hash=createHash('sha256');let bytes=0;
      for await(const chunk of response.body){
        bytes+=chunk.length;if(bytes>file.size)throw Error('model_size');
        hash.update(chunk);
        let offset=0;
        while(offset<chunk.length){const part=await handle.write(chunk,offset,chunk.length-offset);offset+=part.bytesWritten;}
      }
      if(bytes!==file.size || hash.digest('hex')!==file.lfs.sha256)throw Error('model_checksum');
      memoryWeights=handle;
      return '/proc/self/fd/'+memoryWeights.fd;
    }catch(error){await handle.close();throw error;}
  }
  const hash = createHash('sha256');
  let bytes = 0;
  const check = new Transform({transform(chunk, encoding, done) {
    bytes += chunk.length;
    if (bytes > file.size) return done(Error('model_size'));
    hash.update(chunk);
    done(null,chunk);
  }});
  try {
    await pipeline(Readable.fromWeb(response.body),check,createWriteStream(path + '.part'));
    if (bytes !== file.size || hash.digest('hex') !== file.lfs.sha256) throw Error('model_checksum');
    await rename(path + '.part',path);
    return path;
  } catch (error) {
    await unlink(path + '.part').catch(()=>{});
    throw error;
  }
}

async function loadEngine() {
  const {getLlama, LlamaChatSession} = await import('node-llama-cpp');
  const llama = await getLlama({gpu:false,build:'never',skipDownload:true, usePrebuiltBinaries:true,maxThreads:1,progressLogs:false,debug:false});
  const modelPath=await weights();
  const model=await llama.loadModel({modelPath,gpuLayers:0,useMmap:true});
  console.info('office_engine_ready');
  return {llama, model, LlamaChatSession};
}

export async function writeWithModel({system,prompt,schema,grammarSource,maxTokens=800,deadline=Infinity}) {
  if (active) throw Error('engine_busy');
  active = true;
  let context;
  const start=Date.now();let chunks=0;
  try {
    loadPromise ??= loadEngine().catch(err=>{loadPromise=undefined;throw err;});
    const {llama,model,LlamaChatSession} = await loadPromise;
    context = await model.createContext({contextSize:3072,batchSize:256,sequences:1,threads:1});
    const session = new LlamaChatSession({contextSequence:context.getSequence(),systemPrompt:system});
    const grammar = grammarSource ? await llama.createGrammar({grammar:grammarSource}) : schema ? await llama.createGrammarForJsonSchema(schema) : undefined;
    const allowance=context.contextSize-maxTokens-260-model.tokenize(system).length;
    const tokens=model.tokenize(prompt);
    if(tokens.length>allowance){
      const keep=Math.floor(allowance*0.56);
      prompt=model.detokenize(tokens.slice(0,keep))+'\n…\n'+model.detokenize(tokens.slice(-(allowance-keep-16)));
    }
    const output = await session.prompt(prompt, {maxTokens,grammar,temperature:0.45,
      repeatPenalty:{lastTokens:96,penalty:1.15},signal:AbortSignal.timeout(Math.max(2000,Math.min(deadline-Date.now(),245000-(Date.now()-start)))),
      onTextChunk(){if(++chunks===1 || chunks%96===0)console.info('office_inference_progress',chunks,Date.now()-start);}
    });
    console.info('office_inference_done',chunks,Date.now()-start);
    if (!output.trim()) throw Error('empty_generation');
    return output.trim();
  } finally {
    try { if (context) await context.dispose(); } finally { active=false; }
  }
}
