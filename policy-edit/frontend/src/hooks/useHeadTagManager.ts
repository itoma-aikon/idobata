import { useEffect, useRef } from "react"; 

interface UseHeadTagManagerProps {
  ogpTitle: string;
  ogpDescription: string;
  ogpImageUrl: string;
}

// カスタムフックを定義
const useHeadTagManager = ({
  ogpTitle,
  ogpDescription,
  ogpImageUrl,
}: UseHeadTagManagerProps): void => {
  // OGP 関連の入力値の最新値を保持するための ref
  // Effect の依存配列に含めずに最新値にアクセスするために使用します。
  const ogpTitleRef = useRef(ogpTitle);
  const ogpDescriptionRef = useRef(ogpDescription);
  const ogpImageUrlRef = useRef(ogpImageUrl);

  // OGP 関連の入力値が変更されるたびに ref.current を更新する Effect
  useEffect(() => {
    ogpTitleRef.current = ogpTitle;
    ogpDescriptionRef.current = ogpDescription;
    ogpImageUrlRef.current = ogpImageUrl;
  }, [ogpTitle, ogpDescription, ogpImageUrl]); // OGP 関連の入力値の変更を監視

  // 手動 DOM 操作で OGP 関連タグとタイトルを Head に設定する useEffect
  useEffect(() => {
    // Head タグに設定する際に、入力値の代わりに ref.current の最新値を参照
    const titleToSet = ogpTitleRef.current;
    const descriptionToSet = ogpDescriptionRef.current;
    const imageUrlToSet = ogpImageUrlRef.current;

    // 設定したいOGP関連タグのリスト
    const ogpTags = [
      { property: "og:title", content: titleToSet },
      { property: "og:description", content: descriptionToSet },
      { property: "og:image", content: imageUrlToSet },
      // ページのURLが必要な場合はここに追加 (現在のページURLを取得するなど)
      // { property: 'og:url', content: window.location.href },
      { property: "og:type", content: "website" },
      // その他のOGPタグがあればここに追加
    ];

    // 既存のOGP関連タグとタイトルタグを全て削除するためのリスト
    const selectorsToClear = ogpTags
      .map((tag) => `meta[property="${tag.property}"]`)
      .concat("title"); // title タグも対象に加える

    // Head から既存の対象タグを全て削除
    selectorsToClear.forEach((selector) => {
      document.head.querySelectorAll(selector).forEach((element) => {
        if (element.parentElement === document.head) {
          document.head.removeChild(element);
        }
      });
    });

    // 新しいタイトルタグを作成し追加 (タイトルは常に一つだけ)
    const newTitleTag = document.createElement("title");
    newTitleTag.textContent = titleToSet; // textContent を使用
    document.head.appendChild(newTitleTag);

    // 新しいOGP関連メタタグを作成し Head に追加
    ogpTags.forEach((tagInfo) => {
      // content が null や undefined の場合はタグを追加しない、またはデフォルト画像を使うなどの制御が必要なら追加
      if (tagInfo.content !== null && tagInfo.content !== undefined) {
        const newMetaTag = document.createElement("meta");
        newMetaTag.setAttribute("property", tagInfo.property);
        newMetaTag.setAttribute("content", tagInfo.content);
        document.head.appendChild(newMetaTag);
      }
    });

    // クリーンアップ関数: コンポーネントがアンmountされる際や Effect が再実行される前に実行される
    return () => {
      // Effect 実行前に削除したタグが、クリーンアップ時に再度削除されないように注意
      // シンプルなクリーンアップとして、今回追加したタグと同じセレクタを持つタグを再度削除
      selectorsToClear.forEach((selector) => {
        document.head.querySelectorAll(selector).forEach((element) => {
          // Head 直下の子要素のみを対象とする（より安全）
          if (element.parentElement === document.head) {
            document.head.removeChild(element);
          }
        });
      });
      // ただし、これにより他の場所で設定された同じセレクタのタグも削除される可能性があるので注意
      // より厳密には、この Effect で追加した要素への参照を保持しておき、その参照を使って削除するのが安全
      // しかし、コードが複雑になるため、ここではシンプルさを優先
    };
  }, [ogpTitle, ogpDescription, ogpImageUrl]); // OGP ステートの変更を監視
};

export default useHeadTagManager;
