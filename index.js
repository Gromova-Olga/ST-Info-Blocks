// index.js — ST-Info-Blocks (unified)

import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

import { extensionName, defaultSettings } from './constants/DefaultSettings.js';
import { getSettings, saveSettings } from './core/StateManager.js';
import { onInfoMessageReceived, onInfoMessageSwiped } from './core/InfoBlockRunner.js';
import {
    onImageMessageReceived,
    onImageMessageSwiped,
    updateInjectionPrompt,
    regenImageBlocksForMessage,
    injectRegenButton,
} from './core/ImageBlockRunner.js';
import { initSettingsModal, openSettingsModal } from './ui/SettingsModal.js';

const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

$(document).ready(async function () {
    try {
        console.log(`[${extensionName}] Инициализация...`);

        if (!extension_settings[extensionName]) {
            extension_settings[extensionName] = structuredClone(defaultSettings);
            saveSettings();
        }
        getSettings();
        initSettingsModal();

        // Панель расширений
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $('#extensions_settings2').append(settingsHtml);

        // Кнопка в топ-баре
        $('#top-settings-holder').append(`
            <div id="sib-top-button" class="drawer fas fa-layer-group" title="ST Info Blocks"
                 style="display:flex;align-items:center;justify-content:center;font-size:20px;opacity:0.7;cursor:pointer;"></div>
        `);

        // Кнопка в wand-меню
        $('#extensionsMenu').append(`
            <div id="sib-wand-container" class="extension_container interactable" tabindex="0">
                <div id="sib-wand-button" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem">
                    <i class="fas fa-layer-group"></i>
                    <span>ST Info Blocks</span>
                </div>
            </div>
        `);

        // Открытие модалки
        $(document).on('click', '#sib-open-modal-btn, #sib-top-button, #sib-wand-button', openSettingsModal);

        // ── Кнопка перегенерации промта (делегированный обработчик) ──
        $(document).on('click', '.sib-img-regen-btn', async function () {
            const btn = $(this);
            const mesId = parseInt(btn.attr('data-mesid'), 10);
            if (isNaN(mesId)) {
                console.error(`[${extensionName}] regen btn: не удалось прочитать mesid`, btn[0]);
                return;
            }

            btn.prop('disabled', true).text('⏳');
            try {
                await regenImageBlocksForMessage(mesId);
            } catch (err) {
                console.error(`[${extensionName}] Ошибка регена:`, err);
                // Кнопка пересоздастся через CHARACTER_MESSAGE_RENDERED после рендера,
                // если рендер провалился — восстанавливаем вручную
                btn.prop('disabled', false).text('🔄 Промт');
            }
        });

        // ── События генерации (injection-режим image-блоков) ──
        eventSource.on(event_types.GENERATION_STARTED, () => {
            updateInjectionPrompt();
        });

        // ── Входящие сообщения ────────────────────────────────
        eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
            const mesEl = $(`.mes[mesid="${mesId}"]`);
            if (mesEl.attr('is_user') === 'true') return;
            onInfoMessageReceived(mesId);
            onImageMessageReceived(mesId);
        });

        // ── Свайп ─────────────────────────────────────────────
        eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
            onInfoMessageSwiped(mesId);
            onImageMessageSwiped(mesId);
        });

        // ── Кнопки регена при загрузке / смене чата ──────────
        function injectRegenButtonsForAllPosts() {
            $('.mes[is_user="false"]').each(function () {
                const mesId = $(this).attr('mesid');
                if (mesId !== undefined) injectRegenButton(mesId);
            });
        }

        let observerDebounceTimer = null;
        const chatObserver = new MutationObserver(() => {
            clearTimeout(observerDebounceTimer);
            observerDebounceTimer = setTimeout(injectRegenButtonsForAllPosts, 300);
        });

        function attachChatObserver() {
            const chatContainer = document.getElementById('chat');
            if (chatContainer) {
                chatObserver.disconnect();
                chatObserver.observe(chatContainer, { childList: true, subtree: false });
            }
        }

        attachChatObserver();
        eventSource.on(event_types.CHAT_CHANGED, () => {
            setTimeout(attachChatObserver, 100);
            setTimeout(injectRegenButtonsForAllPosts, 1000);
        });

        // ── Кнопка регена при каждом рендере поста ────────────
        // Срабатывает при загрузке чата, свайпах, и после нашего updateMessageBlock
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
            injectRegenButton(mesId);
        });

        // Первичный injection
        updateInjectionPrompt();

        console.log(`[${extensionName}] ✅ Готово`);

    } catch (err) {
        console.error(`[${extensionName}] ❌ Ошибка инициализации:`, err);
    }
});
