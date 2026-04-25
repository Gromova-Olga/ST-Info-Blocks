// index.js — ST Info Blocks

import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

import { extensionName, defaultSettings } from './constants/DefaultSettings.js';
import { getSettings, saveSettings } from './core/StateManager.js';
import { onMessageReceived, onMessageSwiped } from './core/BlockRunner.js';
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

        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $('#extensions_settings2').append(settingsHtml);

        // ПУНКТ 4: Добавляем кнопку в верхний бар таверны
        // Используем классы ST напрямую, чтобы иконка не выглядела как "обглодыш"
        const topButtonHtml = `
            <div id="sib-top-button" class="drawer fas fa-layer-group" title="ST Info Blocks" style="display: flex; align-items: center; justify-content: center; font-size: 20px; opacity: 0.7; cursor: pointer;"></div>
        `;
        $('#top-settings-holder').append(topButtonHtml);

        // Обработчики кликов (и в меню расширений, и в топ-баре)
        $(document).on('click', '#sib-open-modal-btn, #sib-top-button', openSettingsModal);

        eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
            const mesEl = $(`.mes[mesid="${mesId}"]`);
            if (mesEl.attr('is_user') === 'true') return;
            onMessageReceived(mesId);
        });

        eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
            onMessageSwiped(mesId);
        });

        console.log(`[${extensionName}] ✅ Готово`);

    } catch (err) {
        console.error(`[${extensionName}] ❌ Ошибка инициализации:`, err);
    }
});