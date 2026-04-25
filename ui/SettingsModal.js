// ui/SettingsModal.js

/**
 * Модальное окно управления инфоблоками.
 * Создаётся один раз, потом show/hide.
 */

import {
    getBlocks,
    getBlockById,
    addBlock,
    updateBlock,
    removeBlock,
    toggleBlock,
    generateId,
    getSettings,
    saveSettings,
} from '../core/StateManager.js';

// ─── Инициализация ────────────────────────────────────────────────────────────

export function initSettingsModal() {
    if ($('#sib-modal-overlay').length) return; // уже создан

    $('body').append(buildModalHTML());
    bindModalEvents();
}

// ─── Показ/скрытие ────────────────────────────────────────────────────────────

export function openSettingsModal() {
    initSettingsModal();
    renderBlockList();
    showView('list');
    $('#sib-modal-overlay').fadeIn(200);
}

export function closeSettingsModal() {
    $('#sib-modal-overlay').fadeOut(200);
}

// ─── HTML модального окна ────────────────────────────────────────────────────

function buildModalHTML() {
    return `
<div id="sib-modal-overlay" style="display:none;">
    <div id="sib-modal">
        <!-- Шапка -->
        <div id="sib-modal-header">
            <span id="sib-modal-title">⚡ Info Blocks</span>
            <button id="sib-modal-close" title="Закрыть">✕</button>
        </div>

        <!-- Вид: список блоков -->
        <div id="sib-view-list" class="sib-view">
            <div id="sib-block-list"></div>
            <div id="sib-list-footer">
                <button id="sib-btn-add" class="sib-btn sib-btn-primary">+ Добавить блок</button>
                <button id="sib-btn-global" class="sib-btn sib-btn-ghost">⚙ Настройки</button>
            </div>
        </div>

        <!-- Вид: редактор блока -->
        <div id="sib-view-editor" class="sib-view" style="display:none;">
            <div id="sib-editor-form">
                <div class="sib-field">
                    <label>Название блока</label>
                    <input type="text" id="sib-ed-name" placeholder="Мой блок" />
                </div>

                <div class="sib-field">
                    <label>Папка (Категория)</label>
                    <input type="text" id="sib-ed-folder" placeholder="Например: Выживание в лесу" list="sib-folder-list" />
                    <datalist id="sib-folder-list"></datalist>
                </div>

                <div class="sib-field">
                    <label>Профиль подключения ST</label>
                    <select id="sib-ed-profile">
                        <option value="">— выберите профиль —</option>
                    </select>
                </div>

                <div class="sib-field">
                    <label>ID Группы (опционально)</label>
                    <input type="text" id="sib-ed-group" placeholder="Например: 'group1'. Блоки с одинаковым ID группы полетят одним запросом." />
                </div>

                <div class="sib-field-row">
                    <div class="sib-field">
                        <label>Температура</label>
                        <input type="number" id="sib-ed-temperature" min="0" max="2" step="0.05" value="0.7" />
                    </div>
                    <div class="sib-field">
                        <label>Макс. токены</label>
                        <input type="number" id="sib-ed-maxtokens" min="100" max="8000" step="100" value="800" />
                    </div>
                    <div class="sib-field">
                        <label>Сообщений контекста</label>
                        <input type="number" id="sib-ed-context" min="1" max="30" step="1" value="6" />
                    </div>
                </div>

                <div class="sib-field sib-field-check">
                    <label>
                        <input type="checkbox" id="sib-ed-swipe" />
                        Запускать при свайпе
                    </label>
                </div>

                <div class="sib-field sib-field-prompt">
                    <label>Промпт + HTML-шаблон</label>
                    <div id="sib-prompt-hint">
                        Напишите инструкцию для AI и HTML-шаблон с <code>{{переменными}}</code>.
                        AI заполнит переменные и вернёт готовый HTML.
                    </div>
                    <textarea id="sib-ed-prompt" rows="14" placeholder="Ты анализируешь сцену...&#10;&#10;<div class=&quot;sib-block&quot;>&#10;  <span>{{mood}}</span>&#10;</div>"></textarea>
                </div>
            </div>

            <div id="sib-editor-footer">
                <button id="sib-btn-back" class="sib-btn sib-btn-ghost">← Назад</button>
                <div id="sib-editor-footer-right">
                    <button id="sib-btn-delete" class="sib-btn sib-btn-danger">Удалить</button>
                    <button id="sib-btn-save" class="sib-btn sib-btn-primary">Сохранить</button>
                </div>
            </div>
        </div>

        <!-- Вид: глобальные настройки -->
        <div id="sib-view-global" class="sib-view" style="display:none;">
            <div class="sib-field sib-field-check">
                <label><input type="checkbox" id="sib-g-collapse" /> Сворачивать блоки по умолчанию</label>
            </div>
            <div class="sib-field sib-field-check">
                <label><input type="checkbox" id="sib-g-showname" checked /> Показывать заголовок блока</label>
            </div>
            <div class="sib-field sib-field-check">
                <label><input type="checkbox" id="sib-g-animate" checked /> Анимация появления</label>
            </div>
            <div id="sib-global-footer">
                <button id="sib-btn-global-back" class="sib-btn sib-btn-ghost">← Назад</button>
                <button id="sib-btn-global-save" class="sib-btn sib-btn-primary">Сохранить</button>
            </div>
        </div>
    </div>
</div>`;
}

