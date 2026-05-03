// index.js — ST-Info-Blocks (unified)

import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

import { extensionName, defaultSettings } from './constants/DefaultSettings.js';
import { getSettings, saveSettings } from './core/StateManager.js';
import { onInfoMessageReceived, onInfoMessageSwiped } from './core/InfoBlockRunner.js';
import { onImageMessageReceived, onImageMessageSwiped, updateInjectionPrompt } from './core/ImageBlockRunner.js';
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

        // Обработчики открытия
        $(document).on('click', '#sib-open-modal-btn, #sib-top-button, #sib-wand-button', openSettingsModal);

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

        // Первичный injection
        updateInjectionPrompt();

        console.log(`[${extensionName}] ✅ Готово`);

    } catch (err) {
        console.error(`[${extensionName}] ❌ Ошибка инициализации:`, err);
    }
});
