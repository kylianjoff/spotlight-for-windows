const searchInput = document.getElementById('searchInput');
const appsSection = document.getElementById('appsSection');
const filesSection = document.getElementById('filesSection');
const webSection = document.getElementById('webSection');
const appResultsDiv = document.getElementById('appResults');
const fileResultsDiv = document.getElementById('fileResults');
const searchResultsDiv = document.getElementById('searchResults');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const languageSelect = document.getElementById('languageSelect');
const autoLaunchToggle = document.getElementById('autoLaunchToggle');
const updateBadge = document.getElementById('updateBadge');
const updateSection = document.getElementById('updateSection');
const newVersionSpan = document.getElementById('newVersion');
const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
const installUpdateBtn = document.getElementById('installUpdateBtn');
const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
const updateStatus = document.getElementById('updateStatus');
const downloadProgress = document.getElementById('downloadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Éléments du modal Quit
const quitAppBtn = document.getElementById('quitAppBtn');
const quitModal = document.getElementById('quitModal');
const closeQuitModal = document.getElementById('closeQuitModal');
const cancelQuitBtn = document.getElementById('cancelQuitBtn');
const confirmQuitBtn = document.getElementById('confirmQuitBtn');

let updateAvailable = false;

window.electronAPI.onUpdateAvailable((data) => {
  console.log('[Renderer] Mise à jour disponible:', data.version);
  updateAvailable = true;

  updateBadge.style.display = 'block';
  updateBadge.classList.add('pulse');

  newVersionSpan.textContent = data.version;
  updateSection.style.display = 'block';
  downloadUpdateBtn.style.display = 'block';
  installUpdateBtn.style.display = 'none';
  downloadProgress.style.display = 'none';
});

window.electronAPI.onUpdateNotAvailable(() => {
  console.log('[Renderer] Aucune mise à jour disponible');
  updateAvailable = false;
  updateBadge.style.display = 'none';
  updateSection.style.display = 'none';
});

window.electronAPI.onDownloadProgress((data) => {
  console.log('[Renderer] Téléchargement:', data.percent + '%');
  downloadProgress.style.display = 'block';
  progressFill.style.width = data.percent + '%';
  progressText.textContent = `${window.i18n.t('settings.downloadUpdate')}: ${data.percent}%`;
});

window.electronAPI.onUpdateDownloaded((data) => {
  console.log('[Renderer] Mise à jour téléchargée:', data.version);
  downloadUpdateBtn.style.display = 'none';
  installUpdateBtn.style.display = 'block';
  downloadProgress.style.display = 'none';
});

window.electronAPI.onUpdateError((error) => {
  console.error('[Renderer] Erreur mise à jour:', error);
  updateStatus.textContent = window.i18n.t('settings.updateError');
  updateStatus.style.color = '#ff6b6b';
});

downloadUpdateBtn.addEventListener('click', async () => {
  console.log('[Renderer] Début téléchargement mise à jour');
  downloadUpdateBtn.disabled = true;
  downloadUpdateBtn.textContent = window.i18n.t('settings.checkingUpdates');

  const result = await window.electronAPI.downloadUpdate();

  if(!result.success) {
    console.error('[Renderer] Erreur téléchargement:', result.error);
    alert('Erreur lors du téléchargement: ' + result.error);
    downloadUpdateBtn.disabled = false;
    downloadUpdateBtn.innerHTML = `<span data-i18n="settings.downloadUpdate"></span>`;
  }
});

installUpdateBtn.addEventListener('click', async () => {
  console.log('[Renderer] Installation de la mise à jour');
  const result = await window.electronAPI.installUpdate();

  if(!result.success) {
    console.error('[Renderer] Erreur installation:', result.error);
    alert('Erreur lors de l\'installation: ' + result.error);
  }
});

checkUpdatesBtn.addEventListener('click', async () => {
  console.log('[Renderer] Vérification manuelle des mises à jour');
  checkUpdatesBtn.disabled = true;
  updateStatus.textContent = window.i18n.t('settings.checkingUpdates');
  updateStatus.style.color = '#667eea';

  const result = await window.electronAPI.checkForUpdates();

  setTimeout(async () => {
    checkUpdatesBtn.disabled = false;

    const status = await window.electronAPI.getUpdateStatus();

    if(status.updateAvailable) {
      updateStatus.textContent = `Nouvelle version ${status.updateInfo.version} disponible !`;
      updateStatus.style.color = '#51cf66';
    } else {
      updateStatus.textContent = window.i18n.t('settings.upToDate');
      updateStatus.style.color = '#51cf66';
    }
  }, 2000);
});

async function checkUpdateStatus() {
  const status = await window.electronAPI.getUpdateStatus();

  if(status.updateAvailable) {
    updateBadge.style.display = 'block';
    newVersionSpan.textContent = status.updateInfo.version;
    updateSection.style.display = 'block';
  }
}

checkUpdateStatus();

async function loadAutoLaunchStatus() {
  console.log('[Renderer] Chargement statut auto-launch...');

  try {
    const realStatus = await window.electronAPI.getAutoLaunchStatus();
    console.log('[Renderer] Statut réel auto-launch:', realStatus);

    autoLaunchToggle.checked = realStatus;

    window.settings.set('autoLaunch', realStatus);
  } catch (error) {
    console.error('[Renderer] Erreur chargement auto-launch:', error);

    const savedStatus = window.settings.get('autoLaunch');
    autoLaunchToggle.checked = savedStatus || false;
  }
}

autoLaunchToggle.addEventListener('change', async (e) => {
  const newStatus = e.target.checked;
  console.log('[Renderer] Changement auto-launch:', newStatus);

  try {
    const result = await window.electronAPI.setAutoLaunch(newStatus);

    if (result.success) {
      console.log('[Renderer] Auto-launch modifié avec succès');

      window.settings.set('autoLaunch', newStatus);

      setTimeout(async () => {
        const verifyStatus = await window.electronAPI.getAutoLaunchStatus();
        if(verifyStatus !== newStatus) {
          console.warn('[Renderer] Statut auto-launch incohérent, correction...');
          autoLaunchToggle.checked = verifyStatus;
          window.settings.set('autoLaunch', verifyStatus);
        }
      }, 500);
    } else {
      console.error('[Renderer] Erreur:', result.error);
      autoLaunchToggle.checked = !newStatus;
      alert('Erreur lors de la modification du démarrage automatique');
    }
  } catch (error) {
    console.error('[Renderer] Erreur changement auto-launch:', error);
    autoLaunchToggle.checked = !newStatus;
  }
});

loadAutoLaunchStatus();

if(typeof window.i18n !== 'undefined') {
  console.log('[Renderer] i18n chargé, langue:', window.i18n.getCurrentLanguage());
  window.i18n.updateUI();
  languageSelect.value = window.i18n.getCurrentLanguage();
} else {
  console.error('[Renderer] ❌ i18n non disponible !');
}

languageSelect.addEventListener('change', (e) => {
  const newLang = e.target.value;
  console.log('[Renderer] Changement de langue:', newLang);
  window.i18n.setLanguage(newLang);
  console.log('[Renderer] Langue sauvegardée:', window.settings.get('language'));
});

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  console.log('[Renderer] Ouverture paramètres');

  loadAutoLaunchStatus();

  settingsModal.style.display = 'flex';
});

