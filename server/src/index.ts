import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { db } from './db';

import authRoute from './routes/auth';
import familyTreesRoute from './routes/family-trees';
import peopleRoute from './routes/people';
import relationshipsRoute from './routes/relationships';
import eventsRoute from './routes/events';
import importRoute from './routes/import';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// API Routes
app.route('/api/auth', authRoute);
app.route('/api/family-trees', familyTreesRoute);
app.route('/api/people', peopleRoute);
app.route('/api/relationships', relationshipsRoute);
app.route('/api/events', eventsRoute);
app.route('/api/import', importRoute);

// Version Endpoint
import pkg from '../package.json';
const packageJson = pkg as unknown as { version: string };
app.get('/api/version', (c) => c.json({
    server: packageJson.version,
    // Start script runs migrations, so db is likely up to date with schema
    environment: process.env.NODE_ENV || 'development'
}));

// Changelog Endpoint
app.get('/api/changelog', async (c) => {
    try {
        const file = Bun.file('CHANGELOG.md');
        if (await file.exists()) {
            return c.text(await file.text());
        }
        return c.text('Changelog not found.');
    } catch (e) {
        return c.text('Error reading changelog.');
    }
});

// Serve static frontend files
// Health Check
app.get('/health', (c) => c.text('OK'));

// Serve static frontend files with Caching
app.use('/*', serveStatic({
    root: './public',
    onFound: (path, c) => {
        // Cache immutable assets (hashed) for 1 year, others for 1 hour
        if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/) && path.includes('assets/')) {
            c.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            c.header('Cache-Control', 'public, max-age=3600');
        }
    }
}));

// Fallback for SPA routing (return index.html for non-API routes)
// Hono's serveStatic handles files, but for SPA we need to serve index.html for 404s on files
// The previous serveStatic creates a handler.
// If file not found, we want to return index.html
app.get('*', serveStatic({ path: './public/index.html' }));

export default {
    port: 3000,
    fetch: app.fetch,
};