// Free AI that runs on this device (WebLLM + WebGPU). Nothing you say leaves your iPad.
// The model is downloaded once (from Hugging Face) and then kept in the browser's storage.

export const LOCAL_MODELS = {
  quick: { name: 'Quick', size: '0.9 GB', f16: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', f32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', note: 'Works on most recent iPads' },
  smart: { name: 'Smarter', size: '2.3 GB', f16: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', f32: 'Llama-3.2-3B-Instruct-q4f32_1-MLC', note: 'Best on iPads with an M1 chip or newer' },
};

let lib = null, engine = null, engineModel = null, loading = null, f16 = null;

export async function webgpuInfo() {
  if (!navigator.gpu) return { ok: false, why: 'This browser does not support WebGPU yet. On iPad you need iPadOS 26 or newer.' };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, why: 'No graphics chip available for AI on this device.' };
    f16 = adapter.features.has('shader-f16');
    return { ok: true, f16 };
  } catch (e) {
    return { ok: false, why: 'WebGPU could not start: ' + e.message };
  }
}

async function getLib() {
  if (!lib) lib = await import('../vendor/web-llm.js');
  return lib;
}

export async function modelIdFor(size) {
  if (f16 === null) await webgpuInfo();
  const m = LOCAL_MODELS[size] || LOCAL_MODELS.quick;
  return f16 ? m.f16 : m.f32;
}

export async function isDownloaded(size) {
  try {
    const l = await getLib();
    return await l.hasModelInCache(await modelIdFor(size));
  } catch (e) { return false; }
}

// Load (and if needed download) the model. onProgress gets { progress: 0..1, text }.
export async function load(size, onProgress = () => {}) {
  const id = await modelIdFor(size);
  if (engine && engineModel === id) return engine;
  if (loading) return loading;
  loading = (async () => {
    const l = await getLib();
    navigator.storage?.persist?.().catch(() => {});
    if (engine) { try { await engine.unload(); } catch (e) { /* ignore */ } engine = null; }
    const worker = new Worker(new URL('../vendor/web-llm-worker.js', import.meta.url), { type: 'module' });
    engine = await l.CreateWebWorkerMLCEngine(worker, id, { initProgressCallback: r => onProgress({ progress: r.progress ?? 0, text: r.text || '' }) });
    engineModel = id;
    return engine;
  })();
  try { return await loading; } finally { loading = null; }
}

export const isReady = () => !!engine;

export async function remove(size) {
  const l = await getLib();
  const id = await modelIdFor(size);
  if (engine && engineModel === id) { try { await engine.unload(); } catch (e) { /* ignore */ } engine = null; engineModel = null; }
  await l.deleteModelAllInfoInCache(id);
}

// Stream a reply. messages = [{ role: 'system' | 'user' | 'assistant', content }]
export async function chatStream(size, messages, onText) {
  const e = await load(size);
  const chunks = await e.chat.completions.create({ messages, stream: true, temperature: 0.7, max_tokens: 400 });
  let text = '';
  for await (const c of chunks) {
    const d = c.choices[0]?.delta?.content || '';
    if (d) { text += d; onText(d); }
  }
  return text;
}

// Ask for JSON that follows a schema.
export async function json(size, messages, schema) {
  const e = await load(size);
  const r = await e.chat.completions.create({
    messages, temperature: 0.4, max_tokens: 900,
    response_format: { type: 'json_object', schema: JSON.stringify(schema) },
  });
  const raw = r.choices[0]?.message?.content || '';
  return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
}
