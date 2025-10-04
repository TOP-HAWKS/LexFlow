import { listSubmissions, updateSubmission } from '../db.js';
import { buildMarkdown } from '../util/md-builder.js';

const $ = s=>document.querySelector(s);
let current;

async function loadList(){
  const rows = await listSubmissions();
  if (!rows.length) {
    document.getElementById('list').innerHTML = '<div class="muted">No captured snippets yet. Select text on any page → right-click → "LexFlow: capture selected law/article".</div>';
    return;
  }
  document.getElementById('list').innerHTML = rows.map(r => `
    <div class="card">
      <div><b>${new Date(r.ts).toLocaleString()}</b> — <a href="${r.url}" target="_blank">${r.title||r.url}</a></div>
      <div class="muted">${(r.selectionText||'').slice(0,160)}${(r.selectionText||'').length>160?'…':''}</div>
      <button data-id="${r.id}">Edit</button>
    </div>
  `).join('');
  document.getElementById('list').querySelectorAll('button[data-id]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const all = await listSubmissions();
      current = all.find(x=> String(x.id) === btn.dataset.id);
      fillForm(current);
    });
  });
}
function fillForm(item){
  $('#title').value = item.title || '';
  $('#jurisdiction').value = item.jurisdiction || '';
  $('#language').value = item.lang || 'pt-BR';
  $('#source_url').value = item.url || '';
  $('#version_date').value = '';
  $('#text').value = item.selectionText || '';
  $('#md').value = '';
}
$('#btnGenMd').addEventListener('click', async ()=>{
  if(!current) return alert('Select an item.');
  const md = buildMarkdown({
    title: $('#title').value.trim(),
    jurisdiction: $('#jurisdiction').value.trim(),
    language: $('#language').value.trim(),
    source_url: $('#source_url').value.trim(),
    version_date: $('#version_date').value.trim(),
    selectionText: $('#text').value
  });
  $('#md').value = md;
  await updateSubmission(current.id, { status: 'curated', md });
});
$('#btnOpenIssue').addEventListener('click', ()=>{
  const md = $('#md').value.trim();
  if(!md) return alert('Generate Markdown first.');
  const title = encodeURIComponent(`[LexFlow] New legal extract: ${$('#title').value || 'Untitled'}`);
  const body = encodeURIComponent(md + `\n\nSource: ${$('#source_url').value}\nJurisdiction: ${$('#jurisdiction').value}`);
  const url = `https://github.com/ORG/REPO/issues/new?title=${title}&body=${body}`;
  window.open(url,'_blank');
});
loadList();