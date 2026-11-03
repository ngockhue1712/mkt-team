import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, stat, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';

const repository = 'Qwen/Qwen2.5-0.5B-Instruct-GGUF';
const filename = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';
let loadPromise;
let active = false;

async function weights() {
  const metadata = await fetch('https://huggingface.co/api/models/' + repository + '?blobs=true', {signal:AbortSignal.timeout(20000)});
  if (!metadata.ok) throw Error('model_catalog_' + metadata.status);
  const manifest = await metadata.json();
  const file = manifest.siblings?.find(s => s.rfilename.toLowerCase() === filename);
  if (!file || !/^[a-f0-9]{40}$/.test(manifest.sha) || !/^[a-f0-9]{64}$/.test(file.lfs?.sha256 || '') || file.size > 500000000) throw Error('model_manifest');
  const path = '/tmp/mkt-' + file.lfs.sha256 + '.gguf';
  if ((await stat(path).catch(()=>null))?.size === file.size) return path;
  const response = await fetch('https://huggingface.co/' + repository + '/resolve/' + manifest.sha + '/' + file.rfilename + '?download=true', {signal:AbortSignal.timeout(100000)});
  if (!response.ok || !response.body) throw Error('model_download_' + response.status);
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
  const llama = await getLlama({gpu:false,build:'never',skipDownload:true, usePrebuiltBinaries:true,progressLogs:false,debug:false});
  const model = await llama.loadModel({modelPath:await weights(),gpuLayers:0,useMmap:true});
  return {llama, model, LlamaChatSession};
}

export async function writeWithModel({system,prompt,schema,maxTokens=800}) {
  if (active) throw Error('engine_busy');
  active = true;
  let context;
  try {
    loadPromise ??= loadEngine().catch(err=>{loadPromise=undefined;throw err;});
    const {llama,model,LlamaChatSession} = await loadPromise;
    context = await model.createContext({contextSize:4096,batchSize:128,sequences:1,threads:2});
    const session = new LlamaChatSession({contextSequence:context.getSequence(),systemPrompt:system});
    const grammar = schema ? await llama.createGrammarForJsonSchema(schema) : undefined;
    const output = await session.prompt(prompt, {maxTokens,grammar,temperature:schema?0.25:0.55,repeatPenalty:{lastTokens:96,penalty:1.12},signal:AbortSignal.timeout(142000)});
    if (!output.trim()) throw Error('empty_generation');
    return output.trim();
  } finally {
    try { if (context) await context.dispose(); } finally { active=false; }
  }
}