// ─── События ──────────────────────────────────────────────────────────────────

function bindModalEvents() {
    // Закрытие
    $('#sib-modal-close').on('click', closeSettingsModal);
    $('#sib-modal-overlay').on('click', function (e) {
        if ($(e.target).is('#sib-modal-overlay')) closeSettingsModal();
    });

    // Список → редактор (новый блок)
    $('#sib-btn-add').on('click', () => openEditor(null));

    // Список → глобальные настройки
    $('#sib-btn-global').on('click', () => {
        loadGlobalForm();
        showView('global');
    });

    // Редактор: назад
    $('#sib-btn-back').on('click', () => {
        renderBlockList();
        showView('list');
    });

    // Редактор: сохранить
    $('#sib-btn-save').on('click', saveEditor);

    // Редактор: удалить
    $('#sib-btn-delete').on('click', () => {
        const id = $('#sib-modal').data('editing-id');
        if (!id) return;
        if (!confirm('Удалить этот блок?')) return;
        removeBlock(id);
        renderBlockList();
        showView('list');
    });

    // Глобальные: назад
    $('#sib-btn-global-back').on('click', () => showView('list'));

    // Глобальные: сохранить
    $('#sib-btn-global-save').on('click', saveGlobalSettings);
}

// ─── Переключение видов ───────────────────────────────────────────────────────

function showView(name) {
    $('.sib-view').hide();
    $(`#sib-view-${name}`).show();

    const titles = { list: '⚡ Info Blocks', editor: '✏️ Редактор блока', global: '⚙ Глобальные настройки' };
    $('#sib-modal-title').text(titles[name] || '⚡ Info Blocks');
}

// ─── Список блоков ────────────────────────────────────────────────────────────

function renderBlockList() {
    const blocks = getBlocks();
    const list   = $('#sib-block-list').empty();

    if (!blocks.length) {
        list.append('<div class="sib-empty">Нет блоков. Нажми «+ Добавить блок»</div>');
        return;
    }

    // Группируем блоки по имени папки
    const grouped = {};
    for (const block of blocks) {
        const folderName = block.folder ? block.folder.trim() : 'БЕЗ ПАПКИ';
        if (!grouped[folderName]) grouped[folderName] = [];
        grouped[folderName].push(block);
    }

    // Отрисовываем папки
    for (const [folderName, folderBlocks] of Object.entries(grouped)) {
        
        // 1. Создаем кликабельный заголовок папки
        const folderHeader = $(`
            <div style="padding: 10px 8px 6px 4px; margin-top: 6px; border-bottom: 1px solid var(--SmartThemeBorderColor, #444); color: var(--SmartThemeQuoteColor, #6c8); font-weight: 700; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; transition: filter 0.2s;">
                <i class="fas fa-folder sib-folder-icon" style="opacity: 0.8; font-size: 1.1em; width: 16px; text-align: center;"></i> 
                <span style="flex: 1;">${folderName}</span>
                <span style="opacity: 0.6; font-size: 0.8em; font-family: monospace; font-weight: normal;">${folderBlocks.length} шт.</span>
                <i class="fas fa-chevron-right sib-folder-chevron" style="opacity: 0.5; font-size: 0.9em; transition: transform 0.2s;"></i>
            </div>
        `);

        // Эффект наведения
        folderHeader.hover(
            function() { $(this).css('filter', 'brightness(1.2)'); },
            function() { $(this).css('filter', 'brightness(1)'); }
        );

        // 2. Создаем контейнер для блоков внутри (СКРЫТ ПО УМОЛЧАНИЮ)
        const folderContent = $('<div class="sib-folder-content" style="display: none; padding-left: 10px; border-left: 2px solid rgba(255,255,255,0.05); margin-left: 10px; margin-top: 4px; padding-bottom: 4px;"></div>');

        // 3. Заполняем контейнер блоками
        for (const block of folderBlocks) {
            const item = $(`
                <div class="sib-block-item ${block.enabled ? 'sib-item-enabled' : ''}" data-id="${block.id}" style="margin-top: 6px;">
                    <div class="sib-item-left">
                        <label class="sib-toggle-wrap" title="${block.enabled ? 'Выключить' : 'Включить'}">
                            <input type="checkbox" class="sib-item-toggle" ${block.enabled ? 'checked' : ''} />
                            <span class="sib-toggle-slider"></span>
                        </label>
                        <span class="sib-item-name">${block.name}</span>
                    </div>
                    <div class="sib-item-right">
                        <span class="sib-item-profile">${block.profile || '—'}</span>
                        <button class="sib-item-edit sib-btn-icon" title="Редактировать">✏️</button>
                    </div>
                </div>
            `);

            item.find('.sib-item-toggle').on('change', function () {
                toggleBlock(block.id);
                item.toggleClass('sib-item-enabled', this.checked);
            });

            item.find('.sib-item-edit').on('click', () => openEditor(block.id));
            folderContent.append(item);
        }

        // 4. Логика сворачивания/разворачивания по клику
        folderHeader.on('click', function() {
            const isHidden = folderContent.is(':hidden');
            
            // Плавно показываем или скрываем содержимое
            folderContent.slideToggle(250);
            
            // Меняем иконку папки и поворачиваем стрелочку
            if (isHidden) {
                folderHeader.find('.sib-folder-icon').removeClass('fa-folder').addClass('fa-folder-open');
                folderHeader.find('.sib-folder-chevron').css('transform', 'rotate(90deg)');
            } else {
                folderHeader.find('.sib-folder-icon').removeClass('fa-folder-open').addClass('fa-folder');
                folderHeader.find('.sib-folder-chevron').css('transform', 'rotate(0deg)');
            }
        });

        // 5. Добавляем в общий список
        list.append(folderHeader);
        list.append(folderContent);
    }
}

