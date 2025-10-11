console.log("ai.js carregado ✅");

// If an external mock script (`ai-mock.js`) is loaded it will expose
// `window._localMock`. Otherwise create a tiny internal fallback that
// returns short dummy responses. We keep this fallback minimal — real
// testing should use `ai-mock.js` so production `ai.js` stays clean.
const _localMock = window._localMock || {
  async summarize(text, lang = 'en') {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return `--INLINE MOCK SUMMARIZER (${lang})--\n` + sentences.slice(0, 2).join(' ');
  },
  async prompt(text, lang = 'en') {
    return `--INLINE MOCK RESPONSE (${lang})--\n${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`;
  }
};

function progressLogger(prefix) {
  let lastProgress = 0;
  let isCompleted = false;

  return (m) => {
    console.debug(`[progressLogger] Registrando monitor para ${prefix}`, m);
    
    m.addEventListener('downloadprogress', (e) => {
      if (isCompleted) return; // Evita eventos de progresso após completar
      
      let pct = null;
      try {
        if (typeof e.loaded === 'number' && typeof e.total === 'number' && e.total > 0) {
          pct = Math.round((e.loaded / e.total) * 100);
        } else if (typeof e.loaded === 'number') {
          pct = Math.round(e.loaded * 100);
        }
      } catch (err) {
        console.warn(`[progressLogger] Erro ao calcular progresso:`, err);
        pct = null;
      }

      // Evita atualizações desnecessárias
      if (pct === lastProgress) return;
      lastProgress = pct;

      console.debug(`[${prefix}] Download progresso: ${pct ?? '?'}%`);
      
      try {
        window.dispatchEvent(new CustomEvent('ai-download-progress', { 
          detail: { 
            source: prefix, 
            percent: pct,
            loaded: e.loaded,
            total: e.total
          }
        }));
      } catch (ex) {
        console.error(`[progressLogger] Erro ao disparar evento de progresso:`, ex);
      }
    });

    m.addEventListener('downloadcomplete', () => {
      if (isCompleted) return;
      isCompleted = true;
      
      console.debug(`[${prefix}] Download completo`);
      try {
        window.dispatchEvent(new CustomEvent('ai-download-complete', { 
          detail: { source: prefix }
        }));
      } catch (ex) {
        console.error(`[progressLogger] Erro ao disparar evento de conclusão:`, ex);
      }
    });

    m.addEventListener('error', (err) => {
      console.error(`[${prefix}] Erro no download:`, err);
      try {
        window.dispatchEvent(new CustomEvent('ai-download-error', { 
          detail: { 
            source: prefix, 
            error: err?.message || String(err)
          }
        }));
      } catch (ex) {
        console.error(`[progressLogger] Erro ao disparar evento de erro:`, ex);
      }
    });
  };
}

// ---------- Summarizer API ----------
async function runSummarizer(text, outputLang = "en") {
  console.debug("[runSummarizer] Iniciando sumarização", { text, outputLang });
  if (!('Summarizer' in self)) {
    console.warn("[runSummarizer] Summarizer API não disponível. Usando mock local para testes.");
    // return a mock result for local testing (from external mock if provided)
    return _localMock.summarize(text, outputLang);
  }
  const options = {
    type: 'key-points',
    format: 'markdown',
    length: 'medium',
    outputLanguage: outputLang,
    monitor: progressLogger("Summarizer"),
  };
  console.debug("[runSummarizer] Opções de sumarização:", options);

  const availability = await Summarizer.availability(options);
  console.debug("[runSummarizer] Disponibilidade do Summarizer:", availability);
  // If the Summarizer isn't fully available (for example it's "downloadable"
  // and requires a model download or extra permission), fall back to the
  // local mock so the UI remains responsive for testing.
  if (availability !== 'available') {
    console.warn("[runSummarizer] Summarizer não disponível para uso imediato (", availability, "). Usando mock local.");
    return _localMock.summarize(text, outputLang);
  }
  if (!navigator.userActivation.isActive) {
    console.warn("[runSummarizer] É preciso um clique do usuário para ativar a IA.");
    throw new Error("É preciso um clique do usuário para ativar a IA.");
  }
  console.debug("[runSummarizer] Criando instância do Summarizer...");
  const summarizer = await Summarizer.create(options);
  console.debug("[runSummarizer] Instância criada, iniciando sumarização...");
  const result = await summarizer.summarize(text);
  console.debug("[runSummarizer] Sumarização concluída:", result);
  return result;
}

