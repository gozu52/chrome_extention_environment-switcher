// 編集中の環境インデックスを保持
let editingIndex = null;

// 環境データを取得
async function getEnvironments() {
  const result = await chrome.storage.sync.get(['environments']);
  return result.environments || [];
}

// 環境データを保存
async function saveEnvironments(environments) {
  await chrome.storage.sync.set({ environments });
}

// グループリストを取得
async function getGroups() {
  const result = await chrome.storage.sync.get(['groups']);
  return result.groups || [];
}

// グループを保存
async function saveGroups(groups) {
  await chrome.storage.sync.set({ groups });
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

// 相対時間を表示（例: "2日前"）
function getRelativeTime(timestamp) {
  if (!timestamp) return 'まだアクセスしていません';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

// グループセレクトを更新
async function updateGroupSelect() {
  const groups = await getGroups();
  const select = document.getElementById('envGroup');
  
  // 既存のオプションをクリア（グループなしは残す）
  select.innerHTML = '<option value="">グループなし</option>';
  
  // グループを追加
  groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    select.appendChild(option);
  });
}

// 環境リストを表示
async function displayEnvironments() {
  const environments = await getEnvironments();
  const groups = await getGroups();
  const currentUrl = await getCurrentTabUrl();
  const currentDomain = getDomain(currentUrl);
  const envList = document.getElementById('envList');
  
  if (environments.length === 0) {
    envList.innerHTML = '<p class="empty-message">まだ環境が登録されていません</p>';
    return;
  }
  
  // グループごとに環境を整理
  const groupedEnvs = {};
  const ungroupedEnvs = [];
  
  environments.forEach((env, index) => {
    env.originalIndex = index; // 元のインデックスを保持
    if (env.group) {
      if (!groupedEnvs[env.group]) {
        groupedEnvs[env.group] = [];
      }
      groupedEnvs[env.group].push(env);
    } else {
      ungroupedEnvs.push(env);
    }
  });
  
  // 各グループ内でアクセス日時順にソート
  Object.keys(groupedEnvs).forEach(group => {
    groupedEnvs[group].sort((a, b) => {
      const timeA = a.lastAccessed || 0;
      const timeB = b.lastAccessed || 0;
      return timeB - timeA;
    });
  });
  
  // グループなし環境もソート
  ungroupedEnvs.sort((a, b) => {
    const timeA = a.lastAccessed || 0;
    const timeB = b.lastAccessed || 0;
    return timeB - timeA;
  });
  
  // HTML生成
  let html = '';
  
  // グループあり環境を表示
  groups.forEach(group => {
    if (groupedEnvs[group] && groupedEnvs[group].length > 0) {
      html += createGroupHTML(group, groupedEnvs[group], currentDomain);
    }
  });
  
  // グループなし環境を表示
  if (ungroupedEnvs.length > 0) {
    html += ungroupedEnvs.map(env => createEnvItemHTML(env, currentDomain)).join('');
  }
  
  envList.innerHTML = html;
  
  // イベントリスナーを追加
  attachEventListeners(environments);
}

// グループHTMLを生成
function createGroupHTML(groupName, envs, currentDomain) {
  const envsHTML = envs.map(env => createEnvItemHTML(env, currentDomain)).join('');
  
  return `
    <div class="group-container">
      <div class="group-header" data-group="${groupName}">
        <div class="group-header-left">
          <span class="group-toggle">▼</span>
          <span class="group-name">${groupName}</span>
          <span class="group-count">(${envs.length})</span>
        </div>
        <button class="group-delete-btn" data-group="${groupName}">グループ削除</button>
      </div>
      <div class="group-environments" data-group="${groupName}">
        ${envsHTML}
      </div>
    </div>
  `;
}

// 環境アイテムHTMLを生成
function createEnvItemHTML(env, currentDomain) {
  const envDomain = getDomain(env.url);
  const isCurrent = currentDomain && currentDomain === envDomain;
  const currentClass = isCurrent ? 'current-env' : '';
  const currentBadge = isCurrent ? '<span class="current-badge">現在の環境</span>' : '';
  const accessInfo = `${getRelativeTime(env.lastAccessed)} | ${env.accessCount || 0}回`;
  
  return `
    <div class="env-item ${currentClass}" style="border-left-color: ${env.color};" data-index="${env.originalIndex}">
      <div class="env-info">
        <div class="env-name">${env.name} ${currentBadge}</div>
        <div class="env-url">${env.url}</div>
        <div class="env-access-info">${accessInfo}</div>
      </div>
      <div class="env-buttons">
        <button class="edit-btn" data-index="${env.originalIndex}">編集</button>
        <button class="delete-btn" data-index="${env.originalIndex}">削除</button>
      </div>
    </div>
  `;
}

