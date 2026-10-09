import { Hono } from 'hono';
import routes from '../custom-routes.js';

const app = new Hono();
app.route('/api', routes);

export default {
  fetch: app.fetch,
};
