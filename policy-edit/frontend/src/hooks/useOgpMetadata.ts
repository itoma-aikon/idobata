import { useEffect, useState } from "react";
import { GitHubFile, decodeBase64Content, GitHubDirectoryItem } from "../lib/github"; 

// Backend API の基本URLを環境変数から取得
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

interface UseOgpMetadataProps {
  // content の型定義を修正: GitHubFile | GitHubDirectoryItem[] | null にする
  content: GitHubFile | GitHubDirectoryItem[] | null; // ★ ここを修正
  contentType: "file" | "dir" | null; // useContentStore から取得される contentType の型に合わせる
  currentPath: string; // useContentStore から取得される currentPath の型に合わせる
  // chatThreads の型定義を修正: branchId が string | null の可能性があることを反映
  chatThreads: Record<string, { branchId?: string | null }>;
}

interface OgpMetadata {
  ogpTitle: string;
  ogpDescription: string;
  ogpImageUrl: string;
}

// カスタムフックを定義
const useOgpMetadata = ({
  content,
  contentType,
  currentPath,
  chatThreads,
}: UseOgpMetadataProps): OgpMetadata => {
  // OGP 用のタイトルと説明、画像 URL を保持するローカルステート
  const [ogpTitle, setOgpTitle] = useState("Default Title"); // デフォルトタイトルを設定
  const [ogpDescription, setOgpDescription] = useState(
    "Default description for the repository content."
  ); // デフォルト説明を設定
  const [ogpImageUrl, setOgpImageUrl] = useState("images/default_ogp.png"); // OGP 画像の URL を保持するステート ★ 初期値はデフォルト画像パスを設定

  // content, contentType, currentPath が変更された際に OGP 情報を生成し、OGP画像をBackendにリクエスト
  useEffect(() => {
    // Backend に OGP 画像生成をリクエストする非同期関数を定義
    const generateOgpImage = async (
      title: string,
      description: string,
      type: "file" | "dir", // コンテンツタイプを引数として受け取る
      fileContent: string | null, // ファイル内容
      directoryContent: GitHubDirectoryItem[] | null // ディレクトリ内容
    ) => {
      // リクエストボディのデータ
      const requestBody = {
        title: title,
        description: description,
        content: fileContent, // ファイル内容を送信
        contentType: type, // コンテンツタイプを送信 
        directoryContent: directoryContent, // ディレクトリ内容を送信 
        // 必要であれば他の情報 (backgroundColor など) も追加
      };

      // ファイル内容もディレクトリ内容もnullの場合はリクエストしない
      if (fileContent === null && directoryContent === null) {
        console.warn("Cannot generate OGP image: content is null for both file and directory.");
        setOgpImageUrl("images/default_ogp.png");
        return;
      }


      try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody), // 作成したリクエストボディを送信
        });

        if (!response.ok) {
          console.error(
            "Failed to request OGP image generation:",
            response.status,
            response.statusText
          );
          setOgpImageUrl("images/default_ogp.png");
          return;
        }

        const data = await response.json();
        if (data.imageUrl) {
          // Backend から返された画像URLをステートに設定
          // Backend のホストURLを付加して完全なURLにする
          const backendHost = API_BASE_URL.replace("/api", "");
          // Backend の静的ファイルホスティングパスに合わせて修正が必要かもしれません
          const fullImageUrl = `${backendHost}${data.imageUrl}`;
          setOgpImageUrl(fullImageUrl);
        } else {
          console.error("Backend did not return an imageUrl in OGP response.");
          setOgpImageUrl("images/default_ogp.png");
        }
      } catch (fetchError) {
        console.error("Error during OGP image generation request:", fetchError);
        setOgpImageUrl("images/default_ogp.png");
      }
    };

    // OGP タイトルと説明を生成し、Backend にリクエストを送るロジック
    let generatedTitle = "Default Title";
    let generatedDescription =
      "Default description for the repository content.";

    // content, contentType が確定したら処理
    if (content !== null && contentType !== null) {
        if (contentType === "file") {
            // ファイルの場合のOGPタイトル・説明生成ロジック
            if (typeof content === "object" && !Array.isArray(content)) {
                 const fileContent = content as GitHubFile;
                 let decodedContent = "";
                 if (fileContent.content) {
                   decodedContent = decodeBase64Content(fileContent.content);
                 }

                 // Markdown ファイルの場合、デコードされた内容からタイトルと説明を抽出 (簡易版)
                 if (currentPath.endsWith(".md") && decodedContent) {
                   const lines = decodedContent.split("\n");
                   const firstLine = lines[0];
                   if (firstLine && firstLine.startsWith("# ")) {
                     generatedTitle = firstLine.substring(2).trim();
                   } else if (firstLine && firstLine.startsWith("---")) {
                     const frontmatterEndIndex = lines.indexOf("---", 1);
                     if (frontmatterEndIndex !== -1) {
                       const frontmatter = lines.slice(1, frontmatterEndIndex).join("\n");
                       const titleMatch = frontmatter.match(/^title:\s*(.*)/m);
                       if (titleMatch && titleMatch[1]) {
                         generatedTitle = titleMatch[1].trim().replace(/^['"]|['"]$/g, "");
                       }
                     }
                   }

                   let descriptionLines = [];
                   let inFrontmatter = false;
                   if (lines[0] && lines[0].startsWith("---")) {
                     inFrontmatter = true;
                   }

                   for (
                     let i = inFrontmatter ? lines.indexOf("---", 1) + 1 : 0;
                     i < lines.length && descriptionLines.length < 5;
                     i++
                   ) {
                     if (
                       lines[i].trim() &&
                       !lines[i].trim().startsWith("#") &&
                       !lines[i].trim().startsWith("---")
                     ) {
                       descriptionLines.push(lines[i].trim());
                     }
                   }
                   generatedDescription =
                     descriptionLines.join(" ").substring(0, 150) + "...";

                   if (!generatedTitle && currentPath) {
                     generatedTitle = currentPath.split("/").pop() || currentPath;
                   } else if (!generatedTitle && !currentPath) {
                     generatedTitle = "Repository Root";
                   }
                 } else if (currentPath) {
                   // Markdown 以外のファイルの場合
                   generatedTitle =
                     "File: " + (currentPath.split("/").pop() || currentPath);
                   generatedDescription = "Content of file: " + currentPath;
                 } else {
                   // ルートパスの場合 (ファイルではない)
                   generatedTitle = "Repository Root";
                   generatedDescription = "Browse the repository content.";
                 }

                 // OGP 情報が生成できたら、Backend に画像生成をリクエスト (ファイルの場合)
                 generateOgpImage(generatedTitle, generatedDescription, contentType, decodedContent, null); 
            } else {
                // content の型が GitHubFile ではないが contentType が file の場合 (エラー状態など)
                 console.error("Unexpected content type for file:", content);
                 // デフォルト画像にフォールバック
                 setOgpImageUrl("images/default_ogp.png");
                 return; // 処理を中断
            }

        } else if (contentType === "dir") {
            // ディレクトリの場合のOGPタイトル・説明生成ロジック
            if (Array.isArray(content)) {
                 const dirContent = content as GitHubDirectoryItem[];
                 const dirPath = currentPath || "Root";
                 generatedTitle = "Directory: " + dirPath;
                 generatedDescription = "Contents of the directory " + dirPath + " in the repository.";

                 // OGP 情報が生成できたら、Backend に画像生成をリクエスト (ディレクトリの場合)
                 generateOgpImage(generatedTitle, generatedDescription, contentType, null, dirContent); 
            } else {
                 // content の型が GitHubDirectoryItem[] ではないが contentType が dir の場合 (エラー状態など)
                 console.error("Unexpected content type for directory:", content);
                 // デフォルト画像にフォールバック
                 setOgpImageUrl("images/default_ogp.png");
                 return; // 処理を中断
            }
        } else {
            // contentType が file でも dir でもない場合 (初期状態やエラーなど)
             const defaultTitle = "Default Project Title";
             const defaultDescription = "Default description for the repository content.";
             setOgpTitle(defaultTitle);
             setOgpDescription(defaultDescription);
             setOgpImageUrl("images/default_ogp.png");
             return; // 処理を中断
        }
    } else {
         // content または contentType が null の場合 (データ取得中など)
         // デフォルト画像またはローディング表示などを考慮
         // ここではデフォルト画像を設定
         setOgpTitle("Loading...");
         setOgpDescription("Fetching repository content...");
         setOgpImageUrl("images/default_ogp.png"); // ★ デフォルト画像パスを設定
         return; // 処理を中断
    }


    // OGP 情報が生成できたら、ローカルステートを更新
    setOgpTitle(generatedTitle);
    setOgpDescription(generatedDescription);

    // generateOgpImage が内部で setOgpImageUrl を呼ぶため、ここでは setOgpImageUrl は不要
  }, [content, contentType, currentPath, chatThreads]); // 依存配列に content, contentType, currentPath, chatThreads を含める

  // OGP 情報ステートを返す
  return { ogpTitle, ogpDescription, ogpImageUrl };
};

export default useOgpMetadata;