import express from 'express';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config.js';
import { logger } from './utils/logger.js';
import chatRoutes from './routes/chat.js';
import ogpRouter from './routes/ogp.js';
// Node.jsのpathモジュールをインポート
import path from 'path'; 
// ES Module環境で__dirnameを再現するためにインポート
import { fileURLToPath } from 'url'; 


// Create Express app
const app = express();

// ES Module環境で__dirnameを取得する
const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename); 


// Middleware
app.use(express.json());
app.use(cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 生成した画像を Frontend が取得できるように、特定のディレクトリを静的ファイルとしてホストする設定 
// 例: /generated_images というURLパスで、backend/generated_ogp_images ディレクトリのファイルを公開
// パスはプロジェクトのビルド後の構成に合わせて調整してください
app.use('/generated_images', express.static(path.join(__dirname, '..', 'generated_ogp_images'))); 


// Routes
app.use('/api/chat', chatRoutes);
// OGP 画像生成エンドポイントのルートを登録する
app.use('/api', ogpRouter); // ogp.ts で定義したルートが /api 配下にマウントされる

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`CORS enabled for origin: ${CORS_ORIGIN}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});