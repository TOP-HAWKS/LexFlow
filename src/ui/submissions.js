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
    
    // Validate endpoint configuration with enhanced guidance
    if (!endpoint) {
      const errorMessage = 'Endpoint serverless não configurado';
      const guidance = 'Configure o endpoint nas configurações para enviar extratos automaticamente';
      
      if (window.app && window.app.showToastWithAction) {
        window.app.showToastWithAction(
          `${errorMessage}. ${guidance}`,
          'warning',
          8000,
          'Configurar Agora',
          () => {
            if (window.app && window.app.navigate) {
              window.app.navigate('settings');
            }
          }
        );
      } else if (window.app && window.app.showToast) {
        window.app.showToast(`${errorMessage}. ${guidance}`, 'warning', 8000);
      } else {
        alert(`${errorMessage}. ${guidance}`);
      }
      return;
    }
    
    // Validate URL format with actionable guidance
    if (!endpoint.startsWith('https://')) {
      const errorMessage = 'URL do endpoint inválida';
      const guidance = 'O endpoint deve começar com "https://" para garantir segurança';
      
      if (window.app && window.app.showToastWithAction) {
        window.app.showToastWithAction(
          `${errorMessage}. ${guidance}`,
          'error',
          8000,
          'Corrigir URL',
          () => {
            if (window.app && window.app.navigate) {
              window.app.navigate('settings');
            }
          }
        );
      } else if (window.app && window.app.showToast) {
        window.app.showToast(`${errorMessage}. ${guidance}`, 'error', 8000);
      } else {
        alert(`${errorMessage}. ${guidance}`);
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
    
    // Handle different response scenarios with enhanced feedback
    if (result.success === true || result.success === undefined) {
      // Success scenario with detailed feedback
      const baseMessage = result.message || 'Extrato legal enviado com sucesso!';
      
      // Build enhanced success message with additional details
      let successMessage = baseMessage;
      let actionLabel = null;
      let actionHandler = null;
      
      if (result.data) {
        if (result.data.pr_url) {
          successMessage += ` Pull Request #${result.data.pr_number || 'criado'}`;
          actionLabel = 'Ver PR';
          actionHandler = () => window.open(result.data.pr_url, '_blank');
        } else if (result.data.issue_url) {
          successMessage += ` Issue #${result.data.issue_number || 'criada'}`;
          actionLabel = 'Ver Issue';
          actionHandler = () => window.open(result.data.issue_url, '_blank');
        }
      }
      
      // Show enhanced success toast with action if available
      if (actionLabel && actionHandler && window.app && window.app.showToastWithAction) {
        window.app.showToastWithAction(
          successMessage,
          'success',
          8000,
          actionLabel,
          actionHandler
        );
      } else if (window.app && window.app.showToast) {
        window.app.showToast(successMessage, 'success', 6000);
      } else {
        alert(successMessage);
      }
      
      // Update submission status if current item exists
      if (current && window.updateSubmission) {
        try {
          await window.updateSubmission(current.id, { 
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            submissionData: result.data
          });
        } catch (updateError) {
          console.warn('Failed to update submission status:', updateError);
        }
      }
      
    } else {
      // Error scenario from server
      const errorMessage = result.message || result.error || 'Falha no envio do extrato';
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    console.error('Serverless submission error:', error);
    
    // Use enhanced serverless error handling if available
    if (window.app && window.app.handleServerlessError) {
      await window.app.handleServerlessError(error, 'Serverless submission');
    } else if (window.app && window.app.handleNetworkError) {
      // Fallback to network error handling for compatibility
      await window.app.handleNetworkError(error, 'Serverless submission', endpoint);
    } else {
      // Enhanced fallback error handling with actionable suggestions
      let userMessage = 'Erro ao enviar extrato';
      let suggestion = 'Verifique a configuração do endpoint';
      let actionLabel = null;
      let actionHandler = null;
      
      if (error.name === 'AbortError') {
        userMessage = 'Timeout na requisição';
        suggestion = 'O servidor demorou para responder. Tente novamente.';
        actionLabel = 'Tentar Novamente';
        actionHandler = () => submitToServerlessEndpoint();
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        userMessage = 'Erro de conexão';
        suggestion = 'Verifique sua conexão com a internet e tente novamente.';
        actionLabel = 'Tentar Novamente';
        actionHandler = () => submitToServerlessEndpoint();
      } else if (error.message.includes('não encontrado')) {
        userMessage = 'Endpoint não encontrado';
        suggestion = 'Verifique se a URL do endpoint está correta nas configurações.';
        actionLabel = 'Configurações';
        actionHandler = () => {
          if (window.app && window.app.navigate) {
            window.app.navigate('settings');
          }
        };
      } else if (error.message.includes('Acesso negado')) {
        userMessage = 'Acesso negado';
        suggestion = 'Verifique a configuração de autenticação do endpoint.';
        actionLabel = 'Configurações';
        actionHandler = () => {
          if (window.app && window.app.navigate) {
            window.app.navigate('settings');
          }
        };
      } else if (error.message.includes('Resposta inválida')) {
        userMessage = 'Resposta inválida do servidor';
        suggestion = 'O servidor retornou dados em formato incorreto. Tente novamente.';
        actionLabel = 'Tentar Novamente';
        actionHandler = () => submitToServerlessEndpoint();
      } else if (error.message.includes('servidor')) {
        userMessage = 'Erro do servidor';
        suggestion = 'Problema temporário no servidor. Tente novamente em alguns minutos.';
        actionLabel = 'Tentar Novamente';
        actionHandler = () => submitToServerlessEndpoint();
      } else if (error.message && !error.message.includes('HTTP')) {
        // Use server-provided error message if it's not a generic HTTP error
        userMessage = error.message;
        suggestion = 'Verifique a configuração e tente novamente.';
        actionLabel = 'Configurações';
        actionHandler = () => {
          if (window.app && window.app.navigate) {
            window.app.navigate('settings');
          }
        };
      }
      
      const fullMessage = `${userMessage}. ${suggestion}`;
      
      if (actionLabel && actionHandler && window.app && window.app.showToastWithAction) {
        window.app.showToastWithAction(fullMessage, 'error', 10000, actionLabel, actionHandler);
      } else if (window.app && window.app.showToast) {
        window.app.showToast(fullMessage, 'error', 8000);
      } else {
        alert(fullMessage);
      }
    }
  }
}

// Make submitToServerlessEndpoint globally accessible for retry functionality
window.submitToServerlessEndpoint = submitToServerlessEndpoint;

loadList();