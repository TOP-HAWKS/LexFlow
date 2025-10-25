/**
 * Database Integration Layer - PRODUÇÃO
 * Conecta o DatabaseManager com o sistema existente de forma segura
 * API unificada para dados reais de produção
 */

import { dbManager } from './db.js';
import { DataManager } from './data-manager.js';

export class DatabaseIntegration {
    constructor() {
        this.dbManager = dbManager;
        this.dataManager = new DataManager(); // Fallback para LocalStorage
        this.isEnabled = false;
        this.fallbackMode = true; // Usa DataManager como fallback
    }

    /**
     * Inicializa a integração do banco de dados
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Verifica se IndexedDB está disponível
            if (!this.dbManager.isAvailable()) {
                console.log('IndexedDB não disponível, usando modo fallback');
                this.fallbackMode = true;
                await this.dataManager.init(); // Inicializa fallback
                return;
            }

            // Inicializa o banco
            await this.dbManager.init();
            
            // Inicializa configurações padrão se necessário
            await this.initializeDefaultSettings();
            
            this.isEnabled = true;
            this.fallbackMode = false;
            
            console.log('Database Integration ativada com sucesso');
            
        } catch (error) {
            console.error('Erro ao inicializar Database Integration:', error);
            this.fallbackMode = true;
            await this.dataManager.init(); // Inicializa fallback em caso de erro
        }
    }

    /**
     * Inicializa configurações padrão do sistema
     * @returns {Promise<void>}
     */
    async initializeDefaultSettings() {
        if (!this.isEnabled) {
            console.log('Database não disponível, configurações não inicializadas');
            return;
        }

        try {
            // Verifica se é primeira inicialização
            const isEmpty = await this.dbManager.isEmpty();
            
            if (isEmpty) {
                console.log('Primeira inicialização - configurando padrões do sistema');
                await this.dbManager.initializeDefaultSettings();
            }
        } catch (error) {
            console.error('Erro ao inicializar configurações padrão:', error);
        }
    }

    // ========================================
    // MÉTODOS DE HISTÓRICO (compatibilidade)
    // ========================================

    /**
     * Salva análise no histórico (compatível com app.js)
     * @param {Object} analysisData - Dados da análise
     * @returns {Promise<void>}
     */
    async saveAnalysis(analysisData) {
        if (!this.isEnabled) {
            console.log('Database não disponível, salvando via fallback (LocalStorage)');
            // Usar data-manager como fallback
            const historyItem = {
                id: analysisData.id || 'hist_' + Date.now(),
                timestamp: analysisData.timestamp || new Date().toISOString(),
                prompt: analysisData.prompt || '',
                result: analysisData.saida || analysisData.result || '',
                articles: (analysisData.articles || []).join(', '),
                type: 'ai_analysis',
                engine: analysisData.engine || 'summarizer',
                preset: analysisData.preset || 'resumo-executivo'
            };
            
            const currentHistory = await this.dataManager.getHistory();
            currentHistory.unshift(historyItem);
            await this.dataManager.saveHistory(currentHistory);
            console.log('Análise salva no LocalStorage (fallback)');
            return;
        }

        try {
            const historyItem = {
                id: analysisData.id || 'hist_' + Date.now(),
                engine: analysisData.engine || 'summarizer',
                outputLanguage: analysisData.language || 'pt-BR',
                preset: analysisData.preset || 'resumo-executivo',
                prompt: analysisData.prompt || '',
                entrada: analysisData.entrada || '',
                saida: analysisData.saida || analysisData.result || '',
                data: analysisData.timestamp ? new Date(analysisData.timestamp).getTime() : Date.now(),
                artigos: analysisData.articles || []
            };

            await this.dbManager.saveHistory(historyItem);
            console.log('Análise salva no IndexedDB');
            
        } catch (error) {
            console.error('Erro ao salvar análise no IndexedDB, tentando fallback:', error);
            // Fallback em caso de erro no IndexedDB
            this.fallbackMode = true;
            await this.saveAnalysis(analysisData); // Recursão com fallback
        }
    }

    /**
     * Lista histórico de análises
     * @param {number} limit - Limite de itens
     * @returns {Promise<Array>} Lista de análises
     */
    async getHistory(limit = 20) {
        if (!this.isEnabled) {
            console.log('Database não disponível, usando fallback (LocalStorage)');
            try {
                const history = await this.dataManager.getHistory();
                return history.slice(0, limit); // Aplica limite
            } catch (error) {
                console.error('Erro ao buscar histórico no fallback:', error);
                return [];
            }
        }

        try {
            const history = await this.dbManager.listHistory(limit);
            
            // Converte para formato compatível com app.js
            return history.map(item => ({
                id: item.id,
                timestamp: new Date(item.data).toISOString(),
                prompt: item.prompt,
                result: item.saida,
                articles: item.artigos.join(', '),
                type: 'ai_analysis',
                engine: item.engine,
                preset: item.preset
            }));
            
        } catch (error) {
            console.error('Erro ao buscar histórico no IndexedDB, tentando fallback:', error);
            // Fallback em caso de erro
            this.fallbackMode = true;
            return await this.getHistory(limit); // Recursão com fallback
        }
    }