closeSettings.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if(e.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
});

let selectedIndex = 0;
let allResults = [];
let searchTimeout;

searchInput.addEventListener('input', async (e) => {
  const query = e.target.value;
  
  console.log('Query:', query);
  
  if (query.length === 0) {
    hideAllSections();
    allResults = [];
    return;
  }

  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    showSection(appsSection, `<div class="loading">${window.i18n.t('search.loading')}</div>`);
    showSection(filesSection, `<div class="loading">${window.i18n.t('search.loading')}</div>`);
    showSection(webSection, `<div class="loading">${window.i18n.t('search.loading')}</div>`);
    
    try {
      console.log('Appel searchFiles...');
      const results = await window.electronAPI.searchFiles(query);
      console.log('Résultats reçus:', results.length);
      
      const apps = results.filter(r => r.isApp);
      const files = results.filter(r => !r.isApp);
      
      displayApps(apps, query);
      displayFiles(files, query);
      displayWebSuggestions(query);
      
      allResults = [...apps, ...files];
      selectedIndex = 0;
      updateGlobalSelection();
      
    } catch (error) {
      console.error('Erreur recherche:', error);
      showSection(appsSection, `<div class="no-results">${window.i18n.t('search.error')}</div>`);
      hideSection(filesSection);
      hideSection(webSection);
    }
  }, 150);
});

