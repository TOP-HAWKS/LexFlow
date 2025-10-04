export function buildMarkdown({ title, jurisdiction, language, source_url, version_date, selectionText }) {
  const safeTitle = title || "Untitled Extract";
  const yaml = [
    "---",
    `title: "${escapeYaml(safeTitle)}"`,
    `jurisdiction: "${jurisdiction || "unknown"}"`,
    `source_url: "${source_url || ""}"`,
    `version_date: "${version_date || ""}"`,
    `language: "${language || "und"}"`,
    `license: "public-domain"`,
    `collected_at: "${new Date().toISOString()}"`,
    "---"
  ].join("\n");
  return `${yaml}\n\n${(selectionText||'').trim()}\n`;
}
function escapeYaml(s){ return (s||"").replace(/"/g,'\"'); }