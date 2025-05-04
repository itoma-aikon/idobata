// src/routes/ogp.ts
import express from 'express';
import { Canvas, loadImage, registerFont } from 'canvas';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 生成画像を保存するディレクトリ (Dockerコンテナ内のパス)
// Dockerfileで /app/backend/generated_ogp_images にコピーされることを想定
const generatedImagesDir = path.join(__dirname, '..', '..', 'generated_ogp_images');

fs.mkdir(generatedImagesDir, { recursive: true }).catch(console.error);

// カスタムフォントの登録
// Dockerfileで /usr/share/fonts/custom/ に移動されたフォントを参照するようにパスを修正
try {
   // registerFont(path.join(__dirname, '..', '..', 'fonts', 'NotoSansJP-Regular.ttf'), { family: 'Noto Sans JP' }); // 以前のパス
   registerFont('/usr/share/fonts/custom/NotoSansJP-Regular.ttf', { family: 'Noto Sans JP' }); // ★ 新しいパスに修正
} catch (error) {
   console.warn('カスタムフォントの登録に失敗しました:', error);
   console.warn('デフォルトのシステムフォントを使用します。システムフォントに必要なグリフ（例: 三点リーダー U+2026）がない場合、OGP画像が正しく表示されない可能性があります。');
}

// テキストを指定された最大幅に収まるように切り詰め処理を行う関数 (省略記号なし)
const getWrappedTextWithEllipsis = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
    if (context.measureText(text).width <= maxWidth) {
        return text;
    }

    let currentText = text;
     // 測定前にフォントが設定されていることを確認
    context.font = context.font || `${10}px sans-serif`;

    // maxWidthに収まるまで末尾から一文字ずつ削除
    while (context.measureText(currentText).width > maxWidth && currentText.length > 0) {
        currentText = currentText.slice(0, -1);
    }

     // 切り詰めた結果のテキストをそのまま返す (空文字列になる可能性あり)
    return currentText;
};


// 角丸長方形のパスを描画する関数
const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.arcTo(x + width, y, x + width, y + radius, radius);
    context.lineTo(x + width, y + height - radius);
    context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    context.lineTo(x + radius, y + height);
    context.arcTo(x, y + height, x, y + height - radius, radius);
    context.lineTo(x, y + radius);
    context.arcTo(x, y, x + radius, y, radius);
    context.closePath();
};

// リクエストパラメータから一意なハッシュ値を生成する関数
const generateHash = (params: { title: string; description: string; content: string | null; backgroundColor: string; contentType: 'file' | 'dir'; directoryContent: { name: string; type: 'file' | 'dir' }[] | null }): string => {
    const paramString = JSON.stringify(params);
    return crypto.createHash('sha256').update(paramString).digest('hex');
};


const router = express.Router();

