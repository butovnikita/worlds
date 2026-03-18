/**
 * Lorebook Keyword Translator (RU) - SillyTavern Extension
 * Translates lorebook keywords to Russian using MyMemory API
 */

(function() {
    'use strict';

    // Extension info
    const extensionName = 'sillytavern-keyword-translator';
    
    // MyMemory API endpoint (free, no key required)
    const TRANSLATION_API = 'https://api.mymemory.translated.net/get';
    
    // Rate limit delay between requests (ms)
    const REQUEST_DELAY = 500;
    
    // SillyTavern context reference
    let context;

    /**
     * Translate a single text using MyMemory API
     * @param {string} text - Text to translate
     * @param {string} sourceLang - Source language code (e.g., 'en')
     * @param {string} targetLang - Target language code (e.g., 'ru')
     * @returns {Promise<string>} - Translated text
     */
    async function translateText(text, sourceLang = 'en', targetLang = 'ru') {
        if (!text || text.trim() === '') return text;
        
        try {
            const url = `${TRANSLATION_API}?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.responseStatus === 200 && data.responseData) {
                return data.responseData.translatedText;
            } else {
                console.warn(`[${extensionName}] Translation failed for: "${text}"`, data);
                return text;
            }
        } catch (error) {
            console.error(`[${extensionName}] Translation error:`, error);
            return text;
        }
    }

    /**
     * Delay execution for specified milliseconds
     * @param {number} ms - Milliseconds to wait
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get all available lorebook names
     * @returns {Promise<string[]>} - Array of lorebook names
     */
    async function getLorebookNames() {
        try {
            const response = await fetch('/api/lorebooks/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            return data || [];
        } catch (error) {
            console.error(`[${extensionName}] Failed to get lorebooks:`, error);
            return [];
        }
    }

    /**
     * Load a specific lorebook by name
     * @param {string} name - Lorebook name
     * @returns {Promise<Object>} - Lorebook data
     */
    async function loadLorebook(name) {
        try {
            const response = await fetch('/api/lorebooks/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            return await response.json();
        } catch (error) {
            console.error(`[${extensionName}] Failed to load lorebook:`, error);
            return null;
        }
    }

    /**
     * Save lorebook data
     * @param {string} name - Lorebook name
     * @param {Object} data - Lorebook data to save
     * @returns {Promise<boolean>} - Success status
     */
    async function saveLorebook(name, data) {
        try {
            const response = await fetch('/api/lorebooks/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data })
            });
            const result = await response.json();
            return result && result.ok;
        } catch (error) {
            console.error(`[${extensionName}] Failed to save lorebook:`, error);
            return false;
        }
    }

    /**
     * Translate all keywords in a lorebook entry
     * @param {Object} entry - Lorebook entry
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @returns {Promise<Object>} - Entry with translated keywords
     */
    async function translateEntryKeywords(entry, sourceLang, targetLang) {
        const originalKeys = entry.key || [];
        const secondaryKeys = entry.keysecondary || [];
        
        // Translate primary keywords
        const translatedPrimary = [];
        for (const key of originalKeys) {
            const translated = await translateText(key, sourceLang, targetLang);
            translatedPrimary.push(translated);
            await delay(REQUEST_DELAY);
        }
        
        // Translate secondary keywords
        const translatedSecondary = [];
        for (const key of secondaryKeys) {
            const translated = await translateText(key, sourceLang, targetLang);
            translatedSecondary.push(translated);
            await delay(REQUEST_DELAY);
        }
        
        return {
            ...entry,
            key: translatedPrimary,
            keysecondary: translatedSecondary
        };
    }

    /**
     * Main translation function for selected lorebook
     * @param {string} lorebookName - Name of the lorebook to translate
     * @param {string} sourceLang - Source language code
     * @param {string} targetLang - Target language code
     * @param {Function} progressCallback - Callback for progress updates
     */
    async function translateLorebook(lorebookName, sourceLang, targetLang, progressCallback) {
        const lorebook = await loadLorebook(lorebookName);
        if (!lorebook || !lorebook.entries) {
            throw new Error('Failed to load lorebook');
        }
        
        const entries = lorebook.entries;
        const totalEntries = entries.length;
        let translatedCount = 0;
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            if (progressCallback) {
                progressCallback(`Перевод записи ${i + 1}/${totalEntries}: ${entry.comment || 'Без названия'}`);
            }
            
            entries[i] = await translateEntryKeywords(entry, sourceLang, targetLang);
            translatedCount++;
        }
        
        // Save the updated lorebook
        const success = await saveLorebook(lorebookName, lorebook);
        
        if (!success) {
            throw new Error('Failed to save translated lorebook');
        }
        
        return { translatedCount, totalEntries };
    }

    /**
     * Create and inject UI elements
     */
    function injectUI() {
        // Check if UI already injected
        if ($(`#${extensionName}-container`).length > 0) {
            return;
        }
        
        const uiHtml = `
            <div id="${extensionName}-container" class="extension-container">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <span>🔄 Переводчик Keywords Lorebook</span>
                        <div class="inline-drawer-icon down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="flex-container">
                            <label for="${extensionName}-source-lang">Исходный язык:</label>
                            <select id="${extensionName}-source-lang" class="text_pole">
                                <option value="en" selected>English</option>
                                <option value="de">Deutsch</option>
                                <option value="fr">Français</option>
                                <option value="es">Español</option>
                                <option value="it">Italiano</option>
                                <option value="ja">日本語</option>
                                <option value="zh">中文</option>
                                <option value="ko">한국어</option>
                            </select>
                        </div>
                        <div class="flex-container">
                            <label for="${extensionName}-target-lang">Целевой язык:</label>
                            <select id="${extensionName}-target-lang" class="text_pole">
                                <option value="ru" selected>Русский</option>
                                <option value="en">English</option>
                                <option value="de">Deutsch</option>
                                <option value="fr">Français</option>
                            </select>
                        </div>
                        <div class="flex-container">
                            <label for="${extensionName}-lorebook-select">Lorebook:</label>
                            <select id="${extensionName}-lorebook-select" class="text_pole">
                                <option value="">-- Выберите Lorebook --</option>
                            </select>
                            <button id="${extensionName}-refresh" class="menu_button" title="Обновить список">
                                🔄
                            </button>
                        </div>
                        <div class="flex-container">
                            <button id="${extensionName}-translate-btn" class="menu_button">
                                🌐 Перевести Keywords
                            </button>
                        </div>
                        <div id="${extensionName}-progress" class="extension-progress" style="display: none;">
                            <div class="progress-text"></div>
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                            </div>
                        </div>
                        <div id="${extensionName}-status" class="extension-status"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert into extensions panel
        $('#extensions_settings').append(uiHtml);
        
        // Load CSS
        if (!$(`link[href*="${extensionName}"]`).length) {
            $('head').append(`<link rel="stylesheet" href="/scripts/extensions/${extensionName}/styles.css">`);
        }
    }

    /**
     * Refresh lorebook dropdown
     */
    async function refreshLorebookList() {
        const select = $(`#${extensionName}-lorebook-select`);
        select.html('<option value="">-- Загрузка... --</option>');
        
        const lorebooks = await getLorebookNames();
        
        select.html('<option value="">-- Выберите Lorebook --</option>');
        
        lorebooks.forEach(name => {
            select.append(`<option value="${name}">${name}</option>`);
        });
        
        showStatus('Список lorebooks обновлен', 'success');
    }

    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Message type (success, error, info)
     */
    function showStatus(message, type = 'info') {
        const statusEl = $(`#${extensionName}-status`);
        statusEl.removeClass('success error info').addClass(type).text(message);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusEl.fadeOut(300, () => {
                statusEl.removeClass('success error info').text('').show();
            });
        }, 5000);
    }

    /**
     * Show progress indicator
     * @param {string} message - Progress message
     * @param {number} percent - Progress percentage (0-100)
     */
    function showProgress(message, percent = -1) {
        const progressEl = $(`#${extensionName}-progress`);
        progressEl.find('.progress-text').text(message);
        
        if (percent >= 0) {
            progressEl.find('.progress-fill').css('width', `${percent}%`);
        } else {
            progressEl.find('.progress-fill').css('width', '100%');
        }
        
        progressEl.show();
    }

    /**
     * Hide progress indicator
     */
    function hideProgress() {
        $(`#${extensionName}-progress`).hide();
    }

    /**
     * Handle translate button click
     */
    async function handleTranslate() {
        const lorebookName = $(`#${extensionName}-lorebook-select`).val();
        const sourceLang = $(`#${extensionName}-source-lang`).val();
        const targetLang = $(`#${extensionName}-target-lang`).val();
        
        if (!lorebookName) {
            showStatus('Пожалуйста, выберите Lorebook', 'error');
            return;
        }
        
        if (sourceLang === targetLang) {
            showStatus('Исходный и целевой языки не должны совпадать', 'error');
            return;
        }
        
        const translateBtn = $(`#${extensionName}-translate-btn`);
        translateBtn.prop('disabled', true).text('⏳ Перевод...');
        
        try {
            showProgress('Начинаем перевод...', 0);
            
            const result = await translateLorebook(
                lorebookName,
                sourceLang,
                targetLang,
                (message) => showProgress(message)
            );
            
            hideProgress();
            showStatus(
                `✅ Переведено ${result.translatedCount} из ${result.totalEntries} записей`,
                'success'
            );
            
            // Refresh lorebook in UI if it's currently loaded
            if (typeof window.updateLorebookList === 'function') {
                window.updateLorebookList();
            }
            
        } catch (error) {
            hideProgress();
            showStatus(`❌ Ошибка: ${error.message}`, 'error');
            console.error(`[${extensionName}] Translation error:`, error);
        } finally {
            translateBtn.prop('disabled', false).text('🌐 Перевести Keywords');
        }
    }

    /**
     * Bind event handlers
     */
    function bindEvents() {
        $(document).on('click', `#${extensionName}-translate-btn`, handleTranslate);
        $(document).on('click', `#${extensionName}-refresh`, refreshLorebookList);
    }

    /**
     * Initialize extension
     */
    async function init() {
        console.log(`[${extensionName}] Initializing...`);
        
        // Wait for SillyTavern context
        if (typeof window.SillyTavern === 'undefined') {
            setTimeout(init, 500);
            return;
        }
        
        context = window.SillyTavern.getContext();
        
        // Inject UI
        injectUI();
        
        // Bind events
        bindEvents();
        
        // Load initial lorebook list
        await refreshLorebookList();
        
        console.log(`[${extensionName}] Initialized successfully!`);
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
