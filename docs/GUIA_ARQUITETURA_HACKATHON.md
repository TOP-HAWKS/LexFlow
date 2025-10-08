# 🏗️ Guia de Arquitetura LexFlow - Hackathon

## 📋 Visão Geral do Projeto

O LexFlow é uma extensão Chrome que permite análise de textos legais usando IA integrada do Chrome (Gemini Nano). O projeto está estruturado como uma SPA (Single Page Application) com persistência local via IndexedDB.

---

## 🗄️ **BANCO DE DADOS (IndexedDB) - Para o Colega de BD**

### 📁 Arquivo Principal: `src/db.js`

**Configuração do Banco:**
- Nome: `lexflow_db`
- Versão: `2`
- Stores (tabelas):
  - `history` - Histórico de análises de IA
  - `settings` - Configurações do usuário
  - `submissions` - Fila de capturas de conteúdo

### 🔧 Funções Principais que Você Pode Modificar:

#### **History (Histórico de IA)**
```javascript
// Salvar nova análise
await saveHistory(item)

// Listar histórico (últimas 20 por padrão)
await listHistory(limit=20)
```

#### **Settings (Configurações)**
```javascript
// Salvar configuração
await setSetting(chave, valor)

// Recuperar configuração
await getSetting(chave)
```

#### **Submissions (Fila de Capturas)**
```javascript
// Adicionar nova captura
await addSubmission(item)

// Listar capturas (opcionalmente por status)
await listSubmissions(status=null)

// Atualizar status de captura
await updateSubmission(id, patch)
```

### 📊 Estrutura dos Dados:

**History Item:**
```javascript
{
  id: auto_increment,
  ts: timestamp,
  prompt: "texto do prompt",
  result: "resultado da IA",
  // outros campos conforme necessário
}
```

**Settings Item:**
```javascript
{
  k: "chave_configuracao",
  v: "valor"
}
```

**Submission Item:**
```javascript
{
  id: auto_increment,
  ts: timestamp,
  url: "url_da_pagina",
  title: "titulo_da_pagina",
  selectionText: "texto_capturado",
  mode: "selected|full",
  lang: "pt-BR",
  jurisdiction: null,
  sourceHint: "",
  status: "queued|processed|error"
}
```

### 🎯 O que Você Pode Fazer:
- Adicionar novos stores (tabelas)
- Criar índices para otimizar consultas
- Implementar funções de limpeza/manutenção
- Adicionar validação de dados
- Implementar backup/restore local

---

## 🤖 **INTEGRAÇÃO GEMINI NANO - Para o Colega de IA**

### 📁 Arquivo Principal: `src/ai/chrome-ai.js`

**APIs Disponíveis:**
- Summarizer API (resumos)
- Prompt API (conversação/análise)

### 🔧 Funções Implementadas:

#### **Resumo Automático**
```javascript
export async function summarizeOnDevice(text) {
  // Usa a API nativa de resumo do Chrome
  const summarizer = await self.ai.summarizer.create();
  return await summarizer.summarize(text);
}
```

#### **Prompt Personalizado**
```javascript
export async function promptOnDevice(systemPrompt, userText) {
  // Usa a API de conversação do Chrome
  const assistant = await self.ai.assistant.create({ systemPrompt });
  return await assistant.prompt(userText);
}
```

### ⚙️ Configuração Necessária:

**Chrome Canary com flags habilitadas:**
- `chrome://flags/#prompt-api-for-gemini-nano`
- `chrome://flags/#summarization-api-for-gemini-nano`
- `chrome://flags/#built-in-ai-api`

### 🎯 O que Você Pode Fazer:
- Criar presets de prompts para diferentes tipos de análise legal
- Implementar streaming de respostas
- Adicionar tratamento de erro específico para cada API
- Criar funções de validação de disponibilidade da IA
- Implementar cache inteligente de respostas

### 💡 Exemplo de Uso:
```javascript
// Para resumo
const resumo = await summarizeOnDevice(textoLegal);

// Para análise personalizada
const analise = await promptOnDevice(
  "Você é um assistente jurídico especializado em direito brasileiro",
  "Analise este artigo do código civil: " + textoArtigo
);
```

---

## 🌐 **REPOSITÓRIO DE LEIS & CLOUDFLARE WORKER**

### 📁 Configuração: `src/config/defaults.js` e `config.example.json`

**URLs Base por Jurisdição:**
```javascript
export const DEFAULT_CONFIG = {
  baseUrls: {
    'br': 'https://raw.githubusercontent.com/org/legal-corpus-br/main',
    'us': 'https://raw.githubusercontent.com/org/legal-corpus-us/main', 
    'es': 'https://raw.githubusercontent.com/org/legal-corpus-es/main'
  },
  fallbackBaseUrl: 'https://raw.githubusercontent.com/org/legal-corpus/main'
};
```

