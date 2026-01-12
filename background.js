// タブが更新されたときに実行
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tab.url);
  }
});

// タブが切り替わったときに実行
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      updateBadge(tab.url);
    }
  });
});

// バッジを更新する関数
async function updateBadge(url) {
  // 環境データを取得
  const result = await chrome.storage.sync.get(['environments']);
  const environments = result.environments || [];
  
  // 現在のURLと一致する環境を検索
  const currentEnv = environments.find(env => url.includes(getDomain(env.url)));
  
  if (currentEnv) {
    // 一致する環境があればバッジを表示
    chrome.action.setBadgeText({ text: currentEnv.name.substring(0, 4) });
    chrome.action.setBadgeBackgroundColor({ color: currentEnv.color });
  } else {
    // 一致しなければバッジをクリア
    chrome.action.setBadgeText({ text: '' });
  }
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

// 拡張機能がインストールされたときの初期化
chrome.runtime.onInstalled.addListener(() => {
  console.log('Environment Switcher installed');
});