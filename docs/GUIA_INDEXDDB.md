# 🗄️ **GUIA DE USO - SISTEMA DE PERSISTÊNCIA LEXFLOW**

## 📋 **VISÃO GERAL**

O LexFlow implementa um sistema de persistência em **3 camadas** para garantir robustez, compatibilidade e escalabilidade. Cada arquivo tem uma responsabilidade específica no fluxo de dados da aplicação.

---

## 🔄 **FLUXO COMPLETO DE DADOS**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Service Worker │    │   Content Script│
│   (app.js)      │    │   (Chrome API)   │    │   (Captura)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ db-integration  │    │  Chrome Storage  │    │   Captura de    │
│   (Orquestra)   │    │   (Configurações)│    │   Conteúdo      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│     db.js       │    │  data-manager    │
│  (IndexedDB)    │    │ (Local Storage)  │
│(Dados Principais)│   │  (Cache/Fallback)│
└─────────────────┘    └──────────────────┘
```

## 🔄 **SISTEMA DE FALLBACK AUTOMÁTICO**

```
┌─────────────────────────────────────────────────────────────┐
│                    db-integration.js                        │
│                  (Orquestrador Inteligente)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DECISÃO AUTOMÁTICA: Qual sistema usar?                     │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   IndexedDB Disponível? │   │   IndexedDB Falhou?     │
│                         │   │                         │
│  ✅ SIM → db.js         │   │  ❌ NÃO → data-manager  │
│     (Dados Robustos)    │   │     (LocalStorage)      │
└─────────────────────────┘   └─────────────────────────┘
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│  💾 IndexedDB           │   │  💾 LocalStorage        │
│  - Dados complexos      │   │  - Dados simples        │
│  - Buscas rápidas       │   │  - Fallback seguro      │
│  - Relacionamentos      │   │  - Sempre funciona      │
└─────────────────────────┘   └─────────────────────────┘
```

---

## 📁 **ARQUIVO 1: `db.js` - CAMADA PRINCIPAL**

### **🎯 PROPÓSITO**
**Sistema de banco de dados robusto** para persistência de dados críticos da aplicação usando IndexedDB.

### **🔧 RESPONSABILIDADES**
- **IndexedDB** com 4 stores estruturadas
- **CRUD operations** completas
- **Validação de dados** antes de salvar
- **Limpeza automática** de dados antigos
- **Índices otimizados** para buscas rápidas

### **📊 DADOS ARMAZENADOS**
```javascript
// Store: history - Análises de IA
{ id, engine, prompt, resultado, timestamp, artigos }

// Store: config - Configurações do usuário  
{ key, value }

// Store: law_files - Documentos legais completos
{ id, name, content }

// Store: articles - Artigos individuais
{ id, lawFileId, title, body, citation }
```

### **🚀 COMO USAR**

#### **Importação**
```javascript
import { dbManager } from './src/js/db.js';
```

#### **Inicialização**
```javascript
// Inicializar o banco
await dbManager.init();

// Verificar se está disponível
if (dbManager.isAvailable()) {
    console.log('IndexedDB disponível');
}
```

#### **Histórico de IA**
```javascript
// Salvar nova análise
const analysisData = {
    id: 'hist_' + Date.now(),
    engine: 'summarizer',
    prompt: 'Analise este texto legal...',
    saida: 'Resultado da análise...',
    data: Date.now(),
    artigos: ['CF88#1', 'CC#186']
};

await dbManager.saveHistory(analysisData);

// Listar histórico (últimas 20)
const history = await dbManager.listHistory(20);

// Buscar por motor de IA
const geminiHistory = await dbManager.searchHistoryByEngine('gemini');

// Buscar por preset
const executiveHistory = await dbManager.searchHistoryByPreset('resumo-executivo');
```

#### **Configurações**
```javascript
// Salvar configuração
await dbManager.setSetting('user_name', 'Dr. Maria Silva');
await dbManager.setSetting('theme', 'dark');

// Recuperar configuração
const userName = await dbManager.getSetting('user_name');

// Listar todas as configurações
const allSettings = await dbManager.getAllSettings();
```

#### **Arquivos de Lei**
```javascript
// Salvar arquivo de lei
const lawFile = {
    id: 'CF88',
    name: 'Constituição Federal 1988',
    content: 'Conteúdo completo da CF...',
    articles: 250,
    year: 1988
};

await dbManager.saveLawFile(lawFile);

// Buscar arquivo por ID
const cf88 = await dbManager.getLawFile('CF88');

