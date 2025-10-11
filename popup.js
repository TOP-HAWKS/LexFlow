console.log("popup.js carregado ✅");

let selectedArticles = [];
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const engineBadge = document.getElementById("engineBadge");
const aiStatusEl = document.getElementById('aiStatus');
const useRealApiEl = document.getElementById('useRealApi');

// ---------- Helpers ----------
function addLogEntry(message, type = 'info') {
  const logContainer = document.getElementById('logContainer');
  const logEntries = document.getElementById('logEntries');
  
  if (!logContainer || !logEntries) return;
  
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
  
  logEntries.appendChild(entry);
  logEntries.scrollTop = logEntries.scrollHeight;
  
  // Mostrar o container de logs se estiver oculto
  logContainer.style.display = 'block';
}

function toggleProcessingIndicator(show, message = 'Processando sua solicitação...') {
  const indicator = document.getElementById('processingIndicator');
  if (!indicator) return;
  
  if (show) {
    indicator.querySelector('span').textContent = message;
    indicator.style.display = 'flex';
    addLogEntry(`Iniciando processamento: ${message}`);
  } else {
    indicator.style.display = 'none';
    addLogEntry('Processamento concluído');
  }
}

function setBusy(isBusy, msg = "") {
  ["processMR", "copyOut", "exportMd"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = isBusy;
    }
  });
  
  statusEl.textContent = msg;
  toggleProcessingIndicator(isBusy, msg);
  
  if (isBusy) {
    engineBadge.textContent = "…";
    outputEl.textContent = "";
  }
}

function setBadge(text) {
  engineBadge.textContent = text;
  addLogEntry(`Estado do motor: ${text}`);
}

// ---------- Carregar leis ----------
async function loadLaws() {
  const lawSelect = document.getElementById("lawSelect");
  const laws = [
    { id: "CF88.md", name: "Constituição Federal 1988" },
    { id: "codigo_civil.md", name: "Código Civil" },
    {id: "inquilinato.md", name: "Inquilinato"}
  ];
  laws.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.name;
    lawSelect.appendChild(opt);
  });
}
loadLaws();

// AI availability check & toggle
async function checkAiAvailability() {
  try {
    const lm = window.LanguageModel;
    const sum = window.Summarizer;
    let lmAvail = lm ? await lm.availability({ expectedInputs:[{type:'text'}], expectedOutputs:[{type:'text', languages:['en']}] }) : 'missing';
    let sumAvail = sum ? await sum.availability({ outputLanguage: 'en' }) : 'missing';
    
    addLogEntry(`Status LanguageModel: ${lmAvail}`);
    addLogEntry(`Status Summarizer: ${sumAvail}`);
    
    if (aiStatusEl) {
      aiStatusEl.textContent = `LM: ${lmAvail}, Sum: ${sumAvail}`;
    }
    return { lmAvail, sumAvail };
  } catch (e) {
    console.error('Erro checando disponibilidade AI:', e);
    addLogEntry(`Erro ao verificar disponibilidade: ${e.message}`, 'error');
    if (aiStatusEl) {
      aiStatusEl.textContent = 'Erro ao verificar disponibilidade';
    }
    return { lmAvail: 'error', sumAvail: 'error' };
  }
}

// initialize status
checkAiAvailability();

if (useRealApiEl) {
  useRealApiEl.addEventListener('change', () => {
    window.useRealApi = !!useRealApiEl.checked;
    checkAiAvailability();
  });
}

// Listen to AI download progress events (dispatched by ai.js progressLogger)
window.addEventListener('ai-download-progress', (e) => {
  const pct = e.detail?.percent;
  if (aiStatusEl) aiStatusEl.textContent = `Baixando modelo: ${pct ?? '?'}%`;
  if (engineBadge) engineBadge.textContent = `${pct ?? '…'}%`;
  
  addLogEntry(`Progresso do download: ${pct ?? '?'}%`);
  
  const wrap = document.getElementById('aiProgressWrap');
  const bar = document.getElementById('aiProgressBar');
  if (wrap && bar) {
    wrap.style.display = 'block';
    bar.style.width = `${pct ?? 0}%`;
  }
});