### 🔗 Endpoints e Conexões:

**Arquivo de Configuração (`config.example.json`):**
```json
{
  "corpusBaseUrl": "https://raw.githubusercontent.com/ORG/legal-corpus/main",
  "githubRepo": "ORG/REPO"
}
```

### 📂 Estrutura Esperada do Repositório:
```
legal-corpus/
├─ country/
│  └─ br/
│     ├─ federal/
│     │  ├─ constituicao-federal-1988.md
│     │  ├─ codigo-civil-2002.md
│     │  └─ lei-inquilinato-8245-1991.md
│     └─ state/
│        └─ RS/
│           └─ city/
│              └─ porto-alegre/
│                 └─ lei-organica-porto-alegre.md
```

### ☁️ **Integração Cloudflare Worker:**

**Para conectar ao Cloudflare Worker, você precisa:**

1. **Configurar CORS** no Worker para permitir requisições da extensão
2. **Endpoint sugerido:** `https://seu-worker.seu-dominio.workers.dev/api/laws`
3. **Modificar** `src/config/defaults.js` para apontar para seu Worker

**Exemplo de configuração:**
```javascript
// Substitua a URL base para usar seu Cloudflare Worker
baseUrls: {
  'br': 'https://lexflow-api.seu-dominio.workers.dev/br',
  // ...
}
```

### 🎯 O que Você Pode Fazer:
- Implementar cache inteligente no Worker
- Adicionar API de busca/filtro de leis
- Criar endpoints para metadados (índices, categorias)
- Implementar versionamento de documentos legais
- Adicionar compressão/otimização de conteúdo

---

## 💾 **PERSISTÊNCIA DE DADOS**

### 🏪 Locais de Armazenamento:

1. **IndexedDB** (`src/db.js`) - Dados principais
2. **Chrome Storage API** - Configurações da extensão
3. **Local Storage** - Cache temporário (se necessário)

### 📊 Fluxo de Dados:

```
Captura de Conteúdo → Content Script → Service Worker → IndexedDB
                                    ↓
                              Notification ao usuário
```

### 🔄 Sincronização:

**Service Worker** (`src/sw.js`) gerencia:
- Context menus (captura de seleção/página completa)
- Comunicação entre content script e popup
- Armazenamento de capturas
- Notificações ao usuário

---

## 🧪 **DESENVOLVIMENTO E TESTES**

### 📋 Configuração de Desenvolvimento:

1. **Chrome Canary** com flags de IA habilitadas
2. **Modo Desenvolvedor** em `chrome://extensions`
3. **Carregar extensão** não empacotada

### 🧪 Arquivos de Teste:

- `test-extension.html` - Teste básico da extensão
- `test-context-management.html` - Teste de gerenciamento de contexto
- `test-validation.html` - Teste de validação
- Pasta `tests/` - Testes unitários com Vitest

### 🚀 Scripts Disponíveis:
```bash
npm test          # Executa testes uma vez
npm run test:watch # Executa testes em modo watch
npm run test:coverage # Executa com cobertura
```

### 🔧 Ferramentas de Debug:

1. **DevTools da Extensão:** `chrome://extensions` → Detalhes → Inspecionar views
2. **Console do Service Worker:** Background page inspector
3. **IndexedDB Inspector:** DevTools → Application → Storage

---

## 🎯 **PRÓXIMOS PASSOS SUGERIDOS**

### Para o Colega de BD:
- [ ] Implementar índices otimizados para busca
- [ ] Criar funções de limpeza automática
- [ ] Adicionar validação de esquema

### Para o Colega de IA:
- [ ] Criar biblioteca de prompts pré-definidos
- [ ] Implementar detecção de disponibilidade da IA
- [ ] Adicionar fallbacks para quando IA não estiver disponível

### Para Integração de APIs:
- [ ] Configurar Cloudflare Worker
- [ ] Implementar cache inteligente
- [ ] Criar API de metadados das leis

### Para Todos:
- [ ] Revisar e testar integrações
- [ ] Documentar APIs internas
- [ ] Preparar demo final

---

## 📞 **Comunicação Entre Componentes**

```
Content Script ←→ Service Worker ←→ Popup/UI ←→ IndexedDB
       ↓                ↓              ↓
   Captura texto    Processa      Exibe dados
                   notificações   e configurações
```

**Mensagens principais:**
- `LEXFLOW_GET_SELECTION` - Capturar seleção
- `LEXFLOW_GET_FULLPAGE` - Capturar página completa  
- `LEXFLOW_CAPTURE_PAYLOAD` - Dados capturados
- `LEXFLOW_CAPTURE_ERROR` - Erro na captura

---

Este guia deve dar a cada membro da equipe uma visão clara de sua área de responsabilidade e como integrar com o resto do sistema. Boa sorte no hackathon! 🚀