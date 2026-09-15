import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import { runMigration } from './services/migrationService.js';
import { cmsController } from './controllers/cmsController.js';
import { requireAdminAuth } from './middleware/auth.js';
import accountingRoutes from './routes/accountingRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'LetGetIn CMS & CUREMASO Acmaso Accounting API',
    database: 'MongoDB',
    timestamp: new Date(),
  });
});

// CMS Public & Admin Endpoints
app.get('/api/cms/landing-page', cmsController.getLandingPageContent);
app.put('/api/cms/landing-page', requireAdminAuth, cmsController.updateLandingPageContent);
app.post('/api/cms/landing-page/publish', requireAdminAuth, cmsController.publishLandingPageContent);
app.post('/api/cms/upload', requireAdminAuth, upload.single('file'), cmsController.uploadMedia);
app.post('/api/cms/reset', requireAdminAuth, cmsController.resetLandingPageContent);

// Acmaso Accounting Endpoints (Mounted at /api/acmaso and /api)
app.use('/api/acmaso', accountingRoutes);
app.use('/api', accountingRoutes);

// Start Server after connecting to MongoDB
async function startServer() {
  try {
    await connectDB();
    await runMigration();

    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🚀 CUREMASO Admin & CMS Backend API running on port ${PORT}`);
      console.log(`🗄️  Persistent Database: MongoDB`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📄 CMS Landing Page API: http://localhost:${PORT}/api/cms/landing-page`);
      console.log(`📊 Acmaso Accounting API: http://localhost:${PORT}/api/acmaso/dashboard`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error(`💥 Failed to start server: ${err.message}`);
    // Start listener in fallback mode if MongoDB fails to prevent hard downtime
    app.listen(PORT, () => {
      console.warn(`⚠️ Server started on port ${PORT} with DB connection warnings.`);
    });
  }
}

startServer();