    // ========================================
    // MÉTODOS DE CONFIGURAÇÃO (compatibilidade)
    // ========================================

    /**
     * Salva configuração do usuário
     * @param {string} key - Chave da configuração
     * @param {*} value - Valor da configuração
     * @returns {Promise<void>}
     */
    async saveSetting(key, value) {
        if (!this.isEnabled) {
            console.log('Database não disponível, salvando configuração via fallback (LocalStorage)');
            try {
                const settings = await this.dataManager.getSettings();
                settings[key] = value;
                await this.dataManager.saveSettings(settings);
                console.log(`Configuração ${key} salva no LocalStorage (fallback)`);
            } catch (error) {
                console.error('Erro ao salvar configuração no fallback:', error);
            }
            return;
        }

        try {
            await this.dbManager.setSetting(key, value);
            console.log(`Configuração ${key} salva no IndexedDB`);
        } catch (error) {
            console.error('Erro ao salvar configuração no IndexedDB, tentando fallback:', error);
            // Fallback em caso de erro
            this.fallbackMode = true;
            await this.saveSetting(key, value); // Recursão com fallback
        }
    }

    /**
     * Recupera configuração do usuário
     * @param {string} key - Chave da configuração
     * @returns {Promise<*>} Valor da configuração
     */
    async getSetting(key) {
        if (!this.isEnabled) {
            console.log('Database não disponível, usando fallback (LocalStorage)');
            try {
                const settings = await this.dataManager.getSettings();
                return settings[key] || null;
            } catch (error) {
                console.error('Erro ao buscar configuração no fallback:', error);
                return null;
            }
        }

        try {
            return await this.dbManager.getSetting(key);
        } catch (error) {
            console.error('Erro ao buscar configuração no IndexedDB, tentando fallback:', error);
            // Fallback em caso de erro
            this.fallbackMode = true;
            return await this.getSetting(key); // Recursão com fallback
        }
    }

    // ========================================
    // MÉTODOS DE ARTIGOS (novos recursos)
    // ========================================

    /**
     * Busca artigos por termo
     * @param {string} searchTerm - Termo de busca
     * @returns {Promise<Array>} Lista de artigos encontrados
     */
    async searchArticles(searchTerm) {
        if (!this.isEnabled) {
            console.log('Database não disponível, retornando array vazio');
            return [];
        }

        try {
            return await this.dbManager.searchArticles(searchTerm);
        } catch (error) {
            console.error('Erro ao buscar artigos:', error);
            return [];
        }
    }

    /**
     * Busca artigos de uma lei específica
     * @param {string} lawFileId - ID do arquivo de lei
     * @returns {Promise<Array>} Lista de artigos da lei
     */
    async getArticlesByLaw(lawFileId) {
        if (!this.isEnabled) {
            console.log('Database não disponível, retornando array vazio');
            return [];
        }

        try {
            return await this.dbManager.getArticlesByLawFile(lawFileId);
        } catch (error) {
            console.error('Erro ao buscar artigos da lei:', error);
            return [];
        }
    }

    // ========================================
    // MÉTODOS DE ESTATÍSTICAS
    // ========================================

    /**
     * Obtém estatísticas do banco
     * @returns {Promise<Object>} Estatísticas
     */
    async getStats() {
        if (!this.isEnabled) {
            return { error: 'Database não disponível' };
        }

        try {
            return await this.dbManager.getStats();
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return { error: error.message };
        }
    }

    // ========================================
    // MÉTODOS DE LIMPEZA
    // ========================================

    /**
     * Executa limpeza automática
     * @returns {Promise<Object>} Resultado da limpeza
     */
    async performCleanup() {
        if (!this.isEnabled) {
            return { success: false, error: 'Database não disponível' };
        }

        try {
            return await this.dbManager.performBasicCleanup();
        } catch (error) {
            console.error('Erro na limpeza:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // MÉTODOS DE STATUS
    // ========================================

    /**
     * Verifica se a integração está ativa
     * @returns {boolean} True se ativa
     */
    isActive() {
        return this.isEnabled && !this.fallbackMode;
    }

    /**
     * Verifica se está em modo fallback
     * @returns {boolean} True se em fallback
     */
    isInFallbackMode() {
        return this.fallbackMode;
    }

    /**
     * Obtém informações de status
     * @returns {Object} Status da integração
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            fallbackMode: this.fallbackMode,
            indexedDBAvailable: this.dbManager.isAvailable(),
            active: this.isActive()
        };
    }
}

// Instância singleton para uso global
export const dbIntegration = new DatabaseIntegration();