// OGP 画像生成エンドポイント
router.post('/generate', async (req, res) => {
  try {
    const { title = '', description = '', content = null, backgroundColor = '#ffffff', contentType = 'file', directoryContent = null } = req.body;

    const paramsHash = generateHash({ title, description, content, backgroundColor, contentType, directoryContent });
    const filename = `ogp_image_${paramsHash}.png`;
    const imageSavePath = path.join(generatedImagesDir, filename);

    // 既存のOGP画像ファイルがあるかチェック
    try {
        await fs.access(imageSavePath);
        console.log(`ハッシュ ${paramsHash} に対応する既存のOGP画像が見つかりました。既存の画像のURLを返します。`);
        res.json({ imageUrl: `/generated_images/${filename}` });
        return;
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`既存のOGP画像ファイル ${imageSavePath} の確認中にエラーが発生しました:`, error);
            throw error;
        }
        console.log(`ハッシュ ${paramsHash} に対応する既存のOGP画像は見つかりませんでした。新しい画像を生成します。`);
    }


    const canvas = new Canvas(1200, 628);
    const context = canvas.getContext('2d') as unknown as CanvasRenderingContext2D; // TypeScriptの型アサーション


    // 背景のグラデーションを描画 (全体に適用)
    const gradient = context.createLinearGradient(0, canvas.height, canvas.width, 0);
    gradient.addColorStop(0.2, 'hsla(259, 83%, 84%, 1)');
    gradient.addColorStop(1, 'hsla(169, 80%, 73%, 1)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);


    // 中央部分を角丸単色で塗りつぶし（淵にグラデーションを残す効果）
    const centerFillColor = '#ffffff';
    const padding = 30; // 淵として残す幅（左右上下の余白）
    const centerX = padding;
    const centerY = padding;
    const centerWidth = canvas.width - 2 * padding;
    const centerHeight = canvas.height - 2 * padding;
    const cornerRadius = 20;

    context.fillStyle = centerFillColor;
    roundRect(context, centerX, centerY, centerWidth, centerHeight, cornerRadius);
    context.fill();


    // 右下の固定テキストの情報を定義
    const footerTexts = [
        { text: 'いどばた', size: 36 },
        { text: 'デジタル民主主義2030', size: 28 },
        { text: '民意による政策反映', size: 28 },
    ];
    const footerFontFamily = 'Noto Sans JP'; // 登録したカスタムフォント名を使用
    const footerColor = '#000000';
    context.fillStyle = footerColor;

    const footerLineHeightMultiplier = 1.3;
     const totalFooterHeight = footerTexts.reduce((sum, item, index) => {
         const itemHeight = item.size * footerLineHeightMultiplier;
         const currentItemTotalHeight = (index < footerTexts.length - 1) ? itemHeight : item.size;
         return sum + currentItemTotalHeight;
     }, 0);


    const footerAreaPadding = 50;
    const footerAreaTopY = centerY + centerHeight - footerAreaPadding - totalFooterHeight;


    // タイトルの描画 (大きな文字と幅・高さ制限による折り返し・省略処理 - 省略記号なし)
    const titleFontSize = 64;
    const titleFontFamily = 'Noto Sans JP'; // 登録したカスタムフォント名を使用
    const titleColor = '#000000';
    context.fillStyle = titleColor;

    // タイトルを描画する領域は、中央の白い部分の内側、かつフッター領域より上です。
    const titleAreaPadding = 80;
    const titleMaxWidth = centerWidth - 2 * titleAreaPadding;
    const titleStartX = centerX + titleAreaPadding;
    let currentY_title_baseline = centerY + titleAreaPadding + titleFontSize; // タイトル描画開始Y座標 (最初の行のベースライン)

    const lineHeight = titleFontSize * 1.2; // タイトルの行間

    // タイトルを描画できる最大のベースラインY座標
    const maxTitleDrawingBaseY = footerAreaTopY - (lineHeight - titleFontSize);

    // drawTitle function (modified to use truncate-only getWrappedTextWithEllipsis)
    drawTitle(context, title, titleStartX, currentY_title_baseline, titleMaxWidth, lineHeight, maxTitleDrawingBaseY, titleFontSize, titleFontFamily, titleColor);


    // ====== コンテンツ描画領域 ======
    // この領域にファイル内容またはディレクトリ内容を描画します。

    // ====== ファイル内容表示ロジック (基本表示を有効化) ======
    // contentType が 'file' で content が存在する場合のロジックを記述
    if (contentType === 'file' && content) {
        // ファイル内容のプレビューを描画するロジック
        // ただし、タイトルやフッターと重ならないように位置を調整する必要があります。

        const fileContentFontSize = 20;
        const fileContentFontFamily = 'Noto Sans JP'; // 登録したカスタムフォント名を使用
        const fileContentColor = '#555555';
        const fileContentLineHeight = fileContentFontSize * 1.5;
        const fileContentStartX = titleStartX; // タイトルと同じX座標から開始
        const fileContentMaxWidth = titleMaxWidth; // タイトルと同じ最大幅を使用

        // ファイル内容描画の開始Y座標を計算 (タイトル領域の下からスペースを空けて)
        const titleAreaBottomY_after_draw = currentY_title_baseline + (maxTitleDrawingBaseY - currentY_title_baseline);
        let currentY_file_content_baseline = titleAreaBottomY_after_draw + fileContentLineHeight; // スペースを空けて開始 (最初の行のベースライン)

        context.fillStyle = fileContentColor;
        context.font = `${fileContentFontSize}px ${fileContentFontFamily}`;

        // ファイル内容を複数行に分割し、高さ制限を考慮して描画するロジックが必要
        const lines = content.split('\n'); // 改行で分割 (簡易的)
        const maxFileContentLines = Math.floor((footerAreaTopY - currentY_file_content_baseline + fileContentLineHeight) / fileContentLineHeight); // 描画できる最大行数

        for(let i = 0; i < lines.length && i < maxFileContentLines; i++) {
            let lineToDraw = lines[i];
            const currentLineBaseY = currentY_file_content_baseline + i * fileContentLineHeight;

            // 各行を幅に合わせて切り詰め (省略記号なし)
            context.font = `${fileContentFontSize}px ${fileContentFontFamily}`; // 測定・描画前にフォントを設定
            lineToDraw = getWrappedTextWithEllipsis(context, lineToDraw, fileContentMaxWidth); // 切り詰め関数を使用

            // 描画
            context.fillText(lineToDraw, fileContentStartX, currentLineBaseY);

            // 最大行数に達したらループを終了
            if (i >= maxFileContentLines -1 && i < lines.length - 1) {
                // 最後の行に省略記号を追加したい場合はここでロジックを追加可能ですが、
                // 今回は省略記号を削除するリクエストなので行いません。
            }
        }

    }
    // ===========================================================


    // 右下の固定テキストを描画 (必要に応じて手前に表示するため再描画 - コードの記述順序の方が重要ですが)
     context.fillStyle = footerColor;
     let currentY_footer_baseline = footerAreaTopY;
     footerTexts.forEach((item, index) => {
         const fontStyle = ''; // bold, italicなど、フォントが対応していれば追加可能
         context.font = `${fontStyle} ${item.size}px ${footerFontFamily}`; // フォントサイズとファミリーが設定されていることを確認

         const textWidth = context.measureText(item.text).width;
         const x = centerX + centerWidth - textWidth - footerAreaPadding;

         let y = currentY_footer_baseline;

         if (index > 0) {
              const prevItem = footerTexts[index - 1];
              const prevItemLineHeight = prevItem.size * footerLineHeightMultiplier;
              currentY_footer_baseline += prevItemLineHeight;
         }
         y = currentY_footer_baseline;

         context.fillText(item.text, x, y);
     });


    // 画像を生成画像を保存するディレクトリに保存
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(imageSavePath, buffer);

    // 生成した画像のURLをレスポンスとして返す
    res.json({ imageUrl: `/generated_images/${filename}` });

 } catch (error) {
   console.error('OGP画像の生成中にエラーが発生しました:', error);
   res.status(500).json({ error: 'OGP画像の生成に失敗しました' });
 }
});