// Listar todos os arquivos
const allLaws = await dbManager.listLawFiles();
```

#### **Artigos Individuais**
```javascript
// Salvar artigo
const article = {
    id: 'CF88#1',
    lawFileId: 'CF88',
    title: 'Art. 1º - Fundamentos da República',
    body: 'A República Federativa do Brasil...',
    citation: 'CF, art. 1º'
};

await dbManager.saveArticle(article);

// Buscar artigo por ID
const art1 = await dbManager.getArticle('CF88#1');

// Buscar artigos de uma lei
const cfArticles = await dbManager.getArticlesByLawFile('CF88');

// Buscar artigos por texto
const searchResults = await dbManager.searchArticles('soberania');
```

#### **Manutenção e Estatísticas**
```javascript
// Obter estatísticas
const stats = await dbManager.getStats();
console.log(`Total de registros: ${stats.total}`);

// Limpeza automática (remove dados > 6 meses)
const cleaned = await dbManager.performBasicCleanup();

// Fechar conexão
dbManager.close();
```

---

## 📁 **ARQUIVO 2: `db-integration.js` - CAMADA DE ORQUESTRAÇÃO**

### **🎯 PROPÓSITO**
**Camada de integração** que conecta o banco robusto com o frontend existente, fornecendo API unificada.

### **🔧 RESPONSABILIDADES**
- **API unificada** para o frontend
- **Conversão de formatos** entre sistemas
- **Modo fallback automático** se IndexedDB falhar
- **Compatibilidade** com código existente
- **Tratamento de erros** transparente
- **Fallback real** para LocalStorage quando necessário

### **🚀 COMO USAR**

#### **Importação**
```javascript
import { dbIntegration } from './src/js/db-integration.js';
```

#### **Inicialização**
```javascript
// Inicializar integração
await dbIntegration.init();

// Verificar status
const status = dbIntegration.getStatus();
console.log('Database ativo:', status.active);
console.log('Modo fallback:', status.fallbackMode);
```

#### **Histórico (Compatível com app.js)**
```javascript
// Salvar análise (formato compatível)
const analysisData = {
    id: 'analysis_123',
    engine: 'summarizer',
    language: 'pt-BR',
    preset: 'resumo-executivo',
    prompt: 'Analise este texto...',
    entrada: 'Texto original...',
    saida: 'Resultado da análise...',
    timestamp: new Date().toISOString(),
    articles: ['CF88#1', 'CC#186']
};

await dbIntegration.saveAnalysis(analysisData);

// Listar histórico
const history = await dbIntegration.getHistory(20);
```

#### **Configurações (Compatível com app.js)**
```javascript
// Salvar configuração
await dbIntegration.saveSetting('user_name', 'Dr. Maria Silva');

// Recuperar configuração
const userName = await dbIntegration.getSetting('user_name');
```

#### **Busca de Artigos**
```javascript
// Buscar artigos por termo
const articles = await dbIntegration.searchArticles('soberania');

// Buscar artigos de uma lei específica
const cfArticles = await dbIntegration.getArticlesByLaw('CF88');
```

#### **Estatísticas e Limpeza**
```javascript
// Obter estatísticas
const stats = await dbIntegration.getStats();

// Executar limpeza
const cleanup = await dbIntegration.performCleanup();
```

#### **🔄 FALLBACK AUTOMÁTICO**
```javascript
// O db-integration.js funciona assim:

// 1. TENTA IndexedDB primeiro
if (IndexedDB disponível) {
    await dbManager.saveHistory(data); // Salva no IndexedDB
} else {
    // 2. FALLBACK para LocalStorage
    await dataManager.saveHistory(data); // Salva no LocalStorage
}

// 3. Se IndexedDB falhar durante operação
try {
    await dbManager.saveHistory(data);
} catch (error) {
    // Fallback automático
    this.fallbackMode = true;
    await dataManager.saveHistory(data);
}
```

#### **Verificar Status do Fallback**
```javascript
// Verificar se está usando fallback
const status = dbIntegration.getStatus();
console.log('Usando fallback:', status.fallbackMode);
console.log('Database ativo:', status.active);

// Verificar se IndexedDB está disponível
console.log('IndexedDB disponível:', status.indexedDBAvailable);
```

---

## 📁 **ARQUIVO 3: `data-manager.js` - CAMADA DE FALLBACK**

### **🎯 PROPÓSITO**
**Sistema de fallback** para garantir que a aplicação sempre funcione usando LocalStorage e Chrome Storage API.

### **🔧 RESPONSABILIDADES**
- **LocalStorage** para dados simples
- **Chrome Storage API** para configurações da extensão
- **Dados mockados** para demonstração
- **Compatibilidade** com sistema antigo
- **Cache temporário** quando necessário

### **🚀 COMO USAR**

#### **Importação**
```javascript
import { DataManager } from './src/js/data-manager.js';

