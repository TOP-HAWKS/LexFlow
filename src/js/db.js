/**
 * LexFlow Database Manager - PRODUÇÃO
 * Gerencia IndexedDB para persistência de dados reais
 * Sistema robusto para dados de produção
 */

export class DatabaseManager {
    constructor() {
        this.dbName = 'lexflow_db';
        this.dbVersion = 2;
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Inicializa a conexão com o IndexedDB
     * @returns {Promise<IDBDatabase>} Conexão com o banco
     */
    async init() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Erro ao abrir IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('IndexedDB conectado com sucesso');
                resolve(this.db);
            };
            
            // Cria as stores na primeira vez ou quando a versão muda
            request.onupgradeneeded = (event) => {
                console.log('Criando/atualizando stores do IndexedDB');
                this.createStores(event.target.result);
            };
        });
    }

    /**
     * Cria as stores (tabelas) do banco de dados
     * @param {IDBDatabase} db - Conexão com o banco
     */
    createStores(db) {
        // 1. Store: history - Histórico de análises de IA
        if (!db.objectStoreNames.contains('history')) {
            const historyStore = db.createObjectStore('history', { keyPath: 'id' });
            historyStore.createIndex('data', 'data', { unique: false });
            historyStore.createIndex('engine', 'engine', { unique: false });
            historyStore.createIndex('preset', 'preset', { unique: false });
            console.log('Store "history" criada');
        }
        
        // 2. Store: config - Configurações do sistema
        if (!db.objectStoreNames.contains('config')) {
            const configStore = db.createObjectStore('config', { keyPath: 'key' });
            console.log('Store "config" criada');
        }
        
        // 3. Store: law_files - Arquivos de leis completos
        if (!db.objectStoreNames.contains('law_files')) {
            const lawFilesStore = db.createObjectStore('law_files', { keyPath: 'id' });
            console.log('Store "law_files" criada');
        }
        
        // 4. Store: articles - Artigos individuais das leis
        if (!db.objectStoreNames.contains('articles')) {
            const articlesStore = db.createObjectStore('articles', { keyPath: 'id' });
            articlesStore.createIndex('lawFileId', 'lawFileId', { unique: false });
            articlesStore.createIndex('title', 'title', { unique: false });
            console.log('Store "articles" criada');
        }
    }

    // ========================================
    // MÉTODOS PARA HISTÓRICO DE IA (history)
    // ========================================

    /**
     * Salva nova análise de IA no histórico
     * @param {Object} item - Item do histórico
     * @returns {Promise<IDBRequest>}
     */
    async saveHistory(item) {
        await this.ensureInitialized();
        
        // Validação básica
        const validation = this.validateHistoryItem(item);
        if (!validation.isValid) {
            throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
        }

        const transaction = this.db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        return store.add(item);
    }

    /**
     * Lista histórico (últimas N análises)
     * @param {number} limit - Limite de itens (padrão: 20)
     * @returns {Promise<Array>} Lista de itens do histórico
     */
    async listHistory(limit = 20) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const index = store.index('data');
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev'); // Ordem decrescente
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca histórico por motor de IA
     * @param {string} engine - Motor de IA
     * @returns {Promise<Array>} Lista de análises do motor
     */
    async searchHistoryByEngine(engine) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const index = store.index('engine');
        return index.getAll(engine);
    }

    /**
     * Busca histórico por preset
     * @param {string} preset - Preset usado
     * @returns {Promise<Array>} Lista de análises do preset
     */
    async searchHistoryByPreset(preset) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const index = store.index('preset');
        return index.getAll(preset);
    }

    // ========================================
    // MÉTODOS PARA CONFIGURAÇÕES (config)
    // ========================================

    /**
     * Salva configuração do usuário
     * @param {string} key - Chave da configuração
     * @param {*} value - Valor da configuração
     * @returns {Promise<IDBRequest>}
     */
    async setSetting(key, value) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['config'], 'readwrite');
        const store = transaction.objectStore('config');
        
        const setting = { key, value };
        return store.put(setting);
    }

    /**
     * Recupera configuração do usuário
     * @param {string} key - Chave da configuração
     * @returns {Promise<*>} Valor da configuração ou null
     */
    async getSetting(key) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['config'], 'readonly');
        const store = transaction.objectStore('config');
        const request = store.get(key);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Lista todas as configurações
     * @returns {Promise<Array>} Lista de configurações
     */
    async getAllSettings() {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['config'], 'readonly');
        const store = transaction.objectStore('config');
        return store.getAll();
    }

    // ========================================
    // MÉTODOS PARA ARQUIVOS DE LEIS (law_files)
    // ========================================

    /**
     * Salva arquivo de lei completo
     * @param {Object} lawFile - Arquivo de lei
     * @returns {Promise<IDBRequest>}
     */
    async saveLawFile(lawFile) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['law_files'], 'readwrite');
        const store = transaction.objectStore('law_files');
        return store.put(lawFile);
    }

    /**
     * Busca arquivo de lei por ID
     * @param {string} id - ID do arquivo
     * @returns {Promise<Object|null>} Arquivo de lei ou null
     */
    async getLawFile(id) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['law_files'], 'readonly');
        const store = transaction.objectStore('law_files');
        const request = store.get(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Lista todos os arquivos de lei
     * @returns {Promise<Array>} Lista de arquivos de lei
     */
    async listLawFiles() {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['law_files'], 'readonly');
        const store = transaction.objectStore('law_files');
        return store.getAll();
    }

    // ========================================
    // MÉTODOS PARA ARTIGOS INDIVIDUAIS (articles)
    // ========================================

    /**
     * Salva artigo individual
     * @param {Object} article - Artigo
     * @returns {Promise<IDBRequest>}
     */
    async saveArticle(article) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['articles'], 'readwrite');
        const store = transaction.objectStore('articles');
        return store.put(article);
    }

    /**
     * Busca artigo por ID composto
     * @param {string} id - ID do artigo (ex: CF88#1)
     * @returns {Promise<Object|null>} Artigo ou null
     */
    async getArticle(id) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');
        const request = store.get(id);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca todos os artigos de uma lei
     * @param {string} lawFileId - ID do arquivo de lei
     * @returns {Promise<Array>} Lista de artigos da lei
     */
    async getArticlesByLawFile(lawFileId) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');
        const index = store.index('lawFileId');
        return index.getAll(lawFileId);
    }

    /**
     * Busca artigos por texto
     * @param {string} searchTerm - Termo de busca
     * @returns {Promise<Array>} Lista de artigos encontrados
     */
    async searchArticles(searchTerm) {
        await this.ensureInitialized();
        
        const transaction = this.db.transaction(['articles'], 'readonly');
        const store = transaction.objectStore('articles');
        
        return new Promise((resolve, reject) => {
            const request = store.openCursor();
            const results = [];
            const term = searchTerm.toLowerCase();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const article = cursor.value;
                    if (article.body.toLowerCase().includes(term) || 
                        article.title.toLowerCase().includes(term)) {
                        results.push(article);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ========================================
    // MÉTODOS DE VALIDAÇÃO
    // ========================================

    /**
     * Valida item de histórico
     * @param {Object} item - Item a ser validado
     * @returns {Object} Resultado da validação
     */
    validateHistoryItem(item) {
        const errors = [];
        
        if (!item.id) errors.push('ID é obrigatório');
        if (!item.prompt) errors.push('Prompt é obrigatório');
        if (!item.saida) errors.push('Saída é obrigatória');
        if (!item.data) errors.push('Data é obrigatória');
        
        if (item.data && typeof item.data !== 'number') {
            errors.push('Data deve ser um número (timestamp)');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida item de configuração
     * @param {Object} item - Item a ser validado
     * @returns {Object} Resultado da validação
     */
    validateConfigItem(item) {
        const errors = [];
        
        if (!item.key) errors.push('Chave é obrigatória');
        if (item.value === undefined || item.value === null) {
            errors.push('Valor é obrigatório');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ========================================
    // MÉTODOS DE LIMPEZA
    // ========================================

    /**
     * Limpa histórico antigo (mantém últimos 6 meses)
     * @returns {Promise<number>} Número de itens removidos
     */
    async cleanOldHistory() {
        await this.ensureInitialized();
        
        const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
        
        const transaction = this.db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        const index = store.index('data');
        
        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.upperBound(sixMonthsAgo));
            let deletedCount = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`Limpeza concluída: ${deletedCount} itens removidos`);
                    resolve(deletedCount);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Executa limpeza básica automática
     * @returns {Promise<Object>} Resultado da limpeza
     */
    async performBasicCleanup() {
        try {
            const cleaned = await this.cleanOldHistory();
            console.log(`Limpeza automática: ${cleaned} itens removidos`);
            return { success: true, cleaned };
        } catch (error) {
            console.error('Erro na limpeza:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // MÉTODOS DE PRODUÇÃO - DADOS REAIS
    // ========================================

    /**
     * Verifica se o banco está vazio (para inicialização)
     * @returns {Promise<boolean>} True se vazio
     */
    async isEmpty() {
        await this.ensureInitialized();
        
        try {
            const stats = await this.getStats();
            return stats.total === 0;
        } catch (error) {
            console.error('Erro ao verificar se banco está vazio:', error);
            return true;
        }
    }

    /**
     * Inicializa configurações padrão do sistema
     * @returns {Promise<void>}
     */
    async initializeDefaultSettings() {
        await this.ensureInitialized();
        
        try {
            // Configurações padrão do sistema
            const defaultSettings = {
                'user_name': 'Usuário',
                'user_location': 'Brasil',
                'language': 'pt-BR',
                'jurisdiction': 'br',
                'theme': 'light',
                'auto_save': true,
                'notifications': true
            };

            for (const [key, value] of Object.entries(defaultSettings)) {
                const existing = await this.getSetting(key);
                if (!existing) {
                    await this.setSetting(key, value);
                }
            }
            
            console.log('Configurações padrão inicializadas');
        } catch (error) {
            console.error('Erro ao inicializar configurações padrão:', error);
        }
    }

    // ========================================
    // MÉTODOS UTILITÁRIOS
    // ========================================

    /**
     * Garante que o banco está inicializado
     * @private
     */
    async ensureInitialized() {
        if (!this.isInitialized || !this.db) {
            await this.init();
        }
    }

    /**
     * Fecha a conexão com o banco
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log('Conexão com IndexedDB fechada');
        }
    }

    /**
     * Verifica se o banco está disponível
     * @returns {boolean} True se disponível
     */
    isAvailable() {
        return typeof indexedDB !== 'undefined';
    }

    /**
     * Obtém estatísticas do banco
     * @returns {Promise<Object>} Estatísticas
     */
    async getStats() {
        await this.ensureInitialized();
        
        try {
            const [historyCount, configCount, lawFilesCount, articlesCount] = await Promise.all([
                this.getStoreCount('history'),
                this.getStoreCount('config'),
                this.getStoreCount('law_files'),
                this.getStoreCount('articles')
            ]);

            return {
                history: historyCount,
                config: configCount,
                lawFiles: lawFilesCount,
                articles: articlesCount,
                total: historyCount + configCount + lawFilesCount + articlesCount
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return { error: error.message };
        }
    }

    /**
     * Conta registros em uma store
     * @param {string} storeName - Nome da store
     * @returns {Promise<number>} Número de registros
     * @private
     */
    async getStoreCount(storeName) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Instância singleton para uso global
export const dbManager = new DatabaseManager();