async function displayApps(apps, query) {
  if (apps.length === 0) {
    hideSection(appsSection);
    return;
  }

  const maxApps = 5;
  const displayedApps = apps.slice(0, maxApps);
  
  const html = displayedApps
    .map((app, index) => {
      const displayName = app.displayName || app.name || 'Sans nom';
      const icon = app.icon || '⚙️';
      const source = app.source || '';

      const sourceKey = `source.${source.replace('_', '')}`;
      const sourceBadge = window.i18n.t(sourceKey) !== sourceKey ? window.i18n.t(sourceKey) : '';
      
      return `
        <div class="result-item app-item" data-global-index="${index}">
          <span class="result-icon">
            ${icon}
          </span>
          <div class="result-info">
            <div class="result-name">${escapeHtml(displayName)}</div>
            <div class="result-path">${sourceBadge ? `${sourceBadge} • ` : ''}${window.i18n.t('type.application')}</div>
          </div>
          <div class="result-action">
            <kbd>↵</kbd>
          </div>
        </div>
      `;
    })
    .join('');
  
  showSection(appsSection, html);
  
  displayedApps.forEach(async (app, index) => {
    const iconSpan = document.querySelector(`[data-global-index="${index}"] .result-icon`);
    if (!iconSpan) return;
    
    if (app.iconPath) {
      iconSpan.innerHTML = `<img src="${app.iconPath}" class="app-icon" alt="icon">`;
    } else {
      const iconPath = await window.electronAPI.getAppIcon(app.path);
      if (iconPath) {
        iconSpan.innerHTML = `<img src="${iconPath}" class="app-icon" alt="icon">`;
      }
    }
  });
  
  addClickHandlers(displayedApps, 0);
}

function displayFiles(files, query) {
  if (files.length === 0) {
    hideSection(filesSection);
    return;
  }

  const maxFiles = 8;
  const displayedFiles = files.slice(0, maxFiles);
  const appsCount = allResults.filter(r => r.isApp).length;
  
  const html = displayedFiles
    .map((file, index) => {
      const displayName = file.name || 'Sans nom';
      const directory = shortenPath(file.directory || '');
      const icon = file.icon || '📄';
      const type = file.type || 'file';
      
      const typeLabel = window.i18n.t(`type.${type}`);
      
      return `
        <div class="result-item file-item" data-global-index="${appsCount + index}">
          <span class="result-icon">
            ${icon}
          </span>
          <div class="result-info">
            <div class="result-name">${escapeHtml(displayName)}</div>
            <div class="result-path">${escapeHtml(directory)}</div>
          </div>
          <div class="result-meta">
            <span class="result-type">${typeLabel}</span>
          </div>
        </div>
      `;
    })
    .join('');
  
  showSection(filesSection, html);
  
  addClickHandlers(displayedFiles, appsCount);
}

