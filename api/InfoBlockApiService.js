// api/InfoBlockApiService.js

/**
 * Сервис отправки AI-запросов для инфоблоков.
 * Паттерн взят из NarrativeApiService (ST-Narrative-HUD).
 */

import { proxies, chat_completion_sources } from '../../../../openai.js';

const { getRequestHeaders, extensionSettings } = SillyTavern.getContext();

export const InfoBlockApiService = {

    /**
     * Ищет профиль подключения по имени в Connection Manager ST
     */
    getProfile(profileName) {
        const profiles = extensionSettings.connectionManager?.profiles || [];
        if (!profileName) return null;
        return profiles.find(p => p.name === profileName) || null;
    },

    /**
     * Маппит api-тип профиля в chat_completion_source ST
     */
    getChatCompletionSource(apiName) {
        if (apiName === 'google')     return chat_completion_sources.MAKERSUITE;
        if (apiName === 'claude')     return chat_completion_sources.CLAUDE;
        if (apiName === 'openrouter') return chat_completion_sources.OPENROUTER;
        return apiName; // 'openai', 'custom', и т.д.
    },

    /**
     * Собирает последние N сообщений из DOM чата
     * @param {number} count
     * @returns {Array<{role: string, content: string}>}
     */
    buildContextMessages(count = 10, targetMesId = null) {
        const messages = [];
        const mesElements = Array.from(document.querySelectorAll('.mes'));
        
        let sliced = [];
        
        // Если передан ID сообщения, ищем его в DOM
        if (targetMesId !== null && targetMesId !== undefined) {
            const targetIndex = mesElements.findIndex(el => el.getAttribute('mesid') == targetMesId);
            
            if (targetIndex !== -1) {
                // Если нашли, берем сообщения ДО него включительно
                const startIndex = Math.max(0, targetIndex - count + 1);
                sliced = mesElements.slice(startIndex, targetIndex + 1);
            } else {
                // Фолбэк, если почему-то не нашли
                sliced = mesElements.slice(-Math.min(count, 30));
            }
        } else {
            // Стандартное поведение (для новых сообщений)
            sliced = mesElements.slice(-Math.min(count, 30));
        }

        for (const mes of sliced) {
            const isUser = mes.getAttribute('is_user') === 'true';
            const textEl = mes.querySelector('.mes_text');
            if (!textEl) continue;

            const clone = textEl.cloneNode(true);
            clone.querySelectorAll('details, .sib-wrapper').forEach(el => el.remove());
            
            let text = clone.textContent.trim();
            text = text.replace(/\[(NHUD|HUD_CORE|HUD_PROG|HUD_CUSTOM)\][\s\S]*?\[\/\1\]/gi, '').trim();

            if (text) {
                messages.push({ role: isUser ? 'user' : 'assistant', content: text });
            }
        }

        return messages;
    },

    /**
     * Извлекает текст из ответа API (железобетонный парсер)
     */
    extractText(data) {
        // OpenAI / OpenRouter формат
        if (data.choices?.[0]?.message?.content) return data.choices[0].message.content.trim();
        // Google MakerSuite формат
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text.trim();
        // Claude / Anthropic формат
        if (data.content?.[0]?.text) return data.content[0].text.trim();
        // Фоллбэк на всякий случай
        if (typeof data.content === 'string') return data.content.trim();
        
        throw new Error("Не удалось извлечь текст из ответа API. Проверьте формат логов.");
    },

    /**
     * Основной метод: отправляет запрос блока и возвращает HTML-ответ
     *
     * @param {Object} block - объект блока из StateManager
     * @returns {Promise<string>} HTML от AI
     */
async generate(block, targetMesId) {
        const profile = this.getProfile(block.profile);
        if (!profile) throw new Error(`Профиль "${block.profile}" не найден`);

        const ccSource = this.getChatCompletionSource(profile.api);
        
        // Передаем targetMesId в сборщик контекста
        const contextMessages = this.buildContextMessages(block.contextMessages ?? 10, targetMesId);

        const messages = [
            { role: 'user', content: `[INSTRUCTION]\n${block.prompt}\n[/INSTRUCTION]` },
            ...contextMessages,
            { role: 'user', content: 'Заполни шаблон на основе сообщений выше. Верни только HTML.' }
        ];

        const generateData = {
            messages,
            temperature: block.temperature ?? 0.7,
            max_tokens:  block.maxTokens   ?? 800,
            stream: false,
            chat_completion_source: ccSource,
            use_sysprompt: false,
        };

        if (profile.model?.trim()) generateData.model = profile.model;
        if (profile.model_custom?.trim()) generateData.model_custom = profile.model_custom;

        const proxy = proxies.find(p => p.name === profile.proxy);
        if (proxy?.url) {
            generateData.reverse_proxy = proxy.url;
            generateData.proxy_password = proxy.password || '';
        }

        if (profile.api === 'custom' && profile['api-url']) {
            generateData.custom_url = profile['api-url'];
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
        
        // ЖЕСТКИЙ ПАРСИНГ ОШИБОК API
        if (data.error) {
            const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
            throw new Error(errMsg);
        }
        if (!data.choices && !data.candidates && !data.content) {
            throw new Error("Пустой ответ от API (возможно, ошибка модели)");
        }

        return this.extractText(data, ccSource);
    }
};
