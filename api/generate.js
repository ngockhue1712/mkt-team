import worker from '../worker/index.js';
// Public Vercel deployment uses each visitor's key; never exposes an owner-funded API.
export default { fetch(request) { return worker.fetch(request, {}); } };
