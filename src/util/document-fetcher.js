/**
 * Document Fetcher for LexFlow
 * Handles fetching legal documents from corpus URLs
 */

import { resolveCorpusBaseUrl } from './corpus-resolver.js';

/**
 * Fetch document list from corpus
 * @returns {Promise<Array>} Array of available documents
 */
export async function fetchDocumentsFromCorpus() {
    try {
        const corpusBaseUrl = await resolveCorpusBaseUrl();
        
        // For initial implementation, use hardcoded US federal documents
        const documents = [
            {
                id: 'constitution-article-i-section-8',
                title: 'U.S. Constitution - Article I, Section 8',
                path: 'en-US/US/federal/constitution/article-i-section-8.md',
                scope: 'Federal',
                jurisdiction: 'US/Federal',
                year: 1787
            },
            {
                id: 'constitution-amendment-iv',
                title: 'U.S. Constitution - Amendment IV',
                path: 'en-US/US/federal/constitution/amendment-iv.md',
                scope: 'Federal',
                jurisdiction: 'US/Federal',
                year: 1791
            },
            {
                id: 'constitution-amendment-xiv-section-1',
                title: 'U.S. Constitution - Amendment XIV, Section 1',
                path: 'en-US/US/federal/constitution/amendment-xiv-section-1.md',
                scope: 'Federal',
                jurisdiction: 'US/Federal',
                year: 1868
            }
        ];

        return documents;
    } catch (error) {
        console.error('Error fetching documents from corpus:', error);
        return getFallbackDocuments();
    }
}

/**
 * Fetch document content and parse articles
 * @param {Object} document - Document object
 * @returns {Promise<Array>} Array of articles
 */
export async function fetchDocumentContent(document) {
    try {
        const corpusBaseUrl = await resolveCorpusBaseUrl();
        const documentUrl = `${corpusBaseUrl}/${document.path}`;
        
        const response = await fetch(documentUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.status}`);
        }
        
        const markdown = await response.text();
        return parseMarkdownToArticles(markdown, document);
    } catch (error) {
        console.error('Error fetching document content:', error);
        return getMockArticles(document.id);
    }
}

/**
 * Parse markdown content into articles
 * @param {string} markdown - Markdown content
 * @param {Object} document - Document object
 * @returns {Array} Array of parsed articles
 */
function parseMarkdownToArticles(markdown, document) {
    const articles = [];
    
    // Remove YAML frontmatter if present
    const content = markdown.replace(/^---[\s\S]*?---\n/, '');
    
    // Split by headings (## or ###)
    const sections = content.split(/^(#{2,3})\s+(.+)$/gm);
    
    let currentHeading = null;
    let currentContent = '';
    
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        if (section.match(/^#{2,3}$/)) {
            // This is a heading marker, next item is the heading text
            if (currentHeading && currentContent.trim()) {
                articles.push({
                    id: `${document.id}-${slugify(currentHeading)}`,
                    number: currentHeading,
                    content: currentContent.trim(),
                    citation: `${document.jurisdiction}/${document.path}#${slugify(currentHeading)}`,
                    document: document.id
                });
            }
            currentHeading = sections[i + 1];
            currentContent = '';
            i++; // Skip the heading text
        } else if (currentHeading) {
            currentContent += section;
        }
    }
    
    // Add the last article if exists
    if (currentHeading && currentContent.trim()) {
        articles.push({
            id: `${document.id}-${slugify(currentHeading)}`,
            number: currentHeading,
            content: currentContent.trim(),
            citation: `${document.jurisdiction}/${document.path}#${slugify(currentHeading)}`,
            document: document.id
        });
    }
    
    return articles;
}

/**
 * Get fallback documents when corpus is not available
 * @returns {Array} Fallback document list
 */
function getFallbackDocuments() {
    return [
        {
            id: 'constitution-article-i-section-8',
            title: 'U.S. Constitution - Article I, Section 8',
            path: 'en-US/US/federal/constitution/article-i-section-8.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1787
        },
        {
            id: 'constitution-amendment-iv',
            title: 'U.S. Constitution - Amendment IV',
            path: 'en-US/US/federal/constitution/amendment-iv.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1791
        },
        {
            id: 'constitution-amendment-xiv-section-1',
            title: 'U.S. Constitution - Amendment XIV, Section 1',
            path: 'en-US/US/federal/constitution/amendment-xiv-section-1.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1868
        }
    ];
}

/**
 * Get mock articles for testing when document fetch fails
 * @param {string} documentId - Document ID
 * @returns {Array} Mock articles
 */
function getMockArticles(documentId) {
    const mockArticles = {
        'constitution-article-i-section-8': [
            {
                id: 'constitution-article-i-section-8-clause-1',
                number: 'Clause 1',
                content: 'The Congress shall have Power To lay and collect Taxes, Duties, Imposts and Excises, to pay the Debts and provide for the common Defence and general Welfare of the United States; but all Duties, Imposts and Excises shall be uniform throughout the United States.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-1',
                document: documentId
            },
            {
                id: 'constitution-article-i-section-8-clause-3',
                number: 'Clause 3 (Commerce Clause)',
                content: 'To regulate Commerce with foreign Nations, and among the several States, and with the Indian Tribes.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-3',
                document: documentId
            },
            {
                id: 'constitution-article-i-section-8-clause-18',
                number: 'Clause 18 (Necessary and Proper Clause)',
                content: 'To make all Laws which shall be necessary and proper for carrying into Execution the foregoing Powers, and all other Powers vested by this Constitution in the Government of the United States, or in any Department or Officer thereof.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-18',
                document: documentId
            }
        ],
        'constitution-amendment-iv': [
            {
                id: 'constitution-amendment-iv-text',
                number: 'Amendment IV',
                content: 'The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated, and no Warrants shall issue, but upon probable cause, supported by Oath or affirmation, and particularly describing the place to be searched, and the persons or things to be seized.',
                citation: 'US/Federal/constitution/amendment-iv.md#amendment-iv',
                document: documentId
            }
        ],
        'constitution-amendment-xiv-section-1': [
            {
                id: 'constitution-amendment-xiv-section-1-citizenship',
                number: 'Citizenship Clause',
                content: 'All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#citizenship-clause',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-privileges',
                number: 'Privileges or Immunities Clause',
                content: 'No State shall make or enforce any law which shall abridge the privileges or immunities of citizens of the United States.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#privileges-immunities',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-due-process',
                number: 'Due Process Clause',
                content: 'nor shall any State deprive any person of life, liberty, or property, without due process of law.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#due-process',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-equal-protection',
                number: 'Equal Protection Clause',
                content: 'nor deny to any person within its jurisdiction the equal protection of the laws.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#equal-protection',
                document: documentId
            }
        ]
    };
    
    return mockArticles[documentId] || [];
}

/**
 * Create URL-friendly slug from text
 * @param {string} text - Text to slugify
 * @returns {string} URL-friendly slug
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Search articles across all documents
 * @param {Array} documents - Array of documents
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Array of matching articles
 */
export async function searchArticlesAcrossDocuments(documents, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        return [];
    }
    
    const results = [];
    const term = searchTerm.toLowerCase();
    
    for (const document of documents) {
        try {
            const articles = await fetchDocumentContent(document);
            const matches = articles.filter(article => 
                article.content.toLowerCase().includes(term) ||
                article.number.toLowerCase().includes(term)
            );
            
            results.push(...matches.map(article => ({
                ...article,
                documentTitle: document.title
            })));
        } catch (error) {
            console.error(`Error searching in document ${document.id}:`, error);
        }
    }
    
    return results;
}