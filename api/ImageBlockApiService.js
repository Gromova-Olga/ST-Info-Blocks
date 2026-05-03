// api/ImageBlockApiService.js

import { proxies, chat_completion_sources } from '../../../../openai.js';

const { getRequestHeaders, extensionSettings } = SillyTavern.getContext();

export const ImageBlockApiService = {

    getProfile(profileName) {
        const profiles = extensionSettings.connectionManager?.profiles || [];
        if (!profileName) return null;
        return profiles.find(p => p.name === profileName) || null;
    },

    getChatCompletionSource(apiName) {
        if (apiName === 'google')     return chat_completion_sources.MAKERSUITE;
        if (apiName === 'claude')     return chat_completion_sources.CLAUDE;
        if (apiName === 'openrouter') return chat_completion_sources.OPENROUTER;
        return apiName;
    },

    /**
     * Собирает последние N сообщений из DOM (без служебных блоков)
     */
    buildContextMessages(count = 10) {
        const messages = [];
        const mesElements = document.querySelectorAll('.mes');
        const sliced = Array.from(mesElements).slice(-Math.min(count, 30));

        for (const mes of sliced) {
            const isUser = mes.getAttribute('is_user') === 'true';
            const textEl = mes.querySelector('.mes_text');
            if (!textEl) continue;

            const clone = textEl.cloneNode(true);
            clone.querySelectorAll('details, .sib-wrapper, .sib-image-block-wrapper').forEach(el => el.remove());
            const text = clone.textContent.trim();
            if (text) {
                messages.push({ role: isUser ? 'user' : 'assistant', content: text });
            }
        }
        return messages;
    },

    extractText(data) {
        if (data.choices?.[0]?.message?.content) return data.choices[0].message.content.trim();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text.trim();
        if (data.content?.[0]?.text) return data.content[0].text.trim();
        if (typeof data.content === 'string') return data.content.trim();
        throw new Error('Не удалось извлечь текст из ответа API.');
    },

    /**
     * Основной метод: отправляет запрос и возвращает сгенерированный промт картинки (plain text)
     *
     * @param {Object} block  — объект блока из StateManager
     * @param {string} charactersStr — подготовленная строка персонажей
     * @returns {Promise<string>}
     */
    async generate(block, charactersStr) {
        const profile = this.getProfile(block.profile);
        if (!profile) throw new Error(`Профиль "${block.profile}" не найден`);

        const ccSource = this.getChatCompletionSource(profile.api);
        const contextMessages = this.buildContextMessages(block.contextMessages ?? 6);

        // 1. Берем инструкцию и подставляем персонажей, если там есть тег
        let instruction = (block.promptInstruction || '').replace(/\{\{characters\}\}/g, charactersStr);
        
        // 2. Берем HTML шаблон
        const htmlTemplate = block.htmlTemplate || '';

        // 3. Формируем единый промт из трех блоков
        const combinedPrompt = `[INSTRUCTION]
            ${instruction}

            [ACTIVE CHARACTERS]
            ${charactersStr}

            [EXPECTED OUTPUT HTML TEMPLATE]
            Follow this HTML structure exactly for your output:
            ${htmlTemplate}
            [/INSTRUCTION]`;

        // 4. Отправляем в сообщения
        const messages = [
            { role: 'user', content: combinedPrompt },
            ...contextMessages,
            { role: 'user', content: 'Generate the response following the exact instructions and the HTML template provided above.' }
        ];

        const generateData = {
            messages,

            temperature: block.temperature ?? 0.7,
            max_tokens:  block.maxTokens   ?? 400,
            stream: false,
            chat_completion_source: ccSource,
            use_sysprompt: false,
        };

        if (profile.model?.trim())        generateData.model        = profile.model;
        if (profile.model_custom?.trim()) generateData.model_custom = profile.model_custom;

        const proxy = proxies.find(p => p.name === profile.proxy);
        if (proxy?.url) {
            generateData.reverse_proxy = proxy.url;
            generateData.proxy_password = proxy.password || '';
        }

        if (profile.api === 'custom' && profile['api-url']) {
            generateData.custom_url    = profile['api-url'];
            generateData.reverse_proxy = profile['api-url'];
        }

        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(generateData),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText.substring(0, 100)}`);
        }

        const data = await response.json();

        if (data.error) {
            const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
            throw new Error(errMsg);
        }
        if (!data.choices && !data.candidates && !data.content) {
            throw new Error('Пустой ответ от API');
        }

        return this.extractText(data);
    }
};