window.addEventListener('ai-download-complete', () => {
  if (aiStatusEl) aiStatusEl.textContent = 'Download concluído';
  if (engineBadge) engineBadge.textContent = '✓';
  
  addLogEntry('Download do modelo concluído com sucesso');
  
  // refresh availability
  checkAiAvailability();
  const wrap = document.getElementById('aiProgressWrap');
  const bar = document.getElementById('aiProgressBar');
  if (wrap && bar) {
    wrap.classList.add('done');
    bar.classList.remove('indeterminate');
    setTimeout(() => {
      wrap.style.display = 'none';
      wrap.classList.remove('done');
      bar.style.width = '0%';
    }, 2000);
  }
});
window.addEventListener('ai-download-error', (e) => {
  const err = e.detail?.error || 'unknown';
  if (aiStatusEl) aiStatusEl.textContent = `Download error: ${err}`;
  if (engineBadge) engineBadge.textContent = `error`;
  const wrap = document.getElementById('aiProgressWrap');
  const bar = document.getElementById('aiProgressBar');
  if (wrap && bar) {
    wrap.classList.add('error');
    bar.classList.remove('indeterminate');
    bar.style.width = '100%';
    setTimeout(() => { wrap.setAttribute('aria-hidden','true'); wrap.classList.remove('error'); bar.style.width='0%'; }, 3000);
  }
});

// ---------- Carregar artigos ----------
async function fetchArticles(fileName) {
  try {
    const resp = await fetch(chrome.runtime.getURL("corpus/" + fileName));
    const text = await resp.text();
    const regex =
      /(Art\. ?\d+[º°]?[\s\S]*?)(?=(Art\. ?\d+[º°]?|\Z))/gi;
    const matches = [...text.matchAll(regex)];

    const artigos = matches.map((m, i) => {
      const linhas = m[1].trim().split("\n");
      const titulo = linhas.shift().trim();
      const corpo = linhas.join("\n").trim();
      return {
        id: fileName + "_art" + i,
        title: titulo,
        body: corpo,
        citation: `${fileName}, ${titulo}`,
      };
    });

    renderArticles(artigos);
  } catch (err) {
    console.error("Erro ao carregar corpus:", err);
    document.getElementById("articles").innerHTML =
      "<i>Erro ao ler arquivo</i>";
  }
}

// ---------- Renderizar artigos ----------
function renderArticles(list) {
  const container = document.getElementById("articles");
  container.innerHTML = list.length
    ? ""
    : "<i>Nenhum artigo encontrado</i>";
  list.forEach((a) => {
    const div = document.createElement("div");
    div.className = "article";
    div.textContent = a.title;
    div.addEventListener("click", () => {
      if (!selectedArticles.find((x) => x.id === a.id)) {
        selectedArticles.push(a);
        addToContext(a);
      }
    });
    container.appendChild(div);
  });
}
function addToContext(article) {
  const ta = document.getElementById("inputText");
  ta.value +=
    (ta.value ? "\n\n" : "") + `## ${article.title}\n${article.body}`;
}

// ---------- Eventos ----------
const lawSelectEl = document.getElementById("lawSelect");
if (lawSelectEl) {
  lawSelectEl.addEventListener("change", (e) => {
    const file = e.target.value;
    if (file) {
      selectedArticles = [];
      const it = document.getElementById("inputText");
      if (it) it.value = "";
      fetchArticles(file);
    } else {
      const articlesEl = document.getElementById("articles");
      if (articlesEl) articlesEl.innerHTML = "";
    }
  });
} else {
  console.warn('lawSelect element not found — laws dropdown disabled');
}