// タイトル描画を共通化するための関数 (省略記号なし)
const drawTitle = (
    context: CanvasRenderingContext2D,
    title: string,
    startX: number,
    startY_baseline: number,
    maxWidth: number,
    lineHeight: number,
    maxDrawingBaseY: number,
    fontSize: number,
    fontFamily: string, // 'Noto Sans JP'などを想定
    color: string
) => {
    context.fillStyle = color;
    context.font = `${fontSize}px ${fontFamily}`; // 測定のためにフォントを設定

    const lines_title: string[] = [];
    let currentLine = '';

    for (let i = 0; i < title.length; i++) {
        const char = title[i];
        const testLine = currentLine + char;
        const testWidth = context.measureText(testLine).width;

        if (testWidth > maxWidth && currentLine.length > 0) {
            lines_title.push(currentLine);
            currentLine = char;
        } else {
            currentLine = testLine;
        }
    }
    lines_title.push(currentLine); // 最後の行を追加

    // 折り返された行を、高さ制限付きで描画 (ここでは省略記号は追加しない)
    for (let i = 0; i < lines_title.length; i++) {
        const currentLineBaseY = startY_baseline + i * lineHeight;

        // 次の行を描画すると最大描画エリアを超えるかチェック
        const nextLineBaseY = startY_baseline + (i + 1) * lineHeight;
        const isLastDrawableLine = nextLineBaseY > maxDrawingBaseY || i === lines_title.length - 1;

        let lineToDraw = lines_title[i];

        // 描画前に必要に応じて幅に合わせて切り詰め (省略記号なし)
        context.font = `${fontSize}px ${fontFamily}`; // 測定・描画前にフォントを設定
         lineToDraw = getWrappedTextWithEllipsis(context, lineToDraw, maxWidth); // ★ 省略記号なしの関数を使用


        // テキスト位置を計算 (maxWidth内で中央寄せ)
        const textWidth = context.measureText(lineToDraw).width;
        const x = startX + (maxWidth - textWidth) / 2;

        // テキストを描画
        context.fillText(lineToDraw, x, currentLineBaseY);

        // この行が描画できる最後の行であればループを停止
        if (isLastDrawableLine) {
            break;
        }
    }
};


export default router; // routerをエクスポート
