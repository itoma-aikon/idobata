# Stage 1: Build MCP Server
# ベースイメージを node:20-alpine3.19 に変更
FROM node:20-alpine3.19 AS mcp-builder
WORKDIR /app/mcp
# Copy only package files first for better layer caching
# ビルドコンテキストからの相対パスでコピー
COPY ./policy-edit/mcp/package*.json ./
# Install dependencies (consider --only=production for smaller final image if applicable)
RUN npm install
# Copy the rest of the mcp source code
# ビルドコンテキストからの相対パスでコピー
COPY ./policy-edit/mcp ./
# Build mcp
RUN npm run build

# Stage 2: Build Backend Server
FROM node:20-alpine3.19 AS backend-builder
WORKDIR /app/backend 
# コンテナ内の作業ディレクトリを /app/backend に設定

# Copy package.json and package-lock.json from the build context (root) to the working directory (.)
# ビルドコンテキストからの相対パスでコピー
COPY ./policy-edit/backend/package.json .
COPY ./policy-edit/backend/package-lock.json .

# コピーが成功したか確認するためのステップを追加 (ビルドログで確認用)
RUN ls -l /app/backend

# canvas が必要とするシステムライブラリをインストール (Alpine Linux 用)
# --no-cache を使うと、apkキャッシュを保持しないためイメージサイズを抑えられます
# build-base はビルド時のみ必要なので、このステージに含めます。
# libc6-compat と libuuid を追加
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    freetype-dev \
    fontconfig-dev \
    librsvg-dev \
    libc6-compat \
    libuuid

# Install dependencies (package.json に canvas が追加されていることを想定)
RUN npm install
# Copy the rest of the backend source code
# ビルドコンテキストからの相対パスでコピー
COPY ./policy-edit/backend ./
# Build backend
RUN npm run build

# Stage 3: Final Production Image
# ベースイメージを node:20-alpine3.19 に変更
FROM node:20-alpine3.19 AS production
WORKDIR /app

# production イメージに必要なシステムライブラリをインストール
# canvas が実行時に必要とするライブラリを含みます
# libc6-compat と libuuid をここでもインストールします。
# 標準的なフォントパッケージも追加
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    freetype \
    fontconfig \
    librsvg \
    libc6-compat \
    libuuid \
    ttf-dejavu

# build-base は実行時には不要なので含めません。
# -dev パッケージは開発用なので含めません。

# ホストOSのフォントディレクトリをコンテナ内にコピー
# ビルドコンテキストからの相対パスでコピー
COPY ./policy-edit/backend/fonts /app/backend/fonts

# コピーしたカスタムフォントをコンテナのシステムフォントディレクトリに移動し、フォントキャッシュを更新
# これにより、canvas がフォントを認識できるようになります。
RUN mkdir -p /usr/share/fonts/custom \
    && mv /app/backend/fonts/* /usr/share/fonts/custom/ \
    && fc-cache -fv

# Copy built artifacts and necessary node_modules from builders
COPY --from=mcp-builder /app/mcp/dist ./mcp/dist/
COPY --from=mcp-builder /app/mcp/node_modules ./mcp/node_modules/
COPY --from=mcp-builder /app/mcp/package.json ./mcp/

COPY --from=backend-builder /app/backend/build ./backend/build/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules/
COPY --from=backend-builder /app/backend/package.json ./backend/package.json


# Set environment variable for MCP server path within the container
ENV MCP_SERVER_PATH=/app/mcp/dist/main.js
# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy the private key into the final image
# ビルドコンテキストからの相対パスでコピー
# IMPORTANT: Ensure the key exists at ./policy-edit/backend/secrets/github-key.pem within the build context
COPY ./policy-edit/backend/secrets/github-key.pem /app/secrets/github-key.pem

WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "build/index.js"]
