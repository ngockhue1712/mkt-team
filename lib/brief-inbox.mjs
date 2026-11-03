import { createHash } from 'node:crypto';

const departments = new Set(['account', 'strategy', 'content', 'creative', 'performance', 'qa']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBody = 240_000;
const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function readBrief(request) {
  if (Number(request.headers.get('content-length')) > maxBody) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBody) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!data || !uuidPattern.test(data.id) || !['single', 'full'].includes(data.mode)) throw new TypeError();
  if (data.mode === 'single' && !departments.has(data.department)) throw new TypeError();

  function field(source, key, limit) {
    const value = source?.[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) throw new TypeError();
    return value.trim();
  }
  const brief = field(data, 'brief', 12000);
  if (!brief) throw new TypeError();
  return {
    id: data.id.toLowerCase(), mode: data.mode,
    ...(['photo','design','vector'].includes(data.imageMode)?{imageMode:data.imageMode}:{}),
    department: data.mode === 'single' ? data.department : 'account',
    title: field(data, 'title', 150), brief,
    deliverables: field(data, 'deliverables', 4000), deadline: field(data, 'deadline', 10),
    budget: field(data, 'budget', 100), reference: field(data, 'reference', 25000),
    brand: Object.fromEntries(['name','audience','voice','facts','avoid'].map(key =>
      [key, field(data.brand, key, key === 'name' ? 150 : 6000)]))
  };
}

export async function receiveBrief(request, storage) {
  if (request.method !== 'POST') return reply({ error: 'Chỉ hỗ trợ gửi brief.' }, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Nguồn gửi không hợp lệ.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'Cần dữ liệu JSON.' }, 415);
  let brief;
  try {
    brief = await readBrief(request);
  } catch (error) {
    return reply({ error: 'Brief không hợp lệ hoặc quá dài.' }, error instanceof RangeError ? 413 : 400);
  }
  const pathname = 'briefs/' + brief.id + '.json';
  const digest = createHash('sha256').update(JSON.stringify(brief)).digest('hex');
  const receipt = { id: brief.id, receivedAt: new Date().toISOString() };
  try {
    await storage.put(pathname, JSON.stringify({ ...receipt, digest, brief }, null, 2), {
      access: 'private', allowOverwrite: false, addRandomSuffix: false, contentType: 'application/json'
    });
    return reply(receipt, 201);
  } catch {
    // A timed-out response may already have been committed. Reuse the first receipt.
    try {
      const existing = await storage.get(pathname, { access: 'private', useCache: false });
      if (existing?.statusCode === 200) {
        const record = await new Response(existing.stream).json();
        if (record.digest !== digest) return reply({ error: 'Mã order đã được dùng cho brief khác.' }, 409);
        return reply({ id: brief.id, receivedAt: record.receivedAt }, 200);
      }
    } catch { /* Storage is unavailable. Never report acceptance without a receipt. */ }
    return reply({ error: 'Hộp brief tạm thời chưa nhận được yêu cầu. Hãy thử gửi lại.' }, 503);
  }
}
