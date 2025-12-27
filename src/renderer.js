const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');

let selectedIndex = 0;
let currentResults = [];

// Recherche en temps réel
searchInput.addEventListener('input', (e) => {
  const query = e.target.value;
  
  if (query.length === 0) {
    resultsDiv.innerHTML = '';
    return;
  }

  // Appeler la fonction de recherche (à implémenter)
  currentResults = window.electronAPI.searchFiles(query);
  displayResults(currentResults);
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
      if (items[selectedIndex]) {
        items[selectedIndex].click();
      }
      break;
      
    case 'Escape':
      window.electronAPI.hideWindow();
      break;
  }
});

function displayResults(results) {
  selectedIndex = 0;
  resultsDiv.innerHTML = results
    .map((result, index) => `
      <div class="result-item ${index === 0 ? 'selected' : ''}" data-index="${index}">
        ${result}
      </div>
    `)
    .join('');
  
  // Ajouter les événements click
  document.querySelectorAll('.result-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      console.log('Ouvrir:', results[index]);
      window.electronAPI.hideWindow();
    });
  });
}

function updateSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('selected', index === selectedIndex);
  });
  
  // Scroll automatique
  if (items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }
}

// Réinitialiser quand la fenêtre s'affiche
window.addEventListener('focus', () => {
  searchInput.value = '';
  resultsDiv.innerHTML = '';
  searchInput.focus();
});