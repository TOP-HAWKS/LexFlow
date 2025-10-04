export async function fetchMarkdown(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Markdown fetch error: '+res.status);
  return res.text();
}
export function splitByArticles(mdText){
  const parts = mdText.split(/\n(?=##\s*Art\.\s*\d+)/i);
  const out = [];
  for(const p of parts){
    if(!p.trim()) continue;
    const m = p.match(/##\s*(Art\.\s*\d+[^\n]*)/i);
    out.push({ title: m ? m[1].trim() : 'Section', text: p.trim() });
  }
  return out;
}