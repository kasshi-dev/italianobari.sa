import app from '../custom-routes';
import { handle } from 'hono/vercel';

export default handle(app);