const dataManager = new DataManager();
```

#### **Inicialização**
```javascript
// Inicializar data manager
await dataManager.init();
```

#### **Dados do Usuário**
```javascript
// Obter dados do usuário
const userData = await dataManager.getUserData();

// Salvar dados do usuário
await dataManager.saveUserData({
    name: 'Dr. Maria Silva',
    location: 'Porto Alegre, RS'
});
```

#### **Histórico**
```javascript
// Obter histórico
const history = await dataManager.getHistory();

// Salvar histórico
await dataManager.saveHistory([
    { id: '1', timestamp: Date.now(), result: 'Análise 1' },
    { id: '2', timestamp: Date.now(), result: 'Análise 2' }
]);
```

#### **Fila de Capturas**
```javascript
// Obter itens da fila
const queueItems = await dataManager.getQueueItems();

// Salvar itens da fila
await dataManager.saveQueueItems([
    { id: '1', url: 'https://example.com', text: 'Texto capturado' }
]);
```

#### **Documentos Legais**
```javascript
// Obter documentos disponíveis
const documents = dataManager.getDocuments('br', 'rs', 'porto-alegre');

// Obter artigos de um documento
const articles = dataManager.getArticles('constituicao');

// Buscar artigos
const searchResults = dataManager.searchArticles('soberania', ['constituicao', 'codigo-civil']);
```

#### **Configurações**
```javascript
// Obter configurações
const settings = await dataManager.getSettings();

// Salvar configurações
await dataManager.saveSettings({
    theme: 'dark',
    language: 'pt-BR'
});
```

#### **Backup e Restore**
```javascript
// Exportar dados
const exportData = dataManager.exportData();

// Importar dados
await dataManager.importData(importData);

// Limpar todos os dados
await dataManager.clearAllData();
```

---

## 🎯 **GUIA PARA AS TAREFAS DOS COLEGAS**

### **🤖 PARA O COLEGA DE IA**

#### **Integração com Gemini Nano**
```javascript
// No arquivo chrome-ai.js, use dbIntegration para salvar análises
import { dbIntegration } from './db-integration.js';

export async function analyzeWithGemini(text, prompt) {
    try {
        // Sua lógica de IA aqui
        const result = await geminiAPI.analyze(text, prompt);
        
        // Salvar no banco de dados
        await dbIntegration.saveAnalysis({
            id: 'gemini_' + Date.now(),
            engine: 'gemini-nano',
            prompt: prompt,
            entrada: text,
            saida: result,
            timestamp: new Date().toISOString(),
            articles: extractArticles(result)
        });
        
        return result;
    } catch (error) {
        console.error('Erro na análise:', error);
        throw error;
    }
}
```

#### **Presets de Prompts**
```javascript
// Criar presets específicos para análise legal
const LEGAL_PROMPTS = {
    'resumo-executivo': 'Resuma este texto legal de forma executiva...',
    'analise-juridica': 'Faça uma análise jurídica detalhada...',
    'identificar-artigos': 'Identifique e cite os artigos relevantes...'
};

// Usar com dbIntegration
await dbIntegration.saveAnalysis({
    preset: 'resumo-executivo',
    // ... outros dados
});
```

#### **Cache de Respostas**
```javascript
// Implementar cache inteligente
export async function getCachedAnalysis(text, prompt) {
    const cacheKey = `analysis_${hash(text)}_${hash(prompt)}`;
    const cached = await dbIntegration.getSetting(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < 3600000)) { // 1 hora
        return cached.result;
    }
    
    const result = await analyzeWithGemini(text, prompt);
    await dbIntegration.saveSetting(cacheKey, {
        result: result,
        timestamp: Date.now()
    });
    
    return result;
}
```

### **🌐 PARA INTEGRAÇÃO DE APIs**

#### **Conexão com Cloudflare Worker**
```javascript
// No arquivo de configuração, use dbIntegration para cache
import { dbIntegration } from './db-integration.js';

