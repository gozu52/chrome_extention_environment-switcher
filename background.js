// タブが更新されたときに実行
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateIconAndBadge(tabId, tab.url);
  }
});

// タブが切り替わったときに実行
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      updateIconAndBadge(activeInfo.tabId, tab.url);
    }
  });
});

// キーボードショートカットのコマンドリスナー
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  // switch-env-1 から switch-env-9 のコマンドを処理
  if (command.startsWith('switch-env-')) {
    const envIndex = parseInt(command.split('-')[2]) - 1; // 0-indexed
    await switchToEnvironmentByIndex(envIndex);
  }
});

// 指定されたインデックスの環境に切り替え
async function switchToEnvironmentByIndex(index) {
  // 環境データを取得
  const result = await chrome.storage.sync.get(['environments']);
  const environments = result.environments || [];
  
  if (index < 0 || index >= environments.length) {
    console.log(`環境 ${index + 1} は存在しません`);
    return;
  }
  
  const env = environments[index];
  
  // 現在のアクティブなタブを取得
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tabs[0]) {
    // URLを更新
    chrome.tabs.update(tabs[0].id, { url: env.url });
    console.log(`環境 "${env.name}" に切り替えました`);
  }
}

// アイコンとバッジを更新する関数
async function updateIconAndBadge(tabId, url) {
  // 環境データを取得
  const result = await chrome.storage.sync.get(['environments']);
  const environments = result.environments || [];
  
  // 現在のURLと一致する環境を検索
  const currentEnv = environments.find(env => url.includes(getDomain(env.url)));
  
  if (currentEnv) {
    // 一致する環境があれば
    // バッジを表示
    chrome.action.setBadgeText({ text: currentEnv.name.substring(0, 4), tabId });
    chrome.action.setBadgeBackgroundColor({ color: currentEnv.color, tabId });
    
    // アイコンの色を変更
    await setIconColor(currentEnv.color, tabId);
  } else {
    // 一致しなければバッジをクリア＆デフォルトアイコン
    chrome.action.setBadgeText({ text: '', tabId });
    await setDefaultIcon(tabId);
  }
}

// 環境の色に応じたアイコンを設定
async function setIconColor(color, tabId) {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  
  // 背景色を設定
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  
  // 白い円を描画
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(64, 64, 40, 0, 2 * Math.PI);
  ctx.fill();
  
  // ImageDataを取得
  const imageData = ctx.getImageData(0, 0, 128, 128);
  
  // アイコンを設定
  chrome.action.setIcon({
    imageData: imageData,
    tabId: tabId
  });
}

// デフォルトアイコンを設定
async function setDefaultIcon(tabId) {
  chrome.action.setIcon({
    path: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    tabId: tabId
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

// 拡張機能がインストールされたときの初期化
chrome.runtime.onInstalled.addListener(() => {
  console.log('Environment Switcher installed');
});