// ─── Редактор блока ───────────────────────────────────────────────────────────

function openEditor(blockId) {
    const block = blockId ? getBlockById(blockId) : null;

    // Запоминаем какой блок редактируем (null = новый)
    $('#sib-modal').data('editing-id', blockId || null);

    // Заполняем форму
    $('#sib-ed-name').val(block?.name || '');
    $('#sib-ed-temperature').val(block?.temperature ?? 0.7);
    $('#sib-ed-maxtokens').val(block?.maxTokens ?? 800);
    $('#sib-ed-context').val(block?.contextMessages ?? 6);
    $('#sib-ed-swipe').prop('checked', block?.triggerOnSwipe ?? true);
    $('#sib-ed-prompt').val(block?.prompt || '');

    // Подгружаем имя папки
    $('#sib-ed-folder').val(block?.folder || '');
    // Собираем все существующие папки для автодополнения (чтобы не писать руками каждый раз)
    const existingFolders = [...new Set(getBlocks().map(b => b.folder).filter(Boolean))];
    const datalist = $('#sib-folder-list').empty();
    existingFolders.forEach(f => datalist.append(`<option value="${f}">`));

    // Заполняем список профилей
    fillProfileSelect('#sib-ed-profile', block?.profile || '');

    // Показываем кнопку "Удалить" только при редактировании существующего
    $('#sib-btn-delete').toggle(!!blockId);

    $('#sib-ed-group').val(block?.groupId || '');

    showView('editor');
}

function saveEditor() {
    const name        = $('#sib-ed-name').val().trim();
    const folder      = $('#sib-ed-folder').val().trim();
    const profile     = $('#sib-ed-profile').val();
    const temperature = parseFloat($('#sib-ed-temperature').val()) || 0.7;
    const maxTokens   = parseInt($('#sib-ed-maxtokens').val(), 10) || 800;
    const contextMessages = parseInt($('#sib-ed-context').val(), 10) || 6;
    const triggerOnSwipe  = $('#sib-ed-swipe').is(':checked');
    const prompt      = $('#sib-ed-prompt').val().trim();
    const groupId = $('#sib-ed-group').val().trim();

    if (!name) { alert('Введите название блока'); return; }
    if (!profile) { alert('Выберите профиль подключения'); return; }
    if (!prompt) { alert('Напишите промпт'); return; }

    const data = { name, folder, profile, groupId, temperature, maxTokens, contextMessages, triggerOnSwipe, prompt };

    const editingId = $('#sib-modal').data('editing-id');
    if (editingId) {
        updateBlock(editingId, data);
    } else {
        addBlock({ id: generateId(), enabled: true, ...data });
    }

    renderBlockList();
    showView('list');
}

// ─── Глобальные настройки ─────────────────────────────────────────────────────

function loadGlobalForm() {
    const d = getSettings().display || {};
    $('#sib-g-collapse').prop('checked',  d.collapseByDefault ?? false);
    $('#sib-g-showname').prop('checked',  d.showBlockName      ?? true);
    $('#sib-g-animate').prop('checked',   d.animateIn          ?? true);
}

function saveGlobalSettings() {
    const settings = getSettings();
    settings.display = {
        collapseByDefault: $('#sib-g-collapse').is(':checked'),
        showBlockName:      $('#sib-g-showname').is(':checked'),
        animateIn:          $('#sib-g-animate').is(':checked'),
    };
    saveSettings();
    showView('list');
}

// ─── Хелпер: заполнение select профилей ─────────────────────────────────────

function fillProfileSelect(selector, selectedValue) {
    const select   = $(selector).empty();
    const profiles = SillyTavern.getContext().extensionSettings?.connectionManager?.profiles || [];

    select.append('<option value="">— выберите профиль —</option>');
    for (const p of profiles) {
        const opt = $(`<option value="${p.name}">${p.name}</option>`);
        if (p.name === selectedValue) opt.prop('selected', true);
        select.append(opt);
    }
}
