/**
 * Data Manager for LexFlow
 * Handles local storage and mock data for the application
 */

export class DataManager {
    constructor() {
        this.storageKey = 'lexflow-data';
        this.data = {
            userData: {
                name: 'Dr. Maria Silva',
                location: 'Porto Alegre, RS'
            },
            history: [],
            queueItems: [],
            settings: {}
        };
    }

    /**
     * Initialize data manager
     */
    async init() {
        try {
            await this.loadData();
            this.setupExtensionListener();
            console.log('Data Manager initialized');
        } catch (error) {
            console.error('Error initializing Data Manager:', error);
        }
    }

    /**
     * Load data from localStorage
     */
    async loadData() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.data = { ...this.data, ...parsed };
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    /**
     * Save data to localStorage
     */
    async saveData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    /**
     * Get user data
     * @returns {Object} User data
     */
    async getUserData() {
        return this.data.userData;
    }

    /**
     * Save user data
     * @param {Object} userData - User data to save
     */
    async saveUserData(userData) {
        this.data.userData = { ...this.data.userData, ...userData };
        await this.saveData();
    }

    /**
     * Get history items
     * @returns {Array} History items
     */
    async getHistory() {
        return this.data.history || [];
    }

    /**
     * Save history items
     * @param {Array} history - History items to save
     */
    async saveHistory(history) {
        this.data.history = history;
        await this.saveData();
    }

    /**
     * Get queue items (from Chrome storage if available, fallback to localStorage)
     * @returns {Array} Queue items
     */
    async getQueueItems() {
        try {
            // Try Chrome storage first (if running as extension)
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.storage) {
                const result = await chrome.storage.local.get(['lexflow_queue']);
                return result.lexflow_queue || [];
            }
        } catch (error) {
            console.log('Chrome storage not available, using localStorage');
        }
        
