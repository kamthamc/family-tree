import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db } from './db';
import { people, relationships } from './db/schema';
import { eq } from 'drizzle-orm';

import peopleRoute from './routes/people';
import relationshipsRoute from './routes/relationships';
import eventsRoute from './routes/events';
import importRoute from './routes/import';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => {
    return c.text('Family Tree API');
});

app.route('/api/people', peopleRoute);
app.route('/api/relationships', relationshipsRoute);
app.route('/api/events', eventsRoute);
app.route('/api/import', importRoute);

export default {
    port: 3000,
    fetch: app.fetch,
};