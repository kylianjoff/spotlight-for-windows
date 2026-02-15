const { parentPort } = require('worker_threads');
const FileSearcher = require('./search.js');

const searcher = new FileSearcher();

parentPort.on('message', async (message) => {
  const { id, type, payload } = message || {};

  try {
    if (type === 'build-index') {
      await searcher.buildIndex();
      parentPort.postMessage({ id, result: true });
      return;
    }

    if (type === 'search') {
      const searchId = payload?.searchId || 0;
      searcher.currentSearchId = searchId;
      const results = await searcher.searchAsync(payload?.query, payload?.limit || 15, searchId);
      parentPort.postMessage({ id, result: results });
      return;
    }

    parentPort.postMessage({ id, error: 'Type de message inconnu' });
  } catch (error) {
    parentPort.postMessage({ id, error: error?.message || String(error) });
  }
});

parentPort.postMessage({ type: 'ready' });
