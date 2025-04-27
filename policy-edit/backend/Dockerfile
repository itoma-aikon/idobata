# Stage 1: Build MCP Server
# ベースイメージを node:20-alpine3.19 に変更
FROM node:20-alpine3.19 AS mcp-builder
WORKDIR /app
# Copy root package files and relevant workspace package.json files
COPY package.json package-lock.json ./
COPY ./policy-edit/mcp/package.json ./policy-edit/mcp/
COPY ./policy-edit/backend/package.json ./policy-edit/backend/
# Install ALL dependencies (including dev) needed for build, based on root lock file
RUN npm install --workspace=github-contribution-mcp
RUN npm install --workspace=idobata-policy-editor-backend

WORKDIR /app/policy-edit/mcp
# Copy the mcp source code
COPY ./policy-edit/mcp ./
# Build mcp
RUN npm run build

# Stage 2: Build Backend Server
FROM node:20-alpine AS backend-builder
WORKDIR /app/policy-edit/backend 
# Backend ディレクトリを作業ディレクトリにする

# Copy package.json and package-lock.json
COPY ./policy-edit/backend/package.json .
COPY ./policy-edit/backend/package-lock.json .

# canvas が必要とするシステムライブラリをインストール (Alpine Linux 用)
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

# Install dependencies
RUN npm install

# Copy the rest of the backend source code 
COPY ./policy-edit/backend ./
# Build backend
RUN npm run build

# Stage 3: Final Production Image
FROM node:20-alpine AS production
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
COPY ./policy-edit/backend/fonts /app/policy-edit/backend/fonts 
# /app/backend/fonts にコピーするようにパスを修正

# コピーしたカスタムフォントをコンテナのシステムフォントディレクトリに移動し、フォントキャッシュを更新
# これにより、canvas がフォントを認識できるようになります。
RUN mkdir -p /usr/share/fonts/custom \
        && mv /app/policy-edit/backend/fonts/* /usr/share/fonts/custom/ \
        && fc-cache -fv

# Copy built artifacts and necessary node_modules from builders
# Stage 1 から node_modules をコピー 
COPY --from=mcp-builder /app/node_modules ./node_modules
# Stage 1 から mcp の成果物をコピー
COPY --from=mcp-builder /app/policy-edit/mcp/dist ./policy-edit/mcp/dist/
# Stage 2 から backend の成果物をコピー
COPY --from=backend-builder /app/policy-edit/backend/build ./policy-edit/backend/build/

# Set environment variable for MCP server path within the container
ENV MCP_SERVER_PATH=/app/policy-edit/mcp/dist/main.js
# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy the private key into the final image
# ビルドコンテキストからの相対パスでコピー
# IMPORTANT: Ensure the key exists at ./policy-edit/backend/secrets/github-key.pem within the build context
COPY ./policy-edit/backend/secrets/github-key.pem /app/secrets/github-key.pem

# Copy backend package.json (optional, if needed by CMD or runtime)
COPY ./policy-edit/backend/package.json ./policy-edit/backend/package.json

WORKDIR /app/policy-edit/backend 
# Backend ディレクトリを作業ディレクトリにする
EXPOSE 3001
CMD ["node", "build/index.js"] 