import React, { useEffect } from "react";
import useContentStore from "../store/contentStore";
import { GitHubFile } from "../lib/github"; // Import the GitHubFile type
// No need for shallow import when selecting primitives individually
import LoadingIndicator from "./LoadingIndicator";
import ErrorDisplay from "./ErrorDisplay";
import DirectoryView from "./DirectoryView";
import FileView from "./FileView";
import Breadcrumbs from "./Breadcrumbs";
import useOgpMetadata from "../hooks/useOgpMetadata";
import useHeadTagManager from "../hooks/useHeadTagManager";

interface ContentExplorerProps {
  initialPath: string;
}

const ContentExplorer: React.FC<ContentExplorerProps> = ({ initialPath }) => {
  // Select individual state slices from the store
  const fetchContent = useContentStore((state) => state.fetchContent);
  const isLoading = useContentStore((state) => state.isLoading);
  const error = useContentStore((state) => state.error);
  const content = useContentStore((state) => state.content);
  const contentType = useContentStore((state) => state.contentType);
  const currentPath = useContentStore((state) => state.currentPath);
  const chatThreads = useContentStore((state) => state.chatThreads); // ====== カスタムフックを呼び出して OGP 情報を取得し、Head タグを管理 ====== // useOgpMetadata カスタムフックを呼び出して OGP 情報を取得

  const { ogpTitle, ogpDescription, ogpImageUrl } = useOgpMetadata({
    content,
    contentType,
    currentPath,
    chatThreads,
  }); // useHeadTagManager カスタムフックを呼び出して Head タグを更新

  useHeadTagManager({ ogpTitle, ogpDescription, ogpImageUrl }); // ========================================================================= // initialPathが変更されたら（URLが変わったら）データを再取得

  useEffect(() => {
    console.log(`ContentExplorer useEffect triggered for path: ${initialPath}`);

    let refToFetch: string | undefined = undefined; // Check if it's a markdown file

    if (initialPath.endsWith(".md")) {
      const thread = chatThreads[initialPath];
      if (thread && thread.branchId) {
        refToFetch = thread.branchId;
        console.log(
          `Workspaceing MD file ${initialPath} using branchId: ${refToFetch}`
        );
      } else {
        console.log(
          `Workspaceing MD file ${initialPath} using default branch (no branchId found)`
        );
      }
    } else {
      console.log(
        `Workspaceing non-MD path ${initialPath} using default branch`
      );
    }

    fetchContent(initialPath, refToFetch);
  }, [initialPath, fetchContent, chatThreads]); // 依存配列 // レンダリングロジック

  const renderContent = () => {
    if (isLoading) {
      return <LoadingIndicator />;
    }
    if (error) {
      return <ErrorDisplay error={error} />;
    }
    if (contentType === "dir" && Array.isArray(content)) {
      return <DirectoryView data={content} />;
    }
    if (
      contentType === "file" &&
      typeof content === "object" &&
      content !== null &&
      !Array.isArray(content)
    ) {
      return <FileView data={content as GitHubFile} />;
    }
    return (
      <div className="p-4 text-center text-gray-500">
                ファイルまたはディレクトリを選択してください。      {" "}
      </div>
    );
  };

  return (
    <div className="p-4">
            {/* Breadcrumbs */}
            <Breadcrumbs />      {/* Draft Indicator */}     {" "}
      {(() => {
        // Determine the branchId being used for the current view
        let viewingBranchId: string | null = null; // Check if the current content is a file and ends with .md
        if (contentType === "file" && currentPath.endsWith(".md")) {
          const thread = chatThreads[currentPath]; // Check if there's a specific branchId associated with this file's thread
          if (thread && thread.branchId) {
            viewingBranchId = thread.branchId;
          }
        } // Only show the indicator if it's a file, markdown, and has a specific branchId
        if (viewingBranchId) {
          return (
            <div className="mt-2 mb-3 px-3 py-1 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm inline-block">
                            <span className="font-semibold">更新用下書き</span>{" "}
              (ブランチ: {viewingBranchId})            {" "}
            </div>
          );
        }
        return null; // Don't render anything if not a draft branch MD file
      })()}
            {/* Debug Info (Optional) */}     {" "}
      {/* <div className="text-xs text-gray-400 mb-2">Current Store Path: /{currentPath}</div> */}
            {/* Main Content Area */}      {renderContent()}   {" "}
    </div>
  );
};

export default ContentExplorer;
