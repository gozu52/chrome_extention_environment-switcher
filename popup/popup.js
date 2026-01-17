// 編集中の環境インデックスを保持
let editingIndex = null;

// テーマ設定
let currentTheme = 'light';

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
  
  // 各グループ内でソート（お気に入り優先、次にアクセス日時）
  Object.keys(groupedEnvs).forEach(group => {
    groupedEnvs[group].sort((a, b) => {
      // お気に入り優先
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      
      // 同じお気に入り状態なら、アクセス日時順
      const timeA = a.lastAccessed || 0;
      const timeB = b.lastAccessed || 0;
      return timeB - timeA;
    });
  });
  
  // グループなし環境をソート（お気に入り優先、次にアクセス日時）
  ungroupedEnvs.sort((a, b) => {
    // お気に入り優先
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    
    // 同じお気に入り状態なら、アクセス日時順
    const timeA = a.lastAccessed || 0;
    const timeB = b.lastAccessed || 0;
    return timeB - timeA;
  });
  
  // HTML生成
  let html = '';
  
  // グループあり環境を表示
  groups.forEach((group, index) => {
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
    <div class="group-container" draggable="true" data-group="${groupName}">
      <div class="group-header" data-group="${groupName}">
        <div class="group-header-left">
          <span class="group-toggle">▼</span>
          <span class="group-name">${groupName}</span>
          <span class="group-count">(${envs.length})</span>
        </div>
        <div class="group-actions">
          <button class="group-edit-btn" data-group="${groupName}">編集</button>
          <button class="group-delete-btn" data-group="${groupName}">削除</button>
        </div>
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
  const favoriteIcon = env.isFavorite ? '⭐' : '☆';
  const favoriteClass = env.isFavorite ? 'is-favorite' : '';
  const memoDisplay = env.memo ? `<div class="env-memo">📝 ${env.memo}</div>` : '';
  
  return `
    <div class="env-item ${currentClass} ${favoriteClass}" 
         style="border-left-color: ${env.color};" 
         data-index="${env.originalIndex}">
      <button class="favorite-btn" data-index="${env.originalIndex}" title="お気に入り">${favoriteIcon}</button>
      <div class="env-info">
        <div class="env-name">${env.name} ${currentBadge}</div>
        <div class="env-url">${env.url}</div>
        ${memoDisplay}
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
      if (!e.target.classList.contains('group-delete-btn') && 
          !e.target.classList.contains('group-edit-btn')) {
        const groupName = header.dataset.group;
        const groupEnvs = document.querySelector(`.group-environments[data-group="${groupName}"]`);
        const toggle = header.querySelector('.group-toggle');
        
        groupEnvs.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
      }
    });
  });
  
  // グループのドラッグ&ドロップ
  let draggedGroup = null;
  
  document.querySelectorAll('.group-container').forEach(container => {
    // ドラッグ開始
    container.addEventListener('dragstart', (e) => {
      draggedGroup = container.dataset.group;
      container.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });
    
    // ドラッグ終了
    container.addEventListener('dragend', (e) => {
      container.style.opacity = '1';
      draggedGroup = null;
      document.querySelectorAll('.group-container').forEach(c => {
        c.classList.remove('drag-over');
      });
    });
    
    // ドラッグオーバー
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (draggedGroup && draggedGroup !== container.dataset.group) {
        container.classList.add('drag-over');
      }
    });
    
    // ドラッグリーブ
    container.addEventListener('dragleave', (e) => {
      container.classList.remove('drag-over');
    });
    
    // ドロップ
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      
      if (draggedGroup && draggedGroup !== container.dataset.group) {
        await reorderGroups(draggedGroup, container.dataset.group);
      }
    });
  });
  
  // グループ編集ボタン
  document.querySelectorAll('.group-edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupName = btn.dataset.group;
      await editGroup(groupName);
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
      if (!e.target.classList.contains('delete-btn') && 
          !e.target.classList.contains('edit-btn') &&
          !e.target.classList.contains('favorite-btn')) {
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
  
  // お気に入りボタンイベント
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      await toggleFavorite(index);
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

// グループ名を編集
async function editGroup(oldGroupName) {
  const newGroupName = prompt('新しいグループ名を入力してください:', oldGroupName);
  
  if (!newGroupName || newGroupName.trim() === '') return;
  if (newGroupName === oldGroupName) return;
  
  const groups = await getGroups();
  
  // 重複チェック
  if (groups.includes(newGroupName.trim())) {
    alert('このグループ名は既に存在します');
    return;
  }
  
  // グループリストを更新
  const groupIndex = groups.indexOf(oldGroupName);
  if (groupIndex !== -1) {
    groups[groupIndex] = newGroupName.trim();
  }
  await saveGroups(groups);
  
  // 環境のグループ名を更新
  const environments = await getEnvironments();
  environments.forEach(env => {
    if (env.group === oldGroupName) {
      env.group = newGroupName.trim();
    }
  });
  await saveEnvironments(environments);
  
  // 表示を更新
  await updateGroupSelect();
  await displayEnvironments();
}

// グループを並び替え（ドラッグ&ドロップ用）
async function reorderGroups(draggedGroupName, targetGroupName) {
  const groups = await getGroups();
  const fromIndex = groups.indexOf(draggedGroupName);
  const toIndex = groups.indexOf(targetGroupName);
  
  if (fromIndex === -1 || toIndex === -1) return;
  
  // 配列内で要素を移動
  const [movedGroup] = groups.splice(fromIndex, 1);
  groups.splice(toIndex, 0, movedGroup);
  
  await saveGroups(groups);
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
    accessCount: 0,
    isFavorite: false,
    memo: ''
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

  // メモを設定
  document.getElementById('editEnvMemo').value = env.memo || '';
  
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
  
  const memo = document.getElementById('editEnvMemo').value.trim();
  
  // 環境を更新
  const environments = await getEnvironments();
  environments[editingIndex] = {
    ...environments[editingIndex],
    name,
    url,
    group: group || '',
    color,
    memo: memo || ''
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
  
  // 同じレコードを保持する設定を取得
  const preserveRecord = await getPreserveRecord();
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const currentUrl = tabs[0].url;
      let targetUrl = env.url;
      
      // 設定がONで、現在のURLがServiceNowの場合、パスとパラメータを保持
      if (preserveRecord && (currentUrl.includes('service-now.com') || currentUrl.includes('servicenow.com'))) {
        try {
          const currentUrlObj = new URL(currentUrl);
          const targetUrlObj = new URL(env.url);
          
          // パスとクエリパラメータを保持
          targetUrlObj.pathname = currentUrlObj.pathname;
          targetUrlObj.search = currentUrlObj.search;
          targetUrlObj.hash = currentUrlObj.hash;
          
          targetUrl = targetUrlObj.toString();
        } catch (e) {
          console.error('URL parsing error:', e);
          // エラーの場合は通常のURL切り替え
        }
      }
      
      chrome.tabs.update(tabs[0].id, { url: targetUrl });
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
      if (env.isFavorite === undefined) env.isFavorite = false;
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

// テーマを取得
async function getTheme() {
  const result = await chrome.storage.sync.get(['theme']);
  return result.theme || 'light';
}

// 同じレコードを保持する設定を取得
async function getPreserveRecord() {
  const result = await chrome.storage.sync.get(['preserveRecord']);
  return result.preserveRecord !== false; // デフォルトはtrue
}

// 同じレコードを保持する設定を保存
async function savePreserveRecord(preserve) {
  await chrome.storage.sync.set({ preserveRecord: preserve });
}

// プリフィックス表示設定を取得
async function getPrefixEnabled() {
  const result = await chrome.storage.sync.get(['prefixEnabled']);
  return result.prefixEnabled !== false; // デフォルトはtrue
}

// プリフィックス表示設定を保存
async function savePrefixEnabled(enabled) {
  await chrome.storage.sync.set({ prefixEnabled: enabled });
  
  // Content Scriptに設定変更を通知
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && (tab.url.includes('service-now.com') || tab.url.includes('servicenow.com'))) {
        chrome.tabs.sendMessage(tab.id, { action: 'updatePrefix' }).catch(() => {
          // エラーは無視（タブが対応していない場合）
        });
      }
    });
  });
}

// テーマを保存
async function saveTheme(theme) {
  await chrome.storage.sync.set({ theme });
}

// テーマを適用
function applyTheme(theme) {
  const body = document.body;
  
  if (theme === 'auto') {
    // システム設定を確認
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  } else if (theme === 'dark') {
    body.classList.add('dark-theme');
  } else {
    body.classList.remove('dark-theme');
  }
  
  currentTheme = theme;
}

// 設定モーダルを開く
async function openSettingsModal() {
  const theme = await getTheme();
  const preserveRecord = await getPreserveRecord();
  const prefixEnabled = await getPrefixEnabled();
  
  document.getElementById('themeSelect').value = theme;
  document.getElementById('preserveRecordCheckbox').checked = preserveRecord;
  document.getElementById('prefixEnabledCheckbox').checked = prefixEnabled;
  
  document.getElementById('settingsModal').classList.add('show');
}

// 設定モーダルを閉じる
function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('show');
}

// テーマ変更を保存
async function saveThemeSettings() {
  const theme = document.getElementById('themeSelect').value;
  await saveTheme(theme);
  applyTheme(theme);
}

// お気に入りを切り替え
async function toggleFavorite(index) {
  const environments = await getEnvironments();
  environments[index].isFavorite = !environments[index].isFavorite;
  await saveEnvironments(environments);
  displayEnvironments();
}

// 環境の順序を入れ替え
async function reorderEnvironments(fromIndex, toIndex) {
  const environments = await getEnvironments();
  
  // 配列内で要素を移動
  const [movedEnv] = environments.splice(fromIndex, 1);
  environments.splice(toIndex, 0, movedEnv);
  
  await saveEnvironments(environments);
  await displayEnvironments();
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // テーマを読み込んで適用
  const savedTheme = await getTheme();
  applyTheme(savedTheme);
  
  // システム設定の変更を監視（autoモードの場合）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'auto') {
      applyTheme('auto');
    }
  });
  
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
  
  // 設定ボタン
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  
  // 設定モーダルを閉じる
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettingsModal);
  
  // テーマ変更
  document.getElementById('themeSelect').addEventListener('change', saveThemeSettings);
  
  // 同じレコード保持設定の変更
  document.getElementById('preserveRecordCheckbox').addEventListener('change', async (e) => {
    await savePreserveRecord(e.target.checked);
  });

  // プリフィックス表示設定の変更
  document.getElementById('prefixEnabledCheckbox').addEventListener('change', async (e) => {
    await savePrefixEnabled(e.target.checked);
  });

  // 設定モーダル背景クリックで閉じる
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
      closeSettingsModal();
    }
  });
});

console.log('Environment Switcher loaded');