        // Fallback to localStorage
        return this.data.queueItems || [];
    }

    /**
     * Save queue items
     * @param {Array} queueItems - Queue items to save
     */
    async saveQueueItems(queueItems) {
        try {
            // Try Chrome storage first (if running as extension)
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.storage) {
                await chrome.storage.local.set({ lexflow_queue: queueItems });
                return;
            }
        } catch (error) {
            console.log('Chrome storage not available, using localStorage');
        }
        
        // Fallback to localStorage
        this.data.queueItems = queueItems;
        await this.saveData();
    }

    /**
     * Listen for captured content from extension
     */
    setupExtensionListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                    if (message?.type === "CONTENT_CAPTURED") {
                        // Trigger UI update when content is captured
                        if (window.app && typeof window.app.updateCollectorView === 'function') {
                            window.app.updateCollectorView();
                        }
                    }
                });
            } catch (error) {
                console.log('Extension messaging not available');
            }
        }
    }

    /**
     * Get available documents based on jurisdiction
     * @param {string} country - Country code
     * @param {string} state - State code
     * @param {string} city - City name
     * @returns {Array} Available documents
     */
    getDocuments(country = 'br', state = 'rs', city = 'porto-alegre') {
        const documents = {
            br: {
                federal: [
                    {
                        id: 'constituicao',
                        title: 'Constituição Federal 1988',
                        scope: 'Federal',
                        articles: 250,
                        year: 1988
                    },
                    {
                        id: 'codigo-civil',
                        title: 'Código Civil',
                        scope: 'Federal',
                        articles: 2046,
                        year: 2002
                    },
                    {
                        id: 'cdc',
                        title: 'Código de Defesa do Consumidor',
                        scope: 'Federal',
                        articles: 119,
                        year: 1990
                    },
                    {
                        id: 'clt',
                        title: 'Consolidação das Leis do Trabalho',
                        scope: 'Federal',
                        articles: 922,
                        year: 1943
                    }
                ],
                state: {
                    rs: [
                        {
                            id: 'constituicao-rs',
                            title: 'Constituição do Estado do RS',
                            scope: 'Estadual',
                            articles: 216,
                            year: 1989
                        }
                    ]
                },
                municipal: {
                    'porto-alegre': [
                        {
                            id: 'lei-organica-poa',
                            title: 'Lei Orgânica de Porto Alegre',
                            scope: 'Municipal',
                            articles: 187,
                            year: 1990
                        }
                    ]
                }
            }
        };

        let availableDocs = [];
        
        // Add federal documents
        if (documents[country]?.federal) {
            availableDocs.push(...documents[country].federal);
        }
        
        // Add state documents
        if (documents[country]?.state?.[state]) {
            availableDocs.push(...documents[country].state[state]);
        }
        
        // Add municipal documents
        if (documents[country]?.municipal?.[city]) {
            availableDocs.push(...documents[country].municipal[city]);
        }

        return availableDocs;
    }

    /**
     * Get articles for a specific document
     * @param {string} documentId - Document ID
     * @returns {Array} Articles for the document
     */
    getArticles(documentId) {
        const articlesData = {
            'constituicao': [
                {
                    number: 'Art. 1º',
                    content: 'A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos: I - a soberania; II - a cidadania; III - a dignidade da pessoa humana; IV - os valores sociais do trabalho e da livre iniciativa; V - o pluralismo político.'
                },
                {
                    number: 'Art. 5º',
                    content: 'Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes: I - homens e mulheres são iguais em direitos e obrigações, nos termos desta Constituição...'
                },
                {
                    number: 'Art. 6º',
                    content: 'São direitos sociais a educação, a saúde, a alimentação, o trabalho, a moradia, o transporte, o lazer, a segurança, a previdência social, a proteção à maternidade e à infância, a assistência aos desamparados, na forma desta Constituição.'
                },
                {
                    number: 'Art. 170',
                    content: 'A ordem econômica, fundada na valorização do trabalho humano e na livre iniciativa, tem por fim assegurar a todos existência digna, conforme os ditames da justiça social, observados os seguintes princípios: I - soberania nacional; II - propriedade privada; III - função social da propriedade...'
                }
            ],
            'codigo-civil': [
                {
                    number: 'Art. 1º',
                    content: 'Toda pessoa é capaz de direitos e deveres na ordem civil.'
                },
                {
                    number: 'Art. 2º',
                    content: 'A personalidade civil da pessoa começa do nascimento com vida; mas a lei põe a salvo, desde a concepção, os direitos do nascituro.'
                },
                {
                    number: 'Art. 186',
                    content: 'Aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito.'
                },
                {
                    number: 'Art. 927',
                    content: 'Aquele que, por ato ilícito (arts. 186 e 187), causar dano a outrem, fica obrigado a repará-lo. Parágrafo único. Haverá obrigação de reparar o dano, independentemente de culpa, nos casos especificados em lei, ou quando a atividade normalmente desenvolvida pelo autor do dano implicar, por sua natureza, risco para os direitos de outrem.'
                }
            ],
            'cdc': [
                {
                    number: 'Art. 1º',
                    content: 'O presente código estabelece normas de proteção e defesa do consumidor, de ordem pública e interesse social, nos termos dos arts. 5º, inciso XXXII, 170, inciso V, da Constituição Federal e art. 48 de suas Disposições Transitórias.'
                },
                {
                    number: 'Art. 6º',
                    content: 'São direitos básicos do consumidor: I - a proteção da vida, saúde e segurança contra os riscos provocados por práticas no fornecimento de produtos e serviços considerados perigosos ou nocivos; II - a educação e divulgação sobre o consumo adequado dos produtos e serviços...'
                },
                {
                    number: 'Art. 14',
                    content: 'O fornecedor de serviços responde, independentemente da existência de culpa, pela reparação dos danos causados aos consumidores por defeitos relativos à prestação dos serviços, bem como por informações insuficientes ou inadequadas sobre sua fruição e riscos.'
                },
                {
                    number: 'Art. 18',
                    content: 'Os fornecedores de produtos de consumo duráveis ou não duráveis respondem solidariamente pelos vícios de qualidade ou quantidade que os tornem impróprios ou inadequados ao consumo a que se destinam ou lhes diminuam o valor...'
                }
            ],
            'clt': [
                {
                    number: 'Art. 1º',
                    content: 'Esta Consolidação estatui as normas que regulam as relações individuais e coletivas de trabalho, nela previstas.'
                },
                {
                    number: 'Art. 3º',
                    content: 'Considera-se empregado toda pessoa física que prestar serviços de natureza não eventual a empregador, sob a dependência deste e mediante salário.'
                },
                {
                    number: 'Art. 4º',
                    content: 'Considera-se como de serviço efetivo o período em que o empregado esteja à disposição do empregador, aguardando ou executando ordens, salvo disposição especial expressamente consignada.'
                }
            ],
            'lei-organica-poa': [
                {
                    number: 'Art. 1º',
                    content: 'O Município de Porto Alegre, pessoa jurídica de direito público interno, é unidade territorial que integra a organização político-administrativa da República Federativa do Brasil, dotada de autonomia política, administrativa, financeira e legislativa nos termos assegurados pela Constituição da República, pela Constituição do Estado e por esta Lei Orgânica.'
                },
                {
                    number: 'Art. 2º',
                    content: 'O Município de Porto Alegre rege-se pelos princípios de legalidade, impessoalidade, moralidade, publicidade, eficiência, participação, descentralização e controle social.'
                }
            ]
        };

        return articlesData[documentId] || [];
    }

    /**
     * Get a specific article
     * @param {string} documentId - Document ID
     * @param {string} articleNumber - Article number
     * @returns {Object} Article object
     */
    getArticle(documentId, articleNumber) {
        const articles = this.getArticles(documentId);
        return articles.find(article => article.number === articleNumber) || {};
    }

    /**
     * Search articles across documents
     * @param {string} searchTerm - Search term
     * @param {Array} documentIds - Document IDs to search in
     * @returns {Array} Matching articles
     */
    searchArticles(searchTerm, documentIds = []) {
        if (!searchTerm) return [];

        const results = [];
        const term = searchTerm.toLowerCase();

        documentIds.forEach(docId => {
            const articles = this.getArticles(docId);
            const matches = articles.filter(article => 
                article.content.toLowerCase().includes(term) ||
                article.number.toLowerCase().includes(term)
            );
            
            matches.forEach(article => {
                results.push({
                    ...article,
                    documentId: docId,
                    documentTitle: this.getDocuments().find(doc => doc.id === docId)?.title || docId
                });
            });
        });

        return results;
    }

    /**
     * Get settings
     * @returns {Object} Settings object
     */
    async getSettings() {
        return this.data.settings || {};
    }

    /**
     * Save settings
     * @param {Object} settings - Settings to save
     */
    async saveSettings(settings) {
        this.data.settings = { ...this.data.settings, ...settings };
        await this.saveData();
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        this.data = {
            userData: {
                name: 'Dr. Maria Silva',
                location: 'Porto Alegre, RS'
            },
            history: [],
            queueItems: [],
            settings: {}
        };
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Export data for backup
     * @returns {Object} All application data
     */
    exportData() {
        return {
            ...this.data,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    /**
     * Import data from backup
     * @param {Object} importData - Data to import
     */
    async importData(importData) {
        if (importData && typeof importData === 'object') {
            this.data = {
                userData: importData.userData || this.data.userData,
                history: importData.history || [],
                queueItems: importData.queueItems || [],
                settings: importData.settings || {}
            };
            await this.saveData();
        }
    }
}