// イベントリスナーを追加
function attachEventListeners(environments) {
  // グループヘッダーのクリック（折りたたみ）
  document.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (!e.target.classList.contains('group-delete-btn')) {
        const groupName = header.dataset.group;
        const groupEnvs = document.querySelector(`.group-environments[data-group="${groupName}"]`);
        const toggle = header.querySelector('.group-toggle');
        
        groupEnvs.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
      }
    });
  });
  
  // グループ削除ボタン
  document.querySelectorAll('.group-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupName = btn.dataset.group;
      await deleteGroup(groupName);
    });
  });
  
  // 環境クリックイベント
  document.querySelectorAll('.env-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-btn') && !e.target.classList.contains('edit-btn')) {
        const index = parseInt(item.dataset.index);
        switchEnvironment(environments[index], index);
      }
    });
  });
  
  // 編集ボタンイベント
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      await editEnvironment(index);
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

// 新しいグループを追加
async function addGroup() {
  const groupName = prompt('新しいグループ名を入力してください:');
  if (!groupName || groupName.trim() === '') return;
  
  const groups = await getGroups();
  
  if (groups.includes(groupName.trim())) {
    alert('このグループ名は既に存在します');
    return;
  }
  
  groups.push(groupName.trim());
  await saveGroups(groups);
  await updateGroupSelect();
  
  // 新しく追加したグループを選択
  document.getElementById('envGroup').value = groupName.trim();
}

// グループを削除
async function deleteGroup(groupName) {
  if (!confirm(`グループ「${groupName}」を削除しますか？\n（環境は「グループなし」に移動されます）`)) {
    return;
  }
  
  // グループリストから削除
  const groups = await getGroups();
  const updatedGroups = groups.filter(g => g !== groupName);
  await saveGroups(updatedGroups);
  
  // 環境のグループを解除
  const environments = await getEnvironments();
  environments.forEach(env => {
    if (env.group === groupName) {
      env.group = '';
    }
  });
  await saveEnvironments(environments);
  
  // 表示を更新
  await updateGroupSelect();
  await displayEnvironments();
}

// 環境を追加
async function addEnvironment() {
  const name = document.getElementById('envName').value.trim();
  const url = document.getElementById('envUrl').value.trim();
  const color = document.querySelector('input[name="color"]:checked').value;
  const group = document.getElementById('envGroup').value;
  
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
  environments.push({ 
    name, 
    url, 
    color,
    group: group || '',
    lastAccessed: null,
    accessCount: 0
  });
  await saveEnvironments(environments);
  
  // フォームをクリア
  document.getElementById('envName').value = '';
  document.getElementById('envUrl').value = '';
  document.getElementById('envGroup').value = '';
  
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

// 環境を編集（モーダルを開く）
async function editEnvironment(index) {
  console.log('editEnvironment called with index:', index);
  editingIndex = index;
  const environments = await getEnvironments();
  const env = environments[index];
  const groups = await getGroups();
  
  // モーダルのフィールドに現在の値を設定
  document.getElementById('editEnvName').value = env.name;
  document.getElementById('editEnvUrl').value = env.url;
  
  // グループセレクトを更新
  const editGroupSelect = document.getElementById('editEnvGroup');
  editGroupSelect.innerHTML = '<option value="">グループなし</option>';
  groups.forEach(group => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    if (group === env.group) {
      option.selected = true;
    }
    editGroupSelect.appendChild(option);
  });
  
  // 色を設定
  const colorRadios = document.querySelectorAll('input[name="editColor"]');
  colorRadios.forEach(radio => {
    if (radio.value === env.color) {
      radio.checked = true;
    }
  });
  
  // モーダルを表示
  console.log('Showing modal');
  document.getElementById('editModal').classList.add('show');
}

// 編集を保存
async function saveEdit() {
  console.log('saveEdit called, editingIndex:', editingIndex);
  if (editingIndex === null) return;
  
  const name = document.getElementById('editEnvName').value.trim();
  const url = document.getElementById('editEnvUrl').value.trim();
  const group = document.getElementById('editEnvGroup').value;
  const color = document.querySelector('input[name="editColor"]:checked')?.value;
  
  if (!name || !url) {
    alert('環境名とURLを入力してください');
    return;
  }
  
  if (!color) {
    alert('色を選択してください');
    return;
  }
  
  // URLの検証
  if (!url.includes('service-now.com') && !url.includes('servicenow.com')) {
    alert('ServiceNowのURLを入力してください');
    return;
  }
  
  // 環境を更新
  const environments = await getEnvironments();
  environments[editingIndex] = {
    ...environments[editingIndex],
    name,
    url,
    group: group || '',
    color
  };
  
  await saveEnvironments(environments);
  closeEditModal();
  displayEnvironments();
}

