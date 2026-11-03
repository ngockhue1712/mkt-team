import { get, put } from '@vercel/blob';
import { receiveBrief } from '../lib/brief-inbox.mjs';

export default { fetch(request) { return receiveBrief(request, { get, put }); } };
