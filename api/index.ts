import app from '../custom-routes.js';
import { handle } from 'hono/vercel';

export default handle(app);