function displayWebSuggestions(query) {
  const webSearches = [
    {
      engine: window.i18n.t('web.google'),
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      icon: '🔍'
    },
    {
      engine: window.i18n.t('web.wikipedia'),
      url: `https://fr.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
      icon: '📖'
    },
  ];
  
  const html = webSearches
    .map((search) => {
      const searchText = window.i18n.t('web.searchOn', {
        query: query,
        engine: search.engine
      });
      return `
        <div class="result-item web-item" data-url="${search.url}">
          <span class="result-icon">${search.icon}</span>
          <div class="result-info">
            <div class="result-name">${escapeHtml(searchText)}</div>
            <div class="result-path">${new URL(search.url).hostname}</div>
          </div>
          <div class="result-action">
            <kbd>↵</kbd>
          </div>
        </div>
      `;
    })
    .join('');
  
  showSection(webSection, html);
  
  document.querySelectorAll('.web-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      window.electronAPI.openUrl(url);
    });
  });
}

searchInput.addEventListener('keydown', (e) => {
  const items = document.querySelectorAll('.result-item');
  
  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateGlobalSelection();
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateGlobalSelection();
      break;
      
    case 'Enter':
      e.preventDefault();
      const selectedItem = items[selectedIndex];
      
      if (selectedItem && selectedItem.classList.contains('web-item')) {
        const url = selectedItem.getAttribute('data-url');
        window.electronAPI.openUrl(url);
      } else if (allResults[selectedIndex]) {
        openResult(allResults[selectedIndex]);
      }
      break;
      
    case 'Escape':
      window.electronAPI.hideWindow();
      break;
  }
});

function updateGlobalSelection() {
  const items = document.querySelectorAll('.result-item');
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });
  
  if (items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function addClickHandlers(results, offset) {
  results.forEach((result, index) => {
    const item = document.querySelector(`[data-global-index="${offset + index}"]`);
    if (item) {
      item.addEventListener('click', () => {
        openResult(result);
      });
    }
  });
}

async function openResult(result) {
  console.log('Ouverture de:', result.path);
  try {
    const response = await window.electronAPI.openFile(result.path);
    if (response.success) {
      window.electronAPI.hideWindow();
    } else {
      console.error('Erreur ouverture:', response.error);
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
}

function showSection(section, html) {
  section.style.display = 'block';
  const resultsDiv = section.querySelector('.section-results');
  resultsDiv.innerHTML = html;
}

function hideSection(section) {
  section.style.display = 'none';
}

function hideAllSections() {
  appsSection.style.display = 'none';
  filesSection.style.display = 'none';
  webSection.style.display = 'none';
}

function shortenPath(pathStr) {
  const maxLength = 50;
  if (pathStr.length <= maxLength) return pathStr;
  
  const parts = pathStr.split('\\');
  if (parts.length <= 3) return pathStr;
  
  return parts[0] + '\\...\\' + parts.slice(-2).join('\\');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener('focus', () => {
  searchInput.value = '';
  hideAllSections();
  allResults = [];
  searchInput.focus();
});

window.addEventListener('languageChanged', () => {
  console.log('Langue changée:', window.i18n.getCurrentLanguage());

  if(allResults.length > 0) {
    const apps = allResults.filter(r => r.isApp);
    const files = allResults.filter(r => !r.isApp);
    const query = searchInput.value;

    displayApps(apps, query);
    displayFiles(files, query);
    displayWebSuggestions(query);
  }
});

// ========================================
// GESTION DU BOUTON QUIT
// ========================================

// Ouvrir le modal de confirmation
quitAppBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  console.log('[Renderer] Ouverture modal Quit');
  quitModal.style.display = 'flex';
});

// Fermer le modal (bouton X)
closeQuitModal.addEventListener('click', () => {
  quitModal.style.display = 'none';
});

// Annuler
cancelQuitBtn.addEventListener('click', () => {
  quitModal.style.display = 'none';
});

// Confirmer et quitter
confirmQuitBtn.addEventListener('click', async () => {
  console.log('[Renderer] Confirmation quit, fermeture de l\'application');
  await window.electronAPI.quitApp();
});

// Fermer le modal en cliquant en dehors
quitModal.addEventListener('click', (e) => {
  if (e.target === quitModal) {
    quitModal.style.display = 'none';
  }
});

console.log('[Renderer] ✅ Renderer.js chargé');