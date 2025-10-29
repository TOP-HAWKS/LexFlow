/**
 * LexFlow Content Script
 * Handles content capture from web pages
 */

/**
 * Get selected text from the page
 * @returns {string} Selected text
 */
function getSelectionText() {
  const selection = window.getSelection();
  return selection && selection.toString ? selection.toString().trim() : "";
}

/**
 * Get full page text content
 * @returns {string} Full page text (limited to 50k characters)
 */
function getFullPageText() {
  // Try to get main content first
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main'
  ];

  let content = '';

  // Try to find main content area
  for (const selector of mainSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.innerText || element.textContent || '';
      break;
    }
  }

  // Fallback to body if no main content found
  if (!content) {
    content = document.body.innerText || document.body.textContent || '';
  }

  const cleanText = content.trim();

  // Limit to 50,000 characters
  if (cleanText.length > 50000) {
    return cleanText.substring(0, 50000) + "\n\n[Conteúdo truncado em 50.000 caracteres]";
  }

  return cleanText;
}

/**
 * Extract metadata from the page
 * @returns {Object} Page metadata
 */
function extractPageMetadata() {
  const metadata = {
    title: document.title || '',
    url: location.href,
    domain: location.hostname,
    language: document.documentElement.lang || navigator.language || 'pt-BR',
    sourceHint: '',
    description: '',
    keywords: [],
    author: '',
    publishDate: null
  };

  // Extract meta tags
  const metaTags = document.querySelectorAll('meta');
  metaTags.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');

    if (!name || !content) return;

    switch (name.toLowerCase()) {
      case 'description':
      case 'og:description':
        metadata.description = content;
        break;
      case 'keywords':
        metadata.keywords = content.split(',').map(k => k.trim());
        break;
      case 'author':
      case 'article:author':
        metadata.author = content;
        break;
      case 'citation_title':
        metadata.sourceHint = content;
        break;
      case 'article:published_time':
      case 'datePublished':
        metadata.publishDate = content;
        break;
    }
  });

  // Try to detect if this is a legal document
  const legalIndicators = [
    'lei', 'código', 'constituição', 'decreto', 'portaria', 'resolução',
    'artigo', 'art.', 'inciso', 'parágrafo', '§', 'jurisprudência',
    'tribunal', 'supremo', 'stf', 'stj', 'tjrs', 'tjsp'
  ];

  const pageText = (metadata.title + ' ' + metadata.description).toLowerCase();
  const isLegalContent = legalIndicators.some(indicator => pageText.includes(indicator));

  if (isLegalContent) {
    metadata.sourceHint = metadata.sourceHint || 'Legal document detected';
  }

  return metadata;
}

/**
 * Create capture payload with all necessary data
 * @param {string} text - Captured text
 * @param {string} mode - Capture mode ('selection' or 'fullpage')
 * @returns {Object} Capture payload
 */
function createCapturePayload(text, mode) {
  const metadata = extractPageMetadata();

  return {
    type: "LEXFLOW_CAPTURE_PAYLOAD",
    data: {
      text: text,
      mode: mode,
      title: metadata.title,
      url: metadata.url,
      domain: metadata.domain,
      language: metadata.language,
      source_url: metadata.url,
      version_date: new Date().toISOString().split('T')[0],
      jurisdiction: detectJurisdiction(metadata),
      sourceHint: metadata.sourceHint,
      metadata: {
        description: metadata.description,
        keywords: metadata.keywords,
        author: metadata.author,
        publishDate: metadata.publishDate,
        isLegalContent: !!metadata.sourceHint
      },
      timestamp: Date.now()
    }
  };
}

/**
 * Try to detect jurisdiction from page content and URL
 * @param {Object} metadata - Page metadata
 * @returns {Object|null} Detected jurisdiction
 */
function detectJurisdiction(metadata) {
  const url = metadata.url.toLowerCase();
  const text = (metadata.title + ' ' + metadata.description).toLowerCase();

  // Brazilian federal sites
  if (url.includes('planalto.gov.br') || url.includes('senado.leg.br') ||
    url.includes('camara.leg.br') || url.includes('stf.jus.br')) {
    return { country: 'br', level: 'federal' };
  }

  // Brazilian state sites
  if (url.includes('tjrs.jus.br') || text.includes('rio grande do sul')) {
    return { country: 'br', state: 'rs', level: 'state' };
  }

  if (url.includes('tjsp.jus.br') || text.includes('são paulo')) {
    return { country: 'br', state: 'sp', level: 'state' };
  }

  // Brazilian municipal sites
  if (url.includes('portoalegre.rs.gov.br') || text.includes('porto alegre')) {
    return { country: 'br', state: 'rs', city: 'porto-alegre', level: 'municipal' };
  }

  // Default to Brazilian federal if legal content detected
  const legalIndicators = ['lei', 'código', 'constituição', 'decreto'];
  if (legalIndicators.some(indicator => text.includes(indicator))) {
    return { country: 'br', level: 'federal' };
  }

  return null;
}

/**
 * Send error message to service worker
 * @param {string} error - Error message
 */
function sendError(error) {
  chrome.runtime.sendMessage({
    type: "LEXFLOW_CAPTURE_ERROR",
    error: error
  });
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LEXFLOW_GET_SELECTION") {
    try {
      const text = getSelectionText();
      if (!text || text.length < 10) {
        sendError("Nenhum texto selecionado ou texto muito curto (mínimo 10 caracteres)");
        return;
      }

      const payload = createCapturePayload(text, 'selection');
      chrome.runtime.sendMessage(payload);

    } catch (error) {
      console.error('Error capturing selection:', error);
      sendError("Error capturing selected text: " + error.message);
    }
  }
  else if (message?.type === "LEXFLOW_GET_FULLPAGE") {
    try {
      const text = getFullPageText();
      if (!text || text.length < 50) {
        sendError("Nenhum conteúdo legível encontrado nesta página");
        return;
      }

      const payload = createCapturePayload(text, 'fullpage');
      chrome.runtime.sendMessage(payload);

    } catch (error) {
      console.error('Error capturing full page:', error);
      sendError("Error capturing full page: " + error.message);
    }
  }
});

// Add visual feedback when content is captured
function showCaptureSuccess(mode) {
  // Create temporary success indicator
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #27ae60;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: lexflowSlideIn 0.3s ease;
  `;

  indicator.textContent = mode === 'selection' ?
    '✓ Texto capturado pelo LexFlow' :
    '✓ Página capturada pelo LexFlow';

  // Add animation styles
  if (!document.getElementById('lexflow-styles')) {
    const styles = document.createElement('style');
    styles.id = 'lexflow-styles';
    styles.textContent = `
      @keyframes lexflowSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes lexflowSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(indicator);

  // Remove after 3 seconds
  setTimeout(() => {
    indicator.style.animation = 'lexflowSlideOut 0.3s ease';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }, 3000);
}

// Listen for successful captures to show feedback
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CONTENT_CAPTURED") {
    showCaptureSuccess(message.data.mode);
  }
});

console.log('LexFlow content script loaded');