export async function fetchLawFromAPI(lawId) {
    // Verificar cache primeiro
    const cached = await dbIntegration.getSetting(`law_${lawId}`);
    if (cached) {
        return cached;
    }
    
    // Buscar da API
    const response = await fetch(`https://seu-worker.workers.dev/api/laws/${lawId}`);
    const lawData = await response.json();
    
    // Salvar no cache
    await dbIntegration.saveSetting(`law_${lawId}`, lawData);
    
    // Salvar no banco principal
    await dbManager.saveLawFile(lawData);
    
    return lawData;
}
```

#### **Sincronização de Dados**
```javascript
// Implementar sincronização periódica
export async function syncWithAPI() {
    try {
        const lastSync = await dbIntegration.getSetting('last_sync');
        const now = Date.now();
        
        if (!lastSync || (now - lastSync) > 3600000) { // 1 hora
            const laws = await fetchAllLawsFromAPI();
            
            for (const law of laws) {
                await dbManager.saveLawFile(law);
            }
            
            await dbIntegration.saveSetting('last_sync', now);
        }
    } catch (error) {
        console.error('Erro na sincronização:', error);
    }
}
```

### **📚 PARA O REPOSITÓRIO DE LEIS E CLOUDFLARE WORKER**

#### **Estrutura de Dados para o Worker**
```javascript
// Estrutura esperada pelo LexFlow
const lawFileStructure = {
    id: 'CF88', // ID único da lei
    name: 'Constituição Federal 1988',
    content: 'Conteúdo completo em markdown...',
    articles: 250,
    year: 1988,
    jurisdiction: 'br',
    scope: 'federal',
    lastUpdated: '2024-01-01T00:00:00Z'
};

const articleStructure = {
    id: 'CF88#1', // ID composto: lei#artigo
    lawFileId: 'CF88',
    title: 'Art. 1º - Fundamentos da República',
    body: 'A República Federativa do Brasil...',
    citation: 'CF, art. 1º',
    number: '1'
};
```

#### **Endpoints Sugeridos para o Worker**
```javascript
// GET /api/laws - Listar todas as leis
// GET /api/laws/{id} - Obter lei específica
// GET /api/laws/{id}/articles - Obter artigos de uma lei
// GET /api/search?q={term} - Buscar em todas as leis
// GET /api/jurisdiction/{country}/{state?}/{city?} - Leis por jurisdição
```

#### **Integração no LexFlow**
```javascript
// No data-manager.js, adicionar método para buscar do Worker
async fetchFromWorker(endpoint) {
    try {
        const baseUrl = await this.getSetting('worker_base_url') || 'https://seu-worker.workers.dev';
        const response = await fetch(`${baseUrl}${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar do Worker:', error);
        return null;
    }
}

// Usar com dbIntegration
const laws = await dataManager.fetchFromWorker('/api/laws');
for (const law of laws) {
    await dbManager.saveLawFile(law);
}
```

---

## 🚀 **VANTAGENS DESTA ARQUITETURA**

### **✅ ROBUSTEZ**
- **3 níveis de persistência** - Dados nunca se perdem
- **Fallback automático** - App sempre funciona
- **Tratamento de erros** - Falhas são transparentes

### **✅ PERFORMANCE**
- **IndexedDB** para dados complexos
- **LocalStorage** para dados simples
- **Índices otimizados** para buscas

### **✅ MANUTENIBILIDADE**
- **Responsabilidades claras** - Cada arquivo tem um propósito
- **Baixo acoplamento** - Mudanças isoladas
- **Fácil teste** - Cada camada testável independentemente

### **✅ ESCALABILIDADE**
- **Migração gradual** - Pode evoluir sem quebrar
- **Adição de features** - Novas funcionalidades isoladas
- **Troca de backend** - Pode trocar IndexedDB por outro banco

---

## 📋 **RESUMO EXECUTIVO**

**Criamos 3 arquivos porque precisamos de 3 níveis de persistência:**

1. **`db.js`** = **Banco principal** (IndexedDB) - Dados críticos
2. **`db-integration.js`** = **Orquestrador** - Conecta tudo
3. **`data-manager.js`** = **Fallback** - Garante funcionamento

**Resultado:** Sistema robusto, performático e que nunca falha! 🚀

---

## 🔧 **CONFIGURAÇÃO INICIAL**

```javascript
// No app.js principal
import { dbIntegration } from './src/js/db-integration.js';

// Inicializar na startup da aplicação
async function initApp() {
    try {
        await dbIntegration.init();
        console.log('Sistema de persistência inicializado');
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
}

// Usar em toda a aplicação
const history = await dbIntegration.getHistory();
const settings = await dbIntegration.getSetting('user_name');
```

---

**Este guia fornece todas as informações necessárias para cada membro da equipe utilizar o sistema de persistência de forma eficiente e integrada! 🎯**
