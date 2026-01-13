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

// Charger le statut auto-launch
async function loadAutoLaunchStatus() {
  const status = await window.electronAPI.getAutoLaunchStatus();
  autoLaunchToggle.checked = status;
}

// Changer le statut auto-launch
autoLaunchToggle.addEventListener('change', async (e) => {
  const result = await window.electronAPI.setAutoLaunch(e.target.checked);
  if(!result.success) {
    console.error('[AutoLaunch] Erreur:', result.error);
    e.target.checked = !e.target.checked;
  }
})

// Charger au démarrage
loadAutoLaunchStatus();

// Initialiser la langue
i18n.updateUI();
languageSelect.value = i18n.getCurrentLanguage();

// Event listener pour changer la langue
languageSelect.addEventListener('change', (e) => {
  i18n.setLanguage(e.target.value);
});

// Ouvrir/fermer les paramètres
settingsBtn.addEventListener('click', () => {
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
let allResults = []; // Tous les résultats combinés pour la navigation
let searchTimeout;

// Recherche en temps réel avec debounce
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value;
  
  console.log('Query:', query);
  
  if (query.length === 0) {
    hideAllSections();
    allResults = [];
    return;
  }

  // Debounce
  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    // Afficher loaders
    showSection(appsSection, `<div class="loading">${i18n.t('search.loading')}</div>`);
    showSection(filesSection, `<div class="loading">${i18n.t('search.loading')}</div>`);
    showSection(webSection, `<div class="loading">${i18n.t('search.loading')}</div>`);
    
    try {
      console.log('Appel searchFiles...');
      const results = await window.electronAPI.searchFiles(query);
      console.log('Résultats reçus:', results.length);
      
      // Séparer applications et fichiers
      const apps = results.filter(r => r.isApp);
      const files = results.filter(r => !r.isApp);
      
      // Afficher les résultats
      displayApps(apps, query);
      displayFiles(files, query);
      displayWebSuggestions(query);
      
      // Construire la liste globale pour navigation clavier
      allResults = [...apps, ...files];
      selectedIndex = 0;
      updateGlobalSelection();
      
    } catch (error) {
      console.error('Erreur recherche:', error);
      showSection(appsSection, `<div class="no-results">${i18n.t('search.error')}</div>`);
      hideSection(filesSection);
      hideSection(webSection);
    }
  }, 150);
});

// Afficher les applications
async function displayApps(apps, query) {
  if (apps.length === 0) {
    hideSection(appsSection);
    return;
  }

  const maxApps = 5; // Limiter à 5 apps
  const displayedApps = apps.slice(0, maxApps);
  
  const html = displayedApps
    .map((app, index) => {
      const displayName = app.displayName || app.name || 'Sans nom';
      const icon = app.icon || '⚙️';
      const source = app.source || '';

      const sourceKey = `source.${source.replace('_', '')}`;
      const sourceBadge = i18n.t(sourceKey) !== sourceKey ? i18n.t(sourceKey) : '';
      
      return `
        <div class="result-item app-item" data-global-index="${index}">
          <span class="result-icon">
            ${icon}
          </span>
          <div class="result-info">
            <div class="result-name">${escapeHtml(displayName)}</div>
            <div class="result-path">${sourceBadge ? `${sourceBadge} • ` : ''}${i18n.t('type.application')}</div>
          </div>
          <div class="result-action">
            <kbd>↵</kbd>
          </div>
        </div>
      `;
    })
    .join('');
  
  showSection(appsSection, html);
  
  // Charger les icônes des apps
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
  
  // Ajouter les événements click
  addClickHandlers(displayedApps, 0);
}

// Afficher les fichiers
function displayFiles(files, query) {
  if (files.length === 0) {
    hideSection(filesSection);
    return;
  }

  const maxFiles = 8; // Limiter à 8 fichiers
  const displayedFiles = files.slice(0, maxFiles);
  const appsCount = allResults.filter(r => r.isApp).length;
  
  const html = displayedFiles
    .map((file, index) => {
      const displayName = file.name || 'Sans nom';
      const directory = shortenPath(file.directory || '');
      const icon = file.icon || '📄';
      const type = file.type || 'file';
      
      const typeLabel = i18n.t(`type.${type}`);
      
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
  
  // Ajouter les événements click
  addClickHandlers(displayedFiles, appsCount);
}

// Afficher suggestions web
function displayWebSuggestions(query) {
  const webSearches = [
    {
      engine: i18n.t('web.google'),
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      icon: '🔍'
    },
    {
      engine: i18n.t('web.wikipedia'),
      url: `https://fr.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
      icon: '📖'
    },
  ];
  
  const html = webSearches
    .map((search) => {
      const searchText = i18n.t('web.searchOn', {
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
  
  // Ajouter événements click pour ouvrir dans le navigateur
  document.querySelectorAll('.web-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      window.electronAPI.openUrl(url);
    });
  });
}

// Navigation au clavier
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
      
      if (selectedItem.classList.contains('web-item')) {
        // Ouvrir URL web
        const url = selectedItem.getAttribute('data-url');
        window.electronAPI.openUrl(url);
      } else if (allResults[selectedIndex]) {
        // Ouvrir fichier/app
        openResult(allResults[selectedIndex]);
      }
      break;
      
    case 'Escape':
      window.electronAPI.hideWindow();
      break;
  }
});

// Mettre à jour la sélection globale
function updateGlobalSelection() {
  const items = document.querySelectorAll('.result-item');
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });
  
  if (items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Ajouter les handlers de click
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

// Ouvrir un résultat
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

// Utilitaires d'affichage
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

// Raccourcir les chemins
function shortenPath(pathStr) {
  const maxLength = 50;
  if (pathStr.length <= maxLength) return pathStr;
  
  const parts = pathStr.split('\\');
  if (parts.length <= 3) return pathStr;
  
  return parts[0] + '\\...\\' + parts.slice(-2).join('\\');
}

// Échapper HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Réinitialiser à l'ouverture
window.addEventListener('focus', () => {
  searchInput.value = '';
  hideAllSections();
  allResults = [];
  searchInput.focus();
});

// Ecouter les changements de langue
window.addEventListener('languageChanged', () => {
  console.log('Langue changée:', i18n.getCurrentLanguage());

  if(allResults.length > 0) {
    const apps = allResults.filter(r => r.isApp);
    const files = allResults.filter(r => !r.isApp);
    const query = searchInput.value;

    displayApps(apps, query);
    displayFiles(files, query);
    displayWebSuggestions(query);
  }
})

console.log('Renderer.js chargé');