// ---------- Presets ----------
function getPromptFromPreset(preset, custom, hasCorpus) {
    if (custom) return custom; // prioridade ao custom
  
    switch (preset) {
      case "resumo":
        return hasCorpus
          ? "Summarize the provided legal text in exactly three paragraphs. Always cite the used articles in the format (LAW, ARTICLE)."
          : "Summarize the provided legal text in exactly three paragraphs. If relevant, highlight legal implications.";
  
      case "revisao":
        return "Revise the provided legal text for clarity, conciseness, and readability. Suggest improvements while preserving legal accuracy."
          + (hasCorpus ? " Always reference the applicable laws/articles (LAW, ARTICLE)." : "");
  
      case "checklist":
        return "Act as a legal risk analyst. Review the provided legal document and produce a checklist of risks, inconsistencies, and abusive clauses."
          + (hasCorpus ? " Always reference the applicable laws/articles (LAW, ARTICLE)." : "");
  
      case "clausulas":
        return "Draft rental contract clauses based on the provided context. Include parameters such as parties, dates, and values when present."
          + (hasCorpus ? " Always reference the applicable laws/articles (LAW, ARTICLE)." : "");
  
      default:
        return "Summarize the provided legal text.";
    }
  }
  
  // ---------- Botão Processar Map-Reduce ----------
  const processBtn = document.getElementById("processMR");
  if (processBtn) {
    processBtn.addEventListener("click", async () => {
      const customEl = document.getElementById("customPrompt");
      const presetEl = document.getElementById("presetSelect");
      const outLangEl = document.getElementById("lmLang");
      const inputEl = document.getElementById("inputText");

      const custom = (customEl && customEl.value) ? customEl.value.trim() : "";
      const preset = presetEl ? presetEl.value : "resumo";
      const outLang = outLangEl ? outLangEl.value : "en";

      const text = inputEl ? inputEl.value.trim() : "";
      if (!text) {
        if (outputEl) outputEl.textContent = "⚠️ Selecione artigos ou cole um documento primeiro.";
        return;
      }

      const hasCorpus = selectedArticles.length > 0;
      const basePrompt = getPromptFromPreset(preset, custom, hasCorpus);

      try {
        setBusy(true, "Processando com IA…");
    const forceReal = !!window.useRealApi;
    const result = await runPrompt(basePrompt, text, outLang, forceReal); // usa ai.js
        setBadge(`IA (${outLang})`);
        if (outputEl) outputEl.textContent = result;

        await saveHistory({
          engine: "map-reduce",
          outputLanguage: outLang,
          artigos: selectedArticles.map(c => c.citation),
          preset,
          prompt: basePrompt,
          entrada: text,
          saida: result,
          data: Date.now(),
        });
        await renderHistory();
      } catch (err) {
        console.error(err);
        if (outputEl) outputEl.textContent = "Erro no processamento: " + (err?.message || String(err));
      } finally {
        setBusy(false, "");
      }
    });
  } else {
    console.warn('processMR button not found — IA processing disabled');
  }
  

// ---------- Histórico ----------
async function renderHistory() {
  const hist = await getHistory();
  const list = document.getElementById("history");
  list.innerHTML = "";

  hist.forEach((h) => {
    const li = document.createElement("li");
    const date = new Date(h.data || Date.now()).toLocaleString("pt-BR");

    const header = document.createElement("div");
    header.innerHTML = `<b>[${h.engine}]</b> ${date} — ${h.preset || "custom"} — ${h.prompt?.slice(0, 40)}…`;

    const result = document.createElement("pre");
    result.textContent = h.saida || "(sem resultado salvo)";
    result.style.display = "none";
    result.style.whiteSpace = "pre-wrap";

    header.addEventListener("click", () => {
      result.style.display =
        result.style.display === "none" ? "block" : "none";
    });

    li.appendChild(header);
    li.appendChild(result);
    list.appendChild(li);
  });
}
renderHistory();

// ---------- Copiar Resultado ----------
const copyBtn = document.getElementById("copyOut");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const text = outputEl.textContent.trim();
    if (!text) {
      statusEl.textContent = "⚠️ Nada para copiar.";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "✅ Resultado copiado!";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
      statusEl.textContent = "❌ Erro ao copiar.";
    }
  });
} else {
  console.warn('copyOut button not found in DOM — copy feature disabled');
}

  // ---------- Export Markdown ----------
  const exportBtn = document.getElementById("exportMd");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const text = outputEl.textContent.trim();
      if (!text) {
        statusEl.textContent = "⚠️ Nada para exportar.";
        return;
      }
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date().toISOString().slice(0,19).replace(/:/g,'-');
      a.download = `lexflow_output_${now}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      statusEl.textContent = '✅ Exportado .md';
      setTimeout(() => (statusEl.textContent = ''), 2000);
    });
  }

// Inicializar a verificação de disponibilidade da IA
checkAiAvailability();
