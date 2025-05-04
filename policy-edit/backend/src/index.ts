// --- DEBUG: Print GitHub Env Vars ---
console.log("--- GitHub Environment Variables ---");
console.log("GITHUB_APP_ID:", process.env.GITHUB_APP_ID);
console.log("GITHUB_INSTALLATION_ID:", process.env.GITHUB_INSTALLATION_ID);
console.log("GITHUB_TARGET_OWNER:", process.env.GITHUB_TARGET_OWNER);
console.log("GITHUB_TARGET_REPO:", process.env.GITHUB_TARGET_REPO);
console.log("------------------------------------");
// --- END DEBUG ---

import cors from 'cors';
import express from 'express';
import { CORS_ORIGIN, PORT } from './config.js';
import chatRoutes from './routes/chat.js';
import ogpRouter from './routes/ogp.js';
import { logger } from './utils/logger.js';
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
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 生成した画像を Frontend が取得できるように、特定のディレクトリを静的ファイルとしてホストする設定
// 例: /generated_images というURLパスで、backend/generated_ogp_images ディレクトリのファイルを公開
// パスはプロジェクトのビルド後の構成に合わせて調整してください
app.use('/generated_images', express.static(path.join(__dirname, '..', 'generated_ogp_images')));


// Routes
// チャット関連ルートを登録
app.use('/api/themes/:themeId/chat', chatRoutes);
console.log('Chat routes mounted at /api/themes/:themeId/chat');
// OGP 画像生成エンドポイントのルートを登録する
app.use('/api/themes/:themeId/ogp', ogpRouter);
console.log('OGP routes mounted at /api/themes/:themeId/ogp');


// Health check endpoin
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`CORS enabled for origin: ${CORS_ORIGIN}`);
  console.log('Backend server started and listening.');

});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});
