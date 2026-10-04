/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

import { authRouter } from './src/server/auth.js';
import { apiRouter } from './src/server/routes.js';
import { CooperativeDB } from './src/db/db.js';
import { startBackgroundJobs } from './src/server/jobs.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB immediately
  CooperativeDB.load();
  startBackgroundJobs();



  // Middleware for body-parsing
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logger for audit convenience
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // REST API Routes
  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);

  // Serve uploaded files statically
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running in DEVELOPMENT mode. Mounting Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running in PRODUCTION mode. Serving static assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`Cooperative Management System is ONLINE on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal: Failed to start server:', err);
  process.exit(1);
});
