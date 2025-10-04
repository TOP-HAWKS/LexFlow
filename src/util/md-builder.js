/**
 * Build markdown document with YAML frontmatter
 * @param {Object} data - Document data
 * @param {string} data.title - Document title
 * @param {string} data.jurisdiction - Legal jurisdiction
 * @param {string} data.language - Document language
 * @param {string} data.sourceUrl - Source URL
 * @param {string} data.versionDate - Version date
 * @param {string} data.content - Document content
 * @returns {string} - Formatted markdown with YAML frontmatter
 */
export function buildMarkdown({ title, jurisdiction, language, sourceUrl, versionDate, content }) {
  const safeTitle = title || "Untitled Extract";
  
  // Build YAML frontmatter
  const yaml = [
    "---",
    `title: "${escapeYaml(safeTitle)}"`,
    `jurisdiction: "${escapeYaml(jurisdiction || "unknown")}"`,
    `source_url: "${escapeYaml(sourceUrl || "")}"`,
    `version_date: "${versionDate || new Date().toISOString().split('T')[0]}"`,
    `language: "${language || "pt-BR"}"`,
    `license: "public-domain"`,
    `collected_at: "${new Date().toISOString()}"`,
    `capture_mode: "lexflow-extension"`,
    "---"
  ].join("\n");
  
  // Clean and format content
  const cleanContent = (content || '').trim();
  
  // Add document structure
  const markdown = [
    yaml,
    "",
    `# ${safeTitle}`,
    "",
    cleanContent
  ].join("\n");
  
  return markdown;
}

/**
 * Legacy function for backward compatibility
 */
export function buildMarkdownLegacy({ title, jurisdiction, language, source_url, version_date, selectionText }) {
  return buildMarkdown({
    title,
    jurisdiction,
    language,
    sourceUrl: source_url,
    versionDate: version_date,
    content: selectionText
  });
}

/**
 * Escape YAML special characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeYaml(str) {
  if (!str) return "";
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}