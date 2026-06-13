import path from 'path';
import dotenv from 'dotenv';
// Explicitly target root .env file at the top
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import bookingsRouter from './routes/bookings.js';
import trackingRouter from './routes/tracking.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS for all incoming origins (frontend dev port)
app.use(cors({
  origin: ['http://localhost:5173', '*'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Allow larger image base64 payloads

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} - Received at ${new Date().toISOString()}`);
  next();
});

// Mounting routers
app.use('/api', bookingsRouter);
app.use('/api/v1/freight', bookingsRouter);

// Mounting tracking router
app.use('/api/tracking', trackingRouter);
app.use('/api/v1/freight/tracking', trackingRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Leonics Multimodal Core Engine Server Running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📂 Environment: Node.js Express (Root .env loaded)`);
  console.log(`===================================================`);
});
