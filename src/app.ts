import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { testConnection } from './db/db.client';
import { errorHandler, notFoundHandler } from './core/middleware/error.handler';

// Routers
import authRouter from './auth/auth.router';
import hrmsRouter from './sample-routes/hrms.router';
import attendanceRouter from './sample-routes/attendance.router';
import crmRouter from './sample-routes/crm.router';
import trackingRouter from './sample-routes/tracking.router';
import salesRouter from './sample-routes/sales.router';
import departmentRouter from './sample-routes/department.router';
import platformRouter from './sample-routes/platform.router';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Global Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'davandee-auth-rbac',
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth Routes (public + protected) ────────────────────────────
app.use('/auth', authRouter);

// ─── Org-Scoped Sample Routes ────────────────────────────────────
// All routes below follow the pattern: /orgs/:orgId/<module>/...
// The tenantGuard middleware validates orgId against the JWT
app.use('/', hrmsRouter);
app.use('/', attendanceRouter);
app.use('/', crmRouter);
app.use('/', trackingRouter);
app.use('/', salesRouter);
app.use('/', departmentRouter);

// ─── Platform Routes (superadmin / superadmin_team only) ─────────
app.use('/', platformRouter);

// ─── Error Handling ──────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Process-Level Crash Guards ─────────────────────────────────
process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION — keeping server alive:', err);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('UNHANDLED REJECTION — keeping server alive:', reason);
});

// ─── Server Startup ──────────────────────────────────────────────
async function startServer() {
  try {
    await testConnection();

    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════════════╗`);
      console.log(`║  Davandee HRMS — Auth + RBAC Server              ║`);
      console.log(`║  http://localhost:${PORT}                           ║`);
      console.log(`║  JWT: RS256 (asymmetric)                         ║`);
      console.log(`║  DB: PostgreSQL                                  ║`);
      console.log(`╚══════════════════════════════════════════════════╝\n`);
    });
  } catch (error: any) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
