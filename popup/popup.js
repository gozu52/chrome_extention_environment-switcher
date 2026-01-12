// 環境データを取得
async function getEnvironments() {
  const result = await chrome.storage.sync.get(['environments']);
  return result.environments || [];
}

// 環境データを保存
async function saveEnvironments(environments) {
  await chrome.storage.sync.set({ environments });
}

// 現在のタブのURLを取得
async function getCurrentTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url || '';
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

// 環境リストを表示
async function displayEnvironments() {
  const environments = await getEnvironments();
  const currentUrl = await getCurrentTabUrl();
  const currentDomain = getDomain(currentUrl);
  const envList = document.getElementById('envList');
  
  if (environments.length === 0) {
    envList.innerHTML = '<p class="empty-message">まだ環境が登録されていません</p>';
    return;
  }
  
  envList.innerHTML = environments.map((env, index) => {
    const envDomain = getDomain(env.url);
    const isCurrent = currentDomain && currentDomain === envDomain;
    const currentClass = isCurrent ? 'current-env' : '';
    const currentBadge = isCurrent ? '<span class="current-badge">現在の環境</span>' : '';
    
    return `
      <div class="env-item ${currentClass}" style="border-left-color: ${env.color};" data-index="${index}">
        <div class="env-info">
          <div class="env-name">${env.name} ${currentBadge}</div>
          <div class="env-url">${env.url}</div>
        </div>
        <button class="delete-btn" data-index="${index}">削除</button>
      </div>
    `;
  }).join('');
  
  // 環境クリックイベント
  document.querySelectorAll('.env-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-btn')) {
        const index = item.dataset.index;
        switchEnvironment(environments[index]);
      }
    });
  });
  
  // 削除ボタンイベント
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      await deleteEnvironment(index);
    });
  });
}

// 環境を追加
async function addEnvironment() {
  const name = document.getElementById('envName').value.trim();
  const url = document.getElementById('envUrl').value.trim();
  const color = document.querySelector('input[name="color"]:checked').value;
  
  if (!name || !url) {
    alert('環境名とURLを入力してください');
    return;
  }
  
  // URLの検証（簡易版）
  if (!url.includes('service-now.com') && !url.includes('servicenow.com')) {
    alert('ServiceNowのURLを入力してください');
    return;
  }
  
  const environments = await getEnvironments();
  environments.push({ name, url, color });
  await saveEnvironments(environments);
  
  // フォームをクリア
  document.getElementById('envName').value = '';
  document.getElementById('envUrl').value = '';
  
  // リストを再表示
  displayEnvironments();
}

// 環境を削除
async function deleteEnvironment(index) {
  if (!confirm('この環境を削除しますか？')) {
    return;
  }
  
  const environments = await getEnvironments();
  environments.splice(index, 1);
  await saveEnvironments(environments);
  displayEnvironments();
}

// 環境に切り替え
function switchEnvironment(env) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, { url: env.url });
      window.close();
    }
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  displayEnvironments();
  
  // 追加ボタンのイベントリスナー
  document.getElementById('addEnvBtn').addEventListener('click', addEnvironment);
  
  // Enterキーで追加
  document.getElementById('envUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addEnvironment();
    }
  });
});

console.log('Environment Switcher loaded');