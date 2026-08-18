// index.js — ST-Info-Blocks (unified)

import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

import { extensionName, defaultSettings } from './constants/DefaultSettings.js';
import { getSettings, saveSettings } from './core/StateManager.js';
import { onInfoMessageReceived, onInfoMessageSwiped, runAllInfoBlocks } from './core/InfoBlockRunner.js';
import {
    onImageMessageReceived,
    onImageMessageSwiped,
    updateInjectionPrompt,
    regenImageBlocksForMessage,
    injectRegenButton,
    runAllImageBlocks
} from './core/ImageBlockRunner.js';

// Удален старый импорт BlockRunner.js

import { initSettingsModal, openSettingsModal } from './ui/SettingsModal.js';

import { 
    getImageBlocks, toggleImageBlock, updateImageBlock, 
    getCharacters, getEnvironments, importData 
} from './core/StateManager.js';

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

        // ── Кнопки Экспорта/Импорта ──────────────────────────────────
        $('#extensions_settings2').append(`
            <div class="sib-export-import-container" style="display:flex; gap:10px; margin-top:15px; padding-top:15px; border-top:1px solid var(--SmartThemeBorderColor);">
                <button id="sib-export-btn" class="menu_button interactable" style="flex: 1;">
                    <i class="fas fa-file-export"></i> Экспорт (Backup)
                </button>
                <button id="sib-import-btn" class="menu_button interactable" style="flex: 1;">
                    <i class="fas fa-file-import"></i> Импорт
                </button>
                <input type="file" id="sib-import-input" accept=".json" style="display:none;" />
            </div>
        `);

        // Обработчик экспорта
        $('#sib-export-btn').on('click', () => {
            exportData();
        });

        // Обработчик импорта (вызывает скрытое окно выбора файла)
        $('#sib-import-btn').on('click', () => {
            if (confirm('Внимание! Импорт полностью перезапишет твои текущие инфоблоки, картинки и персонажей. Продолжить?')) {
                $('#sib-import-input').click();
            }
        });

        // Когда файл выбран
        $('#sib-import-input').on('change', async function() {
            const file = this.files[0];
            if (!file) return;
            
            try {
                await importData(file);
                $(this).val(''); // Очищаем input
                
                // Перезагружаем страницу, чтобы Таверна подхватила новые настройки везде
                setTimeout(() => location.reload(), 2000);
            } catch (e) {
                $(this).val('');
            }
        });

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

        // ── ПЛАВАЮЩАЯ КНОПКА И QUICK PANEL ─────────────────────────────
        $('body').append(`
            <div id="sib-floating-btn" title="ST Info Быстрые Настройки">
                <i class="fas fa-paint-brush"></i>
            </div>
            <div id="sib-quick-panel" style="display:none;">
                <div class="sib-qp-header">
                    <span>Быстрая настройка сцены</span>
                    <i class="fas fa-times" id="sib-qp-close" style="cursor:pointer;"></i>
                </div>
                <div id="sib-qp-content"></div>
            </div>
        `);

        // Логика перетаскивания кнопки
        let isDragging = false;
        let startX, startY, initialX, initialY;
        const floatBtn = document.getElementById('sib-floating-btn');

        floatBtn.addEventListener('mousedown', e => {
            isDragging = false;
            startX = e.clientX; startY = e.clientY;
            initialX = floatBtn.offsetLeft; initialY = floatBtn.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
            if (isDragging) {
                floatBtn.style.left = `${initialX + dx}px`;
                floatBtn.style.top = `${initialY + dy}px`;
                floatBtn.style.right = 'auto';
                floatBtn.style.bottom = 'auto';
            }
        }

        function onMouseUp(e) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!isDragging) {
                // Если не тащили, а кликнули — открываем/закрываем панель
                $('#sib-quick-panel').toggle();
                if ($('#sib-quick-panel').is(':visible')) renderQuickPanel();
            }
        }

        $('#sib-qp-close').on('click', () => $('#sib-quick-panel').hide());

        // Рендер внутренностей быстрой панели
        function renderQuickPanel() {
            const container = $('#sib-qp-content').empty();
            const blocks = getImageBlocks();
            if (!blocks.length) return container.append('<div style="padding:10px;text-align:center;opacity:0.5;">Нет блоков картинок</div>');

            blocks.forEach(b => {
                const blockEl = $(`
                    <div class="sib-qp-block">
                        <div class="sib-qp-block-header">
                            <label class="sib-toggle-wrap">
                                <input type="checkbox" class="sib-qp-toggle" ${b.enabled ? 'checked' : ''} />
                                <span class="sib-toggle-slider"></span>
                            </label>
                            <span class="sib-qp-block-name">${b.name}</span>
                            <i class="fas fa-chevron-down sib-qp-expand" style="cursor:pointer; opacity:0.5;"></i>
                        </div>
                        <div class="sib-qp-pickers" style="display:none;"></div>
                    </div>
                `);

                // Тогл блока
                blockEl.find('.sib-qp-toggle').on('change', function() {
                    toggleImageBlock(b.id);
                    renderQuickPanel(); // Перерисовываем, чтобы обновить состояние
                });

                // Пикеры (рендерим только если блок включен или его развернули)
                const pickersContainer = blockEl.find('.sib-qp-pickers');
                
                // Рендер персонажей для блока
                pickersContainer.append('<div class="sib-qp-section-title">Персонажи</div>');
                const chars = getCharacters();
                const charGrouped = {};
                chars.forEach(c => { const f = c.folder?.trim() || '—'; (charGrouped[f] = charGrouped[f] || []).push(c); });
                
                for (const [fName, fChars] of Object.entries(charGrouped)) {
                    const grp = $(`<div class="sib-qp-group"><div class="sib-qp-group-hdr">${fName}</div><div class="sib-qp-group-cnt" style="display:none;"></div></div>`);
                    fChars.forEach(c => {
                        const isChecked = b.characterIds?.includes(c.id);
                        const lbl = $(`<label class="sib-img-char-pick-row"><input type="checkbox" value="${c.id}" ${isChecked ? 'checked' : ''} /> <span>${c.name}</span></label>`);
                        lbl.find('input').on('change', function() {
                            let newIds = b.characterIds || [];
                            if (this.checked) newIds.push(c.id); else newIds = newIds.filter(id => id !== c.id);
                            updateImageBlock(b.id, { characterIds: newIds });
                            b.characterIds = newIds; // Обновляем локальный стейт для UI
                        });
                        grp.find('.sib-qp-group-cnt').append(lbl);
                    });
                    grp.find('.sib-qp-group-hdr').on('click', function() { $(this).next().slideToggle(150); });
                    pickersContainer.append(grp);
                }

                // Рендер локаций для блока
                pickersContainer.append('<div class="sib-qp-section-title" style="margin-top:10px;">Окружение</div>');
                const envs = getEnvironments();
                const envGrouped = {};
                envs.forEach(e => { const f = e.folder?.trim() || '—'; (envGrouped[f] = envGrouped[f] || []).push(e); });
                
                for (const [fName, fEnvs] of Object.entries(envGrouped)) {
                    const grp = $(`<div class="sib-qp-group"><div class="sib-qp-group-hdr">${fName}</div><div class="sib-qp-group-cnt" style="display:none;"></div></div>`);
                    fEnvs.forEach(e => {
                        const isChecked = b.environmentIds?.includes(e.id);
                        const lbl = $(`<label class="sib-img-char-pick-row"><input type="checkbox" value="${e.id}" ${isChecked ? 'checked' : ''} /> <span>${e.name}</span></label>`);
                        lbl.find('input').on('change', function() {
                            let newIds = b.environmentIds || [];
                            if (this.checked) newIds.push(e.id); else newIds = newIds.filter(id => id !== e.id);
                            updateImageBlock(b.id, { environmentIds: newIds });
                            b.environmentIds = newIds;
                        });
                        grp.find('.sib-qp-group-cnt').append(lbl);
                    });
                    grp.find('.sib-qp-group-hdr').on('click', function() { $(this).next().slideToggle(150); });
                    pickersContainer.append(grp);
                }

                blockEl.find('.sib-qp-expand').on('click', () => pickersContainer.slideToggle(150));
                container.append(blockEl);
            });
        }

        // ── Кнопка перегенерации промта ──────────────────────────────
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
                btn.prop('disabled', false).text('🔄 Промт');
            }
        });
        
        // ── Обработчик клика по молоточку (ручная генерация) ─────────
        $(document).on('click', '.sib-manual-gen-btn', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            const btn = $(this);
            // БРОНЕБОЙНЫЙ СПОСОБ: Ищем родительский блок сообщения и берем его ID
            const mesId = btn.closest('.mes').attr('mesid');
            
            console.log(`[ST-Info-Blocks] 🛠️ Клик по молоточку! mesId:`, mesId);

            if (!mesId) {
                console.warn(`[ST-Info-Blocks] 🛠️ Не удалось найти ID сообщения!`);
                return;
            }

            const icon = btn.find('i');
            icon.removeClass('fa-hammer').addClass('fa-spinner fa-spin');
            toastr.info(`Генерация для поста ${mesId}...`, 'ST-Info-Blocks', {timeOut: 2000});

            try {
                // Запускаем ТОЛЬКО актуальные раннеры с флагом force: true
                await Promise.allSettled([
                    runAllInfoBlocks(mesId, { isSwipe: false, force: true }),
                    runAllImageBlocks(mesId, { isSwipe: false, force: true })
                ]);
            } catch (err) {
                console.error(`[ST-Info-Blocks] Ошибка ручной генерации:`, err);
                toastr.error('Не удалось сгенерировать блоки вручную.');
            } finally {
                icon.removeClass('fa-spinner fa-spin').addClass('fa-hammer');
            }
        });

        // ── Функция создания кнопки молоточка ────────────────────────
        function injectManualGenButton(mesId) {
            const mesEl = $(`.mes[mesid="${mesId}"]`);
            if (!mesEl.length) return; // Убрали проверку на бота, теперь пускает и юзера
    
            // В Таверне кнопки управления сообщением лежат в .mes_buttons
            const btnContainer = mesEl.find('.mes_buttons');
            if (!btnContainer.length) return;
        
            // Защита от дублей кнопки
            if (btnContainer.find('.sib-manual-gen-btn').length) return;
        
            // Иконка молоточка
            const btn = $(`
                <div class="mes_button sib-manual-gen-btn interactable" 
                    title="Принудительно сгенерировать пропущенные инфоблоки" 
                    data-mesid="${mesId}">
                <i class="fas fa-hammer"></i>
            </div>
            `);
        
            // Добавляем в конец списка кнопок
            btnContainer.append(btn);
        }

        // ── События генерации (injection-режим image-блоков) ─────────
        eventSource.on(event_types.GENERATION_STARTED, () => {
            updateInjectionPrompt();
        });

        // ── Входящие сообщения ───────────────────────────────────────
        eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
            const mesEl = $(`.mes[mesid="${mesId}"]`);
            if (mesEl.attr('is_user') === 'true') return;
            onInfoMessageReceived(mesId);
            onImageMessageReceived(mesId);
        });

        // ── Свайп ────────────────────────────────────────────────────
        eventSource.on(event_types.MESSAGE_SWIPED, (mesId) => {
            onInfoMessageSwiped(mesId);
            onImageMessageSwiped(mesId);
        });

        // ── Кнопки регена при загрузке / смене чата ──────────────────
        function injectRegenButtonsForAllPosts() {
            $('.mes').each(function () {
                const mesId = $(this).attr('mesid');
                if (mesId !== undefined) {
                    // Кнопку регена (кружок) оставляем только для бота
                    if ($(this).attr('is_user') !== 'true') {
                        injectRegenButton(mesId);
                    }
                    // Молоточек вешаем на все сообщения
                    injectManualGenButton(mesId);
                }
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

        // ── Кнопка регена при каждом рендере поста ───────────────────
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
            injectRegenButton(mesId);
            injectManualGenButton(mesId);
        });

        // Дополнительно вешаем на рендер сообщений юзера
        if (event_types.USER_MESSAGE_RENDERED) {
            eventSource.on(event_types.USER_MESSAGE_RENDERED, (mesId) => {
                injectManualGenButton(mesId);
            });
        }

        // Первичный injection
        updateInjectionPrompt();

        console.log(`[${extensionName}] ✅ Готово`);

    } catch (err) {
        console.error(`[${extensionName}] ❌ Ошибка инициализации:`, err);
    }
});