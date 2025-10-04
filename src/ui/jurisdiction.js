import { setSetting, getSetting } from '../db.js';

async function init(){
  document.getElementById('baseUrl').value =
    await getSetting('baseUrl') || 'https://raw.githubusercontent.com/ORG/legal-corpus/main';
}
document.getElementById('save').addEventListener('click', async ()=>{
  const payload = {
    lang: document.getElementById('lang').value,
    country: document.getElementById('country').value,
    state: document.getElementById('state').value,
    city: document.getElementById('city').value,
    baseUrl: document.getElementById('baseUrl').value.trim()
  };
  await Promise.all(Object.entries(payload).map(([k,v])=> setSetting(k,v)));
  window.open('search_toc.html','_blank');
});
init();