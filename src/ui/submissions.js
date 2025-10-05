import { listSubmissions, updateSubmission } from '../db.js';
import { buildMarkdown } from '../util/md-builder.js';
import { getSetting } from '../db.js';

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
$('#btnOpenIssue').addEventListener('click', async ()=>{
  const md = $('#md').value.trim();
  if(!md) return alert('Generate Markdown first.');
  
  await submitToServerlessEndpoint();
});

async function submitToServerlessEndpoint() {
  let endpoint;
  
  try {
    // Get the configured serverless endpoint
    endpoint = await getSetting('serverlessEndpoint');
    
    // Validate endpoint configuration
    if (!endpoint) {
      const errorMessage = 'Configure o endpoint serverless nas configurações';
      if (window.app && window.app.showToast) {
        window.app.showToast(errorMessage, 'error', 5000);
      } else {
        alert(errorMessage);
      }
      return;
    }
    
    // Validate URL format
    if (!endpoint.startsWith('https://')) {
      const errorMessage = 'URL do endpoint deve começar com https://';
      if (window.app && window.app.showToast) {
        window.app.showToast(errorMessage, 'error', 5000);
      } else {
        alert(errorMessage);
      }
      return;
    }
    
    // Prepare the request payload
    const payload = {
      title: `[LexFlow] New Legal Extract: ${$('#title').value || 'Untitled'}`,
      markdown: $('#md').value,
      metadata: {
        source_url: $('#source_url').value,
        jurisdiction: $('#jurisdiction').value,
        language: $('#language').value
      }
    };
    
    // Send POST request to serverless endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Handle specific HTTP error codes
      if (response.status === 404) {
        throw new Error('Endpoint não encontrado. Verifique a URL configurada.');
      } else if (response.status === 403 || response.status === 401) {
        throw new Error('Acesso negado. Verifique a configuração do endpoint.');
      } else if (response.status >= 500) {
        throw new Error('Erro interno do servidor. Tente novamente mais tarde.');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
    
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error('Resposta inválida do servidor. Formato JSON esperado.');
    }
    
    // Handle different response scenarios
    if (result.success === true || result.success === undefined) {
      // Success scenario
      const message = result.message || 'Submitted successfully';
      
      // Show success toast with additional info if available
      let successMessage = message;
      if (result.data && result.data.pr_url) {
        successMessage += ` - PR: ${result.data.pr_number || 'created'}`;
      }
      
      if (window.app && window.app.showToast) {
        window.app.showToast(successMessage, 'success', 5000);
      } else {
        alert(successMessage);
      }
    } else {
      // Error scenario from server
      const errorMessage = result.message || result.error || 'Submission failed';
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    console.error('Serverless submission error:', error);
    
    // Handle different error types
    let userMessage = 'Error submitting to endpoint. Check serverless config.';
    
    if (error.name === 'AbortError') {
      userMessage = 'Timeout na requisição. Tente novamente.';
    } else if (error.message.includes('fetch')) {
      userMessage = 'Erro de rede. Verifique sua conexão.';
    } else if (error.message.includes('não encontrado')) {
      userMessage = error.message;
    } else if (error.message.includes('Acesso negado')) {
      userMessage = error.message;
    } else if (error.message.includes('Resposta inválida')) {
      userMessage = error.message;
    } else if (error.message.includes('servidor')) {
      userMessage = error.message;
    } else if (error.message && !error.message.includes('HTTP')) {
      // Use server-provided error message if it's not a generic HTTP error
      userMessage = error.message;
    }
    
    // Use existing error handling if available
    if (window.app && window.app.handleNetworkError) {
      await window.app.handleNetworkError(error, 'Serverless submission', endpoint);
    } else {
      // Fallback error handling
      if (window.app && window.app.showToast) {
        window.app.showToast(userMessage, 'error', 8000);
      } else {
        alert(userMessage);
      }
    }
  }
}
loadList();