// 編集モーダルを閉じる
function closeEditModal() {
  console.log('closeEditModal called');
  document.getElementById('editModal').classList.remove('show');
  editingIndex = null;
}

// 環境に切り替え
async function switchEnvironment(env, index) {
  // アクセス履歴を更新
  const environments = await getEnvironments();
  environments[index].lastAccessed = Date.now();
  environments[index].accessCount = (environments[index].accessCount || 0) + 1;
  await saveEnvironments(environments);
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, { url: env.url });
      window.close();
    }
  });
}

// エクスポート機能
async function exportEnvironments() {
  const environments = await getEnvironments();
  const groups = await getGroups();
  
  if (environments.length === 0) {
    alert('エクスポートする環境がありません');
    return;
  }
  
  // 環境とグループをまとめてエクスポート
  const exportData = {
    environments,
    groups
  };
  
  // JSONファイルを生成
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  // ダウンロードリンクを作成
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `servicenow-environments-${new Date().toISOString().split('T')[0]}.json`;
  
  // ダウンロードを実行
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  alert(`${environments.length}件の環境と${groups.length}件のグループをエクスポートしました`);
}

// インポート機能
async function importEnvironments(file) {
  try {
    const text = await file.text();
    const importedData = JSON.parse(text);
    
    let importedEnvs, importedGroups;
    
    // 新形式（環境+グループ）か旧形式（環境のみ）か判定
    if (importedData.environments && Array.isArray(importedData.environments)) {
      importedEnvs = importedData.environments;
      importedGroups = importedData.groups || [];
    } else if (Array.isArray(importedData)) {
      // 旧形式（環境のみの配列）
      importedEnvs = importedData;
      importedGroups = [];
    } else {
      throw new Error('無効なファイル形式です');
    }
    
    // データの検証と初期化
    for (const env of importedEnvs) {
      if (!env.name || !env.url || !env.color) {
        throw new Error('環境データに必須項目が不足しています');
      }
      if (!env.lastAccessed) env.lastAccessed = null;
      if (!env.accessCount) env.accessCount = 0;
      if (!env.group) env.group = '';
    }
    
    // インポート方法を選択
    const merge = confirm(
      `${importedEnvs.length}件の環境と${importedGroups.length}件のグループが見つかりました。\n\n` +
      '「OK」: 既存のデータに追加\n' +
      '「キャンセル」: 既存のデータを上書き'
    );
    
    let environments, groups;
    if (merge) {
      // 既存に追加
      const existingEnvs = await getEnvironments();
      const existingGroups = await getGroups();
      environments = [...existingEnvs, ...importedEnvs];
      groups = [...new Set([...existingGroups, ...importedGroups])]; // 重複削除
    } else {
      // 上書き
      environments = importedEnvs;
      groups = importedGroups;
    }
    
    await saveEnvironments(environments);
    await saveGroups(groups);
    await updateGroupSelect();
    await displayEnvironments();
    
    alert(`${importedEnvs.length}件の環境と${importedGroups.length}件のグループをインポートしました`);
  } catch (error) {
    alert(`インポートに失敗しました: ${error.message}`);
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  await updateGroupSelect();
  await displayEnvironments();
  
  // 追加ボタンのイベントリスナー
  document.getElementById('addEnvBtn').addEventListener('click', addEnvironment);
  
  // グループ追加ボタン
  document.getElementById('addGroupBtn').addEventListener('click', addGroup);
  
  // エクスポートボタン
  document.getElementById('exportBtn').addEventListener('click', exportEnvironments);
  
  // インポートボタン
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  // インポートファイル選択
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importEnvironments(file);
      e.target.value = '';
    }
  });
  
  // Enterキーで追加
  document.getElementById('envUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addEnvironment();
    }
  });
  
  // モーダルのイベントリスナー
  document.getElementById('saveEditBtn').addEventListener('click', () => {
    console.log('Save button clicked');
    saveEdit();
  });
  
  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    console.log('Cancel button clicked');
    closeEditModal();
  });
  
  // モーダル背景クリックで閉じる
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
      closeEditModal();
    }
  });
});

console.log('Environment Switcher loaded');