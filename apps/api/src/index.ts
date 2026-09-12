import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Root Health Route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    system: 'Privacy-Preserving Voting Infrastructure Platform API',
    blockchain: 'MST Blockchain SDK Network Integrated',
    timestamp: new Date().toISOString(),
  });
});

// Mount Main API Router
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Dojo Privacy Voting API Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 REST Endpoint Root: http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
});
