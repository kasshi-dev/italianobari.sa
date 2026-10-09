import { Hono } from 'hono';
import routes from '../custom-routes.js';

const app = new Hono();

app.get('/api/debug-env', (c) => {
  const url = process.env.DATABASE_URL || '';
  return c.json({
    urlStart: url.slice(0, 14),
    urlHost: url.includes('@') ? 'has-@' : url.slice(0, 45),
    hasToken: !!process.env.TURSO_AUTH_TOKEN,
    tokenLength: (process.env.TURSO_AUTH_TOKEN || '').length,
  });
});

app.route('/api', routes);

export default {
  fetch: app.fetch,
};
