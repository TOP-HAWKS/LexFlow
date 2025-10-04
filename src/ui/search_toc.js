import { fetchMarkdown, splitByArticles } from '../util/markdown.js';
import { getSetting } from '../db.js';

let baseUrl, country, docSel, q;
async function init(){
  baseUrl = await getSetting('baseUrl');
  country = await getSetting('country');
  docSel = document.getElementById('doc');
  q = document.getElementById('q');
}
init();

document.getElementById('load').addEventListener('click', async ()=>{
  const path = `country/${country}/${docSel.value}`;
  const url = `${baseUrl}/${path}`;
  try{
    const md = await fetchMarkdown(url);
    const arts = splitByArticles(md);
    const term = (q.value||'').trim().toLowerCase();
    const filtered = term ? arts.filter(a=> a.text.toLowerCase().includes(term)) : arts;
    renderList(filtered.slice(0,200));
  }catch(e){
    document.getElementById('results').innerHTML = `<div class="error">${e.message}</div>`;
  }
});

function renderList(items){
  const root = document.getElementById('results');
  root.innerHTML = items.map((a,i)=>`
    <div class="row">
      <label><input type="checkbox" data-i="${i}"/> <b>${a.title}</b></label>
      <pre>${escapeHtml(a.text).slice(0,800)}${a.text.length>800?'…':''}</pre>
    </div>
  `).join('');

  root.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change', (ev)=>{
      const idx = Number(ev.target.dataset.i);
      const txt = items[idx].text;
      const ta = document.getElementById('context');
      if(ev.target.checked){
        ta.value += (ta.value? '\n\n' : '') + txt;
      }else{
        ta.value = ta.value.replace(txt,'').trim();
      }
    });
  });
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

document.getElementById('continue').addEventListener('click', ()=>{
  const context = document.getElementById('context').value.trim();
  sessionStorage.setItem('lexflow_context', context);
  window.open('prompt_result.html','_blank');
});