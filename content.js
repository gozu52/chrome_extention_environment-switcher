// ページタイトルにプリフィックスを追加

// 環境データを取得
async function getEnvironments() {
  const result = await chrome.storage.sync.get(['environments']);
  return result.environments || [];
}

// プリフィックス表示設定を取得
async function getPrefixEnabled() {
  const result = await chrome.storage.sync.get(['prefixEnabled']);
  return result.prefixEnabled !== false; // デフォルトはtrue
}

// 現在のURLから一致する環境を探す
function findMatchingEnvironment(environments, currentUrl) {
  const currentDomain = getDomain(currentUrl);
  return environments.find(env => {
    const envDomain = getDomain(env.url);
    return currentDomain === envDomain;
  });
}

// URLからドメインを抽出
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
}

// タイトルにプリフィックスを追加
async function addPrefixToTitle() {
  const prefixEnabled = await getPrefixEnabled();
  const environments = await getEnvironments();
  const currentUrl = window.location.href;
  const matchedEnv = findMatchingEnvironment(environments, currentUrl);
  
  // 既存のプリフィックスを削除
  const originalTitle = document.title.replace(/^\[.+?\]\s*/, '');
  
  if (!prefixEnabled || !matchedEnv) {
    // 設定がOFFまたは環境が見つからない場合、プリフィックスを削除
    document.title = originalTitle;
    return;
  }
  
  // 環境名の最初の4文字を取得
  const prefix = matchedEnv.name.substring(0, 4).toUpperCase();
  
  // プリフィックスを追加
  document.title = `[${prefix}] ${originalTitle}`;
  
  // タイトルの変更を監視して、変更されたら再度プリフィックスを追加
  if (window.titleObserver) {
    window.titleObserver.disconnect();
  }
  
  window.titleObserver = new MutationObserver(() => {
    if (prefixEnabled && !document.title.startsWith(`[${prefix}]`)) {
      const newTitle = document.title.replace(/^\[.+?\]\s*/, '');
      document.title = `[${prefix}] ${newTitle}`;
    }
  });
  
  const titleElement = document.querySelector('title');
  if (titleElement) {
    window.titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
}

// ページ読み込み時に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addPrefixToTitle);
} else {
  addPrefixToTitle();
}

console.log('ServiceNow Environment Switcher: Content script loaded');

// Background/Popupからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updatePrefix') {
    addPrefixToTitle();
  }
});