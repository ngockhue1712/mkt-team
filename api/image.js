import {get} from '@vercel/blob';
import {canAccess} from '../lib/order-access.mjs';
import {readGPTImage} from '../lib/gpt-image.mjs';

export default {fetch:request=>readGPTImage(request,{storage:{get},authorize:canAccess})};
