import app from '../custom-routes';
import { handle } from '@hono/node-server/vercel';

export default handle(app);
