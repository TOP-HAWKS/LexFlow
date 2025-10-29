/**
 * Cloudflare Worker API Integration for LexFlow
 * Handles submission to corpus via production Worker endpoint
 */

/**
 * Submit content to corpus via Cloudflare Worker (creates PR to GitHub)
 * @param {Object} params - Submission parameters
 * @param {string} params.title - Document title
 * @param {string} params.markdown - Markdown content
 * @param {Object} params.metadata - Document metadata
 * @returns {Promise<Object>} Worker response with PR details
 */
export async function submitToCorpusPR({ title, markdown, metadata }) {
  const endpoint = getServerlessEndpoint();
  if (!endpoint) {
    throw new Error('Serverless endpoint missing. Check your settings.');
  }
  
  const payload = {
    title,
    markdown,
    metadata: {
      jurisdiction: metadata.jurisdiction || 'US/Federal',
      language: metadata.language || 'en-US',
      doc_type: metadata.doc_type || 'general',
      file_slug: metadata.file_slug || slugify(title),
      version_date: metadata.version_date || new Date().toISOString().split('T')[0],
      source_url: metadata.source_url || '',
      ...metadata
    }
  };
  
  console.log('[LexFlow] Submitting to corpus:', { endpoint, title });
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'LexFlow/1.0.0'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok || data.ok === false) {
      const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('[LexFlow] Worker error details:', { status: response.status, data, endpoint });
      throw new Error(errorMsg);
    }
    
    console.log('[LexFlow] Corpus submission successful:', data);
    return data; // { ok: true, url, branch, path }
    
  } catch (error) {
    console.error('[LexFlow] Corpus submission failed:', error);
    throw error;
  }
}

/**
 * Get serverless endpoint from settings
 * @returns {string|null} Serverless endpoint URL
 */
function getServerlessEndpoint() {
  try {
    const settings = JSON.parse(localStorage.getItem('lexflow-settings') || '{}');
    return settings.serverlessEndpoint || 'https://lexflow-corpus.webmaster-1d0.workers.dev';
  } catch (error) {
    console.error('[LexFlow] Error reading serverless endpoint:', error);
    return 'https://lexflow-corpus.webmaster-1d0.workers.dev';
  }
}

/**
 * Set serverless endpoint in settings
 * @param {string} endpoint - Serverless endpoint URL
 */
export function setServerlessEndpoint(endpoint) {
  try {
    const settings = JSON.parse(localStorage.getItem('lexflow-settings') || '{}');
    settings.serverlessEndpoint = endpoint;
    localStorage.setItem('lexflow-settings', JSON.stringify(settings));
    console.log('[LexFlow] Serverless endpoint updated:', endpoint);
  } catch (error) {
    console.error('[LexFlow] Error saving serverless endpoint:', error);
  }
}

/**
 * Create URL-friendly slug from title
 * @param {string} title - Title to slugify
 * @returns {string} URL-friendly slug
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Build markdown content from form data
 * @param {Object} formData - Form data object
 * @returns {string} Formatted markdown content
 */
export function buildMarkdownFromForm(formData) {
  const yaml = [
    "---",
    `title: "${escapeYaml(formData.title || 'Untitled')}"`,
    `jurisdiction: "${escapeYaml(formData.jurisdiction || 'unknown')}"`,
    `source_url: "${escapeYaml(formData.sourceUrl || '')}"`,
    `version_date: "${formData.versionDate || new Date().toISOString().split('T')[0]}"`,
    `language: "${formData.language || 'en-US'}"`,
    `doc_type: "${formData.docType || 'general'}"`,
    `license: "public-domain"`,
    `collected_at: "${new Date().toISOString()}"`,
    `capture_mode: "lexflow-extension"`,
    "---"
  ].join("\n");
  
  const content = [
    yaml,
    "",
    `# ${formData.title || 'Untitled'}`,
    "",
    formData.text || ''
  ].join("\n");
  
  return content;
}

/**
 * Escape YAML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeYaml(str) {
  if (!str) return "";
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}