import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';

import { authRouter } from '../src/server/auth.js';
import { apiRouter } from '../src/server/routes.js';
import { CooperativeDB } from '../src/db/db.js';
import { startBackgroundJobs } from '../src/server/jobs.js';

const app = express();

// Initialize database
CooperativeDB.load();

// IMPORTANT:
// Background jobs are not ideal in serverless functions.
// Only start them if explicitly enabled.
if (process.env.ENABLE_BACKGROUND_JOBS === 'true') {
  startBackgroundJobs();
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

// Uploaded files
const uploadsDir = path.join(process.cwd(), 'uploads');

if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
});

export default app;