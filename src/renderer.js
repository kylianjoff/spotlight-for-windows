const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');

let selectedIndex = 0;
let currentResults = [];
let searchTimeout;

// Recherche en temps réel avec debounce
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value;
  
  console.log('Query:', query);
  
  if (query.length === 0) {
    resultsDiv.innerHTML = '';
    currentResults = [];
    return;
  }

  // Debounce
  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    // Afficher un loader
    resultsDiv.innerHTML = '<div class="loading">Recherche...</div>';
    
    try {
      console.log('Appel searchFiles...');
      currentResults = await window.electronAPI.searchFiles(query);
      console.log('Résultats reçus:', currentResults.length);
      
      // IMPORTANT: Appeler displayResults
      displayResults(currentResults);
      
    } catch (error) {
      console.error('Erreur recherche:', error);
      resultsDiv.innerHTML = '<div class="no-results">Erreur: ' + error.message + '</div>';
    }
  }, 150);
});

// Navigation au clavier
searchInput.addEventListener('keydown', (e) => {
  const items = document.querySelectorAll('.result-item');
  
  switch(e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items);
      break;
      
    case 'Enter':
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        openResult(currentResults[selectedIndex]);
      }
      break;
      
    case 'Escape':
      window.electronAPI.hideWindow();
      break;
  }
});

function displayResults(results) {
  console.log('displayResults appelé avec', results.length, 'résultats');
  
  selectedIndex = 0;
  
  if (!results || results.length === 0) {
    resultsDiv.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
    return;
  }
  
  try {
    const html = results
      .map((result, index) => {
        const name = result.name || 'Sans nom';
        const directory = result.directory || '';
        const icon = result.icon || '📄';
        const type = result.type || 'file';
        const isApp = result.isApp || false;
        
        return `
          <div class="result-item ${index === 0 ? 'selected' : ''}" 
               data-index="${index}"
               data-is-app="${isApp}">
            <span class="result-icon">${icon}</span>
            <div class="result-info">
              <div class="result-name">${escapeHtml(name)}</div>
              <div class="result-path">${escapeHtml(shortenPath(directory))}</div>
            </div>
            <div class="result-meta">
              <span class="result-type">${isApp ? 'APP' : type}</span>
            </div>
          </div>
        `;
      })
      .join('');
    
    resultsDiv.innerHTML = html;
    
    document.querySelectorAll('.result-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        openResult(currentResults[index]);
      });
    });
    
  } catch (error) {
    console.error('Erreur dans displayResults:', error);
    resultsDiv.innerHTML = '<div class="no-results">Erreur affichage</div>';
  }
}

// Raccourcir les chemins trop longs
function shortenPath(pathStr) {
  const maxLength = 60;
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

async function openResult(result) {
  console.log('Ouverture de:', result.path);
  try {
    const response = await window.electronAPI.openFile(result.path);
    if (response.success) {
      window.electronAPI.hideWindow();
    } else {
      console.error('Erreur ouverture:', response.error);
      alert('Impossible d\'ouvrir: ' + response.error);
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
}

function updateSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });
  
  if (items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Réinitialiser quand la fenêtre s'affiche
window.addEventListener('focus', () => {
  searchInput.value = '';
  resultsDiv.innerHTML = '';
  currentResults = [];
  searchInput.focus();
});

console.log('Renderer.js chargé');