// ---------- Prompt API (LanguageModel) ----------
async function runPrompt(systemInstruction, userText = "", outputLang = "en", forceReal = false) {
  console.debug("[runPrompt] Iniciando prompt", { systemInstruction, userText, outputLang, forceReal });
  if (!('LanguageModel' in self)) {
    console.warn("[runPrompt] LanguageModel API não disponível. Usando mock local para testes.");
    // return mock synchronous response for testing (from external mock if provided)
    return _localMock.prompt(userText || systemInstruction, outputLang);
  }
  const SUPPORTED_LANGS = ["en","es","ja"];
  const modelOpts = {
    expectedInputs:  [{ type: "text", languages: SUPPORTED_LANGS }],
    // specify the concrete desired output language to satisfy API safety checks
    expectedOutputs: [{ type: "text", languages: [outputLang] }],
    monitor: progressLogger("LanguageModel"),
  };
  console.debug("[runPrompt] Opções do modelo:", modelOpts);

  const availability = await LanguageModel.availability(modelOpts);
  console.debug("[runPrompt] Disponibilidade do LanguageModel:", availability);
  // If the model isn't available immediately, we usually fallback to the
  // mock to keep the UI responsive. However, if the user explicitly
  // requested a real attempt (forceReal) we will try to create the model
  // inside the current user gesture (only works if navigator.userActivation
  // is active). If that fails we fall back to the mock and return a clear
  // message.
  if (availability !== 'available') {
    if (forceReal && navigator.userActivation.isActive) {
      try {
        console.debug('[runPrompt] Forçando uso real apesar de availability=', availability);
        const systemWithLang = `${systemInstruction}\nRespond in the following language: ${outputLang}.`;
          // helper: create with timeout to avoid indefinite hangs
          const createWithTimeout = async (opts, ms = 60000) => {
            console.debug('[createWithTimeout] Iniciando criação do modelo com timeout de', ms, 'ms');
            const p = LanguageModel.create(opts);
            let timer = null;
            const timeout = new Promise((_, rej) => { 
              timer = setTimeout(() => {
                console.warn('[createWithTimeout] Timeout atingido após', ms, 'ms');
                rej(new Error('Timeout ao criar o modelo. Por favor, tente novamente.'));
              }, ms);
            });
            
            try {
              const res = await Promise.race([p, timeout]);
              console.debug('[createWithTimeout] Modelo criado com sucesso');
              clearTimeout(timer);
              return res;
            } catch (err) {
              console.error('[createWithTimeout] Erro ao criar modelo:', err);
              clearTimeout(timer);
              throw err;
            }
          };
          const session = await createWithTimeout({ ...modelOpts, initialPrompts: [{ role: 'system', content: systemWithLang }] });
        console.debug('[runPrompt] Sessão criada (forçada).', session);
        const resposta = await session.prompt(userText);
        return resposta;
      } catch (e) {
        console.warn('[runPrompt] Falha ao criar session forçada:', e);
        // fall through to mock
        return _localMock.prompt(userText || systemInstruction, outputLang) + `\n\n[Nota: tentativa real falhou: ${e?.name || e}]`;
      }
    }

    console.warn('[runPrompt] LanguageModel não disponível para uso imediato (', availability, '). Usando mock local.');
    return _localMock.prompt(userText || systemInstruction, outputLang);
  }
  if (!navigator.userActivation.isActive) {
    console.warn("[runPrompt] Clique para ativar a IA.");
    throw new Error("Clique para ativar a IA.");
  }

  const CHUNK_LIMIT = 1500; // ~chars, simplificado
  console.debug("[runPrompt] Criando sessão do LanguageModel...");
  console.debug("[runPrompt] Chamando LanguageModel.create...");
  const systemWithLang = `${systemInstruction}\nRespond in the following language: ${outputLang}.`;
  const session = await LanguageModel.create({
    ...modelOpts,
    initialPrompts: [{ role: 'system', content: systemWithLang }]
  });
  console.debug("[runPrompt] Sessão criada.", session);

  if (userText.length <= CHUNK_LIMIT) {
    console.debug("[runPrompt] Texto dentro do limite, enviando prompt...");
    const resposta = await session.prompt(userText);
    console.debug("[runPrompt] Resposta recebida:", resposta);
    return resposta;
  } else {
    console.debug("[runPrompt] Texto grande, dividindo em partes...");
    const parts = [];
    for (let i = 0; i < userText.length; i += CHUNK_LIMIT) {
      const sub = userText.slice(i, i + CHUNK_LIMIT);
      console.debug(`[runPrompt] Enviando parte ${i / CHUNK_LIMIT + 1}:`, sub);
      const partial = await session.prompt(sub);
      console.debug(`[runPrompt] Resposta parcial ${i / CHUNK_LIMIT + 1}:`, partial);
      parts.push(partial);
    }
    // reduzir os resultados em uma nova chamada
    const reduceSys = [
      "You are a legal assistant. Synthesize the following partial outputs into one coherent answer.",
      "Preserve citations in format (LAW, ARTICLE)."
    ].join("\n");
    console.debug("[runPrompt] Criando sessão para síntese das respostas parciais...");
    const reduceSysWithLang = reduceSys + `\nRespond in the following language: ${outputLang}.`;
    const reduceSession = await LanguageModel.create({
      ...modelOpts,
      initialPrompts: [{ role: "system", content: reduceSysWithLang }]
    });
    console.debug("[runPrompt] Enviando partes para síntese final...");
    const final = await reduceSession.prompt(parts.join("\n\n"));
    console.debug("[runPrompt] Resposta final sintetizada:", final);
    return final;
  }
}

// Debug helpers removed: avoid creating LanguageModel sessions outside of a user gesture
