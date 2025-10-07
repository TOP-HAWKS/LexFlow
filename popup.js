console.log("popup.js carregado ✅");

let selectedArticles = [];
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const engineBadge = document.getElementById("engineBadge");

// ---------- Helpers ----------
function setBusy(isBusy, msg = "") {
  ["processMR", "copyOut", "exportMd"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = isBusy;
  });
  statusEl.textContent = msg;
  if (isBusy) {
    engineBadge.textContent = "…";
    outputEl.textContent = "";
  }
}
function setBadge(text) {
  engineBadge.textContent = text;
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
document
  .getElementById("lawSelect")
  .addEventListener("change", (e) => {
    const file = e.target.value;
    if (file) {
      selectedArticles = [];
      document.getElementById("inputText").value = "";
      fetchArticles(file);
    } else {
      document.getElementById("articles").innerHTML = "";
    }
  });

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
  document.getElementById("processMR").addEventListener("click", async () => {
    const custom = document.getElementById("customPrompt").value.trim();
    const preset = document.getElementById("presetSelect").value;
    const outLang = document.getElementById("lmLang").value;
  
    const text = document.getElementById("inputText").value.trim();
    if (!text) {
      outputEl.textContent = "⚠️ Selecione artigos ou cole um documento primeiro.";
      return;
    }
  
    const hasCorpus = selectedArticles.length > 0;
    const basePrompt = getPromptFromPreset(preset, custom, hasCorpus);
  
    try {
      setBusy(true, "Processando com IA…");
      const result = await runPrompt(basePrompt, text, outLang); // usa ai.js
      setBadge(`IA (${outLang})`);
      outputEl.textContent = result;
  
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
      outputEl.textContent = "Erro no processamento: " + (err?.message || String(err));
    } finally {
      setBusy(false, "");
    }
  });
  

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
document
  .getElementById("copyOut")
  .addEventListener("click", async () => {
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
