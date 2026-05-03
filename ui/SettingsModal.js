// ui/SettingsModal.js — ST-Info-Blocks (unified)

import {
    getInfoBlocks, getInfoBlockById, addInfoBlock, updateInfoBlock, removeInfoBlock, toggleInfoBlock,
    getImageBlocks, getImageBlockById, addImageBlock, updateImageBlock, removeImageBlock, toggleImageBlock,
    getCharacters, getCharacterById, addCharacter, updateCharacter, removeCharacter,
    getEnvironments, getEnvironmentById, addEnvironment, updateEnvironment, removeEnvironment,
    getSettings, saveSettings, generateId,
} from '../core/StateManager.js';

let activeTab = 'info';

// State для аутфитов внутри модалки редактора персонажа
let currentOutfits = [];
let currentActiveOutfitId = null;

export function initSettingsModal() {
    if ($('#sib-modal-overlay').length) return;
    $('body').append(buildModalHTML());
    bindModalEvents();
}

export function openSettingsModal() {
    initSettingsModal();
    switchTab(activeTab);
    $('#sib-modal-overlay').fadeIn(200);
}

export function closeSettingsModal() {
    $('#sib-modal-overlay').fadeOut(200);
}

function buildModalHTML() {
    return `
<div id="sib-modal-overlay" style="display:none;">
    <div id="sib-modal">

        <div id="sib-modal-header">
            <span id="sib-modal-title">⚡ ST Info Blocks</span>
            <button id="sib-modal-close" title="Закрыть">✕</button>
        </div>

        <div id="sib-tabs">
            <button class="sib-tab sib-tab-active" data-tab="info">⚡ Инфоблоки</button>
            <button class="sib-tab" data-tab="image">🖼️ Картинки</button>
            <button class="sib-tab" data-tab="global">⚙ Настройки</button>
        </div>

        <!-- ВКЛ. ИНФОБЛОКИ -->
        <div id="sib-tab-info" class="sib-tab-panel">
            <div id="sib-view-info-list" class="sib-view">
                <div id="sib-info-block-list" class="sib-block-list-scroll"></div>
                <div class="sib-list-footer">
                    <button id="sib-info-btn-add" class="sib-btn sib-btn-primary">+ Добавить блок</button>
                </div>
            </div>

            <div id="sib-view-info-editor" class="sib-view" style="display:none;">
                <div id="sib-info-editor-form" class="sib-editor-form">
                    <div class="sib-field">
                        <label>Название блока</label>
                        <input type="text" id="sib-info-ed-name" placeholder="Мой блок" />
                    </div>
                    <div class="sib-field">
                        <label>Папка (категория)</label>
                        <input type="text" id="sib-info-ed-folder" placeholder="Например: Выживание" list="sib-info-folder-list" />
                        <datalist id="sib-info-folder-list"></datalist>
                    </div>
                    <div class="sib-field">
                        <label>Профиль подключения ST</label>
                        <select id="sib-info-ed-profile"><option value="">— выберите профиль —</option></select>
                    </div>
                    <div class="sib-field">
                        <label>ID группы (опционально)</label>
                        <input type="text" id="sib-info-ed-group" placeholder="Блоки с одинаковым ID идут одним запросом" />
                    </div>
                    <div class="sib-field-row">
                        <div class="sib-field"><label>Температура</label><input type="number" id="sib-info-ed-temperature" min="0" max="2" step="0.05" value="0.7" /></div>
                        <div class="sib-field"><label>Макс. токены</label><input type="number" id="sib-info-ed-maxtokens" min="100" max="8000" step="100" value="800" /></div>
                        <div class="sib-field"><label>Контекст (сообщ.)</label><input type="number" id="sib-info-ed-context" min="1" max="30" step="1" value="6" /></div>
                    </div>
                    <div class="sib-field sib-field-check">
                        <label><input type="checkbox" id="sib-info-ed-swipe" /> Запускать при свайпе</label>
                    </div>
                    <div class="sib-field sib-field-prompt">
                        <label>Промпт + HTML-шаблон</label>
                        <textarea id="sib-info-ed-prompt" rows="12"></textarea>
                    </div>
                </div>
                <div class="sib-editor-footer">
                    <button id="sib-info-btn-back" class="sib-btn sib-btn-ghost">← Назад</button>
                    <div class="sib-editor-footer-right">
                        <button id="sib-info-btn-delete" class="sib-btn sib-btn-danger">Удалить</button>
                        <button id="sib-info-btn-save" class="sib-btn sib-btn-primary">Сохранить</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- ВКЛ. КАРТИНКИ -->
        <div id="sib-tab-image" class="sib-tab-panel" style="display:none;">

            <!-- Список image-блоков -->
            <div id="sib-view-image-list" class="sib-view">
                <div id="sib-image-block-list" class="sib-block-list-scroll"></div>
                <div class="sib-list-footer">
                    <button id="sib-image-btn-add" class="sib-btn sib-btn-primary">+ Добавить блок</button>
                    <button id="sib-image-btn-chars" class="sib-btn sib-btn-ghost">👥 Персонажи</button>
                    <button id="sib-image-btn-envs" class="sib-btn sib-btn-ghost">🏡 Окружение</button>
                </div>
            </div>

            <!-- Редактор image-блока -->
            <div id="sib-view-image-editor" class="sib-view" style="display:none;">
                <div id="sib-image-editor-form" class="sib-editor-form">
                    <div class="sib-field"><label>Название блока</label><input type="text" id="sib-img-ed-name" /></div>
                    <div class="sib-field">
                        <label>Профиль подключения ST</label>
                        <select id="sib-img-ed-profile"><option value="">— выберите профиль —</option></select>
                    </div>
                    <div class="sib-field">
                        <label>Режим</label>
                        <select id="sib-img-ed-mode">
                            <option value="request">Request — отдельный запрос после ответа</option>
                            <option value="inject">Inject — вставить в системный промт перед генерацией</option>
                        </select>
                    </div>
                    <div class="sib-field-row">
                        <div class="sib-field"><label>Температура</label><input type="number" id="sib-img-ed-temperature" value="0.7" /></div>
                        <div class="sib-field"><label>Макс. токены</label><input type="number" id="sib-img-ed-maxtokens" value="400" /></div>
                        <div class="sib-field"><label>Контекст</label><input type="number" id="sib-img-ed-context" value="6" /></div>
                    </div>
                    <div class="sib-field sib-field-check">
                        <label><input type="checkbox" id="sib-img-ed-swipe" /> Запускать при свайпе</label>
                    </div>
                    
                    <!-- Пикеры для инжектов -->
                    <div class="sib-field">
                        <label>Персонажи в сцене</label>
                        <div id="sib-img-char-picker" class="sib-img-char-picker"></div>
                    </div>
                    <div class="sib-field">
                        <label>Локации (Окружение) в сцене</label>
                        <div id="sib-img-env-picker" class="sib-img-char-picker"></div>
                    </div>

                    <!-- Инструкция -->
                    <div class="sib-field sib-field-prompt" id="sib-img-instruction-wrap">
                        <label>Инструкция для AI (request-режим)</label>
                        <div class="sib-prompt-hint">Поддерживает <code>{{characters}}</code> и <code>{{environments}}</code>.</div>
                        <textarea id="sib-img-ed-instruction" rows="8"></textarea>
                    </div>
                    <div class="sib-field sib-field-prompt" id="sib-img-template-wrap">
                        <label>HTML-шаблон вывода (request-режим)</label>
                        <textarea id="sib-img-ed-template" rows="6"></textarea>
                    </div>
                    <div class="sib-field sib-field-prompt" id="sib-img-injection-wrap" style="display:none;">
                        <label>Текст инъекции (inject-режим)</label>
                        <textarea id="sib-img-ed-injection" rows="8"></textarea>
                    </div>
                </div>
                <div class="sib-editor-footer">
                    <button id="sib-image-btn-back" class="sib-btn sib-btn-ghost">← Назад</button>
                    <div class="sib-editor-footer-right">
                        <button id="sib-image-btn-delete" class="sib-btn sib-btn-danger">Удалить</button>
                        <button id="sib-image-btn-save" class="sib-btn sib-btn-primary">Сохранить</button>
                    </div>
                </div>
            </div>

            <!-- Менеджер персонажей -->
            <div id="sib-view-image-chars" class="sib-view" style="display:none;">
                <div id="sib-char-list" class="sib-block-list-scroll"></div>
                <div class="sib-list-footer">
                    <button id="sib-char-btn-add" class="sib-btn sib-btn-primary">+ Добавить персонажа</button>
                    <button id="sib-char-btn-back-list" class="sib-btn sib-btn-ghost">← Назад</button>
                </div>
            </div>

            <!-- Редактор персонажа -->
            <div id="sib-view-image-char-editor" class="sib-view" style="display:none;">
                <div id="sib-char-editor-form" class="sib-editor-form">
                    <div class="sib-field"><label>Имя персонажа</label><input type="text" id="sib-char-ed-name" /></div>
                    <div class="sib-field"><label>Внешность</label><textarea id="sib-char-ed-appearance" rows="3"></textarea></div>
                    
                    <!-- Динамические аутфиты -->
                    <div class="sib-field" style="margin-top:10px;">
                        <label>Аутфиты (Гардероб)</label>
                        <div id="sib-char-outfits-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                        <button id="sib-char-btn-add-outfit" class="sib-btn sib-btn-ghost" style="margin-top:5px; align-self:flex-start;">+ Добавить аутфит</button>
                    </div>
                </div>
                <div class="sib-editor-footer">
                    <button id="sib-char-btn-back" class="sib-btn sib-btn-ghost">← Назад</button>
                    <div class="sib-editor-footer-right">
                        <button id="sib-char-btn-delete" class="sib-btn sib-btn-danger">Удалить</button>
                        <button id="sib-char-btn-save" class="sib-btn sib-btn-primary">Сохранить</button>
                    </div>
                </div>
            </div>

            <!-- Менеджер окружения -->
            <div id="sib-view-image-envs" class="sib-view" style="display:none;">
                <div id="sib-env-list" class="sib-block-list-scroll"></div>
                <div class="sib-list-footer">
                    <button id="sib-env-btn-add" class="sib-btn sib-btn-primary">+ Добавить локацию</button>
                    <button id="sib-env-btn-back-list" class="sib-btn sib-btn-ghost">← Назад</button>
                </div>
            </div>

            <!-- Редактор окружения -->
            <div id="sib-view-image-env-editor" class="sib-view" style="display:none;">
                <div id="sib-env-editor-form" class="sib-editor-form">
                    <div class="sib-field"><label>Название локации</label><input type="text" id="sib-env-ed-name" /></div>
                    <div class="sib-field"><label>Описание</label><textarea id="sib-env-ed-desc" rows="4"></textarea></div>
                </div>
                <div class="sib-editor-footer">
                    <button id="sib-env-btn-back" class="sib-btn sib-btn-ghost">← Назад</button>
                    <div class="sib-editor-footer-right">
                        <button id="sib-env-btn-delete" class="sib-btn sib-btn-danger">Удалить</button>
                        <button id="sib-env-btn-save" class="sib-btn sib-btn-primary">Сохранить</button>
                    </div>
                </div>
            </div>

        </div>

        <!-- ВКЛ. ОБЩИЕ НАСТРОЙКИ -->
        <div id="sib-tab-global" class="sib-tab-panel" style="display:none;">
            <div class="sib-view sib-global-form">
                <div style="padding:14px; display:flex; flex-direction:column; gap:12px; flex:1;">
                    <div class="sib-field sib-field-check"><label><input type="checkbox" id="sib-g-collapse" /> Сворачивать блоки по умолчанию</label></div>
                    <div class="sib-field sib-field-check"><label><input type="checkbox" id="sib-g-showname" /> Показывать заголовок блока</label></div>
                    <div class="sib-field sib-field-check"><label><input type="checkbox" id="sib-g-animate" /> Анимация появления</label></div>
                </div>
                <div class="sib-editor-footer">
                    <div></div>
                    <button id="sib-btn-global-save" class="sib-btn sib-btn-primary">Сохранить</button>
                </div>
            </div>
        </div>

    </div>
</div>`;
}

function bindModalEvents() {
    $('#sib-modal-close').on('click', closeSettingsModal);
    $('#sib-modal-overlay').on('click', e => { if ($(e.target).is('#sib-modal-overlay')) closeSettingsModal(); });
    $(document).on('click', '.sib-tab', function () { switchTab($(this).data('tab')); });

    // Инфоблоки
    $('#sib-info-btn-add').on('click', () => openInfoEditor(null));
    $('#sib-info-btn-back').on('click', () => { renderInfoBlockList(); showInfoView('list'); });
    $('#sib-info-btn-save').on('click', saveInfoEditor);
    $('#sib-info-btn-delete').on('click', () => {
        const id = $('#sib-modal').data('editing-info-id');
        if (!id || !confirm('Удалить этот блок?')) return;
        removeInfoBlock(id); renderInfoBlockList(); showInfoView('list');
    });

    // Картинки
    $('#sib-image-btn-add').on('click', () => openImageEditor(null));
    $('#sib-image-btn-back').on('click', () => { renderImageBlockList(); showImageView('list'); });
    $('#sib-image-btn-save').on('click', saveImageEditor);
    $('#sib-image-btn-delete').on('click', () => {
        const id = $('#sib-modal').data('editing-image-id');
        if (!id || !confirm('Удалить этот блок?')) return;
        removeImageBlock(id); renderImageBlockList(); showImageView('list');
    });
    $('#sib-img-ed-mode').on('change', syncImageModeFields);

    // Персонажи
    $('#sib-image-btn-chars').on('click', () => { renderCharList(); showImageView('chars'); });
    $('#sib-char-btn-back-list').on('click', () => { renderImageBlockList(); showImageView('list'); });
    $('#sib-char-btn-add').on('click', () => openCharEditor(null));
    $('#sib-char-btn-back').on('click', () => { renderCharList(); showImageView('chars'); });
    $('#sib-char-btn-save').on('click', saveCharEditor);
    $('#sib-char-btn-delete').on('click', () => {
        const id = $('#sib-modal').data('editing-char-id');
        if (!id || !confirm('Удалить персонажа?')) return;
        removeCharacter(id); renderCharList(); showImageView('chars');
    });

    // Добавление аутфита
    $('#sib-char-btn-add-outfit').on('click', () => {
        const newId = generateId('out');
        currentOutfits.push({ id: newId, name: '', value: '' });
        if (!currentActiveOutfitId) currentActiveOutfitId = newId;
        renderOutfits();
    });

    // Окружение
    $('#sib-image-btn-envs').on('click', () => { renderEnvList(); showImageView('envs'); });
    $('#sib-env-btn-back-list').on('click', () => { renderImageBlockList(); showImageView('list'); });
    $('#sib-env-btn-add').on('click', () => openEnvEditor(null));
    $('#sib-env-btn-back').on('click', () => { renderEnvList(); showImageView('envs'); });
    $('#sib-env-btn-save').on('click', saveEnvEditor);
    $('#sib-env-btn-delete').on('click', () => {
        const id = $('#sib-modal').data('editing-env-id');
        if (!id || !confirm('Удалить локацию?')) return;
        removeEnvironment(id); renderEnvList(); showImageView('envs');
    });

    // Global
    $('#sib-btn-global-save').on('click', saveGlobalSettings);
}

function switchTab(tab) {
    activeTab = tab;
    $('.sib-tab').removeClass('sib-tab-active');
    $(`.sib-tab[data-tab="${tab}"]`).addClass('sib-tab-active');
    $('.sib-tab-panel').hide();
    $(`#sib-tab-${tab}`).show();
    if (tab === 'info') { renderInfoBlockList(); showInfoView('list'); }
    else if (tab === 'image') { renderImageBlockList(); showImageView('list'); }
    else if (tab === 'global') { loadGlobalForm(); }
}

// ── INFO BLOCKS ──────────────────────────────────────────────
function showInfoView(name) { $('#sib-tab-info .sib-view').hide(); $(`#sib-view-info-${name}`).show(); }
function renderInfoBlockList() { /* Аналогично оригиналу */ 
    const blocks = getInfoBlocks(); const list = $('#sib-info-block-list').empty();
    if (!blocks.length) return list.append('<div class="sib-empty">Нет блоков</div>');
    const grouped = {}; blocks.forEach(b => { const f = b.folder?.trim() || '—'; (grouped[f] = grouped[f] || []).push(b); });
    for (const [fName, fBlocks] of Object.entries(grouped)) list.append(buildFolderSection(fName, fBlocks, 'info'));
}
function openInfoEditor(blockId) {
    const b = blockId ? getInfoBlockById(blockId) : null;
    $('#sib-modal').data('editing-info-id', blockId || null);
    $('#sib-info-ed-name').val(b?.name || ''); $('#sib-info-ed-folder').val(b?.folder || '');
    $('#sib-info-ed-group').val(b?.groupId || ''); $('#sib-info-ed-temperature').val(b?.temperature ?? 0.7);
    $('#sib-info-ed-maxtokens').val(b?.maxTokens ?? 800); $('#sib-info-ed-context').val(b?.contextMessages ?? 6);
    $('#sib-info-ed-swipe').prop('checked', b?.triggerOnSwipe ?? true); $('#sib-info-ed-prompt').val(b?.prompt || '');
    fillProfileSelect('#sib-info-ed-profile', b?.profile || '');
    $('#sib-info-btn-delete').toggle(!!blockId); showInfoView('editor');
}
function saveInfoEditor() {
    const data = {
        name: $('#sib-info-ed-name').val().trim(), folder: $('#sib-info-ed-folder').val().trim(),
        profile: $('#sib-info-ed-profile').val(), groupId: $('#sib-info-ed-group').val().trim(),
        temperature: parseFloat($('#sib-info-ed-temperature').val()) || 0.7,
        maxTokens: parseInt($('#sib-info-ed-maxtokens').val(), 10) || 800,
        contextMessages: parseInt($('#sib-info-ed-context').val(), 10) || 6,
        triggerOnSwipe: $('#sib-info-ed-swipe').is(':checked'), prompt: $('#sib-info-ed-prompt').val().trim()
    };
    if (!data.name || !data.profile || !data.prompt) return alert('Заполните обязательные поля');
    const id = $('#sib-modal').data('editing-info-id');
    if (id) updateInfoBlock(id, data); else addInfoBlock({ id: generateId('sib-info'), enabled: true, ...data });
    renderInfoBlockList(); showInfoView('list');
}

// ── IMAGE BLOCKS ─────────────────────────────────────────────
function showImageView(name) { $('#sib-tab-image .sib-view').hide(); $(`#sib-view-image-${name}`).show(); }
function renderImageBlockList() {
    const blocks = getImageBlocks(); const list = $('#sib-image-block-list').empty();
    if (!blocks.length) return list.append('<div class="sib-empty">Нет блоков</div>');
    blocks.forEach(b => {
        const item = $(`<div class="sib-block-item ${b.enabled ? 'sib-item-enabled' : ''}">
            <div class="sib-item-left">
                <label class="sib-toggle-wrap"><input type="checkbox" class="sib-img-toggle" ${b.enabled ? 'checked' : ''} /><span class="sib-toggle-slider"></span></label>
                <div><div class="sib-item-name">${b.name}</div><div class="sib-item-profile">${b.mode} · ${b.profile || '—'}</div></div>
            </div>
            <div class="sib-item-right"><button class="sib-img-edit sib-btn-icon">✏️</button></div>
        </div>`);
        item.find('.sib-img-toggle').on('change', function () { toggleImageBlock(b.id); item.toggleClass('sib-item-enabled', this.checked); });
        item.find('.sib-img-edit').on('click', () => openImageEditor(b.id));
        list.append(item);
    });
}
function openImageEditor(blockId) {
    const b = blockId ? getImageBlockById(blockId) : null;
    $('#sib-modal').data('editing-image-id', blockId || null);
    $('#sib-img-ed-name').val(b?.name || ''); $('#sib-img-ed-mode').val(b?.mode || 'request');
    $('#sib-img-ed-temperature').val(b?.temperature ?? 0.7); $('#sib-img-ed-maxtokens').val(b?.maxTokens ?? 400);
    $('#sib-img-ed-context').val(b?.contextMessages ?? 6); $('#sib-img-ed-swipe').prop('checked', b?.triggerOnSwipe ?? true);
    $('#sib-img-ed-instruction').val(b?.promptInstruction || ''); $('#sib-img-ed-template').val(b?.htmlTemplate || '');
    $('#sib-img-ed-injection').val(b?.injectionTemplate || '');
    fillProfileSelect('#sib-img-ed-profile', b?.profile || '');
    renderCharPicker(b?.characterIds || []);
    renderEnvPicker(b?.environmentIds || []);
    syncImageModeFields();
    $('#sib-image-btn-delete').toggle(!!blockId); showImageView('editor');
}
function syncImageModeFields() {
    const mode = $('#sib-img-ed-mode').val();
    if (mode === 'inject') { $('#sib-img-instruction-wrap, #sib-img-template-wrap').hide(); $('#sib-img-injection-wrap').show(); }
    else { $('#sib-img-instruction-wrap, #sib-img-template-wrap').show(); $('#sib-img-injection-wrap').hide(); }
}
function saveImageEditor() {
    const characterIds = []; $('#sib-img-char-picker input:checked').each(function() { characterIds.push($(this).val()); });
    const environmentIds = []; $('#sib-img-env-picker input:checked').each(function() { environmentIds.push($(this).val()); });
    
    const data = {
        name: $('#sib-img-ed-name').val().trim(), profile: $('#sib-img-ed-profile').val(), mode: $('#sib-img-ed-mode').val(),
        temperature: parseFloat($('#sib-img-ed-temperature').val()) || 0.7, maxTokens: parseInt($('#sib-img-ed-maxtokens').val(), 10) || 400,
        contextMessages: parseInt($('#sib-img-ed-context').val(), 10) || 6, triggerOnSwipe: $('#sib-img-ed-swipe').is(':checked'),
        promptInstruction: $('#sib-img-ed-instruction').val().trim(), htmlTemplate: $('#sib-img-ed-template').val().trim(),
        injectionTemplate: $('#sib-img-ed-injection').val().trim(), characterIds, environmentIds
    };
    if (!data.name || !data.profile) return alert('Заполните обязательные поля');
    const id = $('#sib-modal').data('editing-image-id');
    if (id) updateImageBlock(id, data); else addImageBlock({ id: generateId('sib-img'), enabled: true, ...data });
    renderImageBlockList(); showImageView('list');
}

// ── CHARACTERS & OUTFITS ─────────────────────────────────────
function renderCharList() {
    const chars = getCharacters(); const list = $('#sib-char-list').empty();
    if (!chars.length) return list.append('<div class="sib-empty">Нет персонажей.</div>');
    chars.forEach(c => {
        const item = $(`<div class="sib-block-item">
            <div class="sib-item-left"><div><div class="sib-item-name">${c.name}</div><div class="sib-item-profile">${c.appearance || '—'}</div></div></div>
            <div class="sib-item-right"><button class="sib-char-edit sib-btn-icon">✏️</button></div>
        </div>`);
        item.find('.sib-char-edit').on('click', () => openCharEditor(c.id));
        list.append(item);
    });
}
function renderOutfits() {
    const container = $('#sib-char-outfits-container').empty();
    if (!currentOutfits.length) return container.append('<div style="opacity:0.5; font-size:0.85em;">Гардероб пуст.</div>');
    currentOutfits.forEach(o => {
        const isChecked = o.id === currentActiveOutfitId ? 'checked' : '';
        const row = $(`
            <div style="display:flex; gap:10px; align-items:flex-start; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <input type="radio" name="char_active_outfit" value="${o.id}" ${isChecked} title="Выбрать активным" style="margin-top:8px; cursor:pointer; width:16px; height:16px; accent-color:var(--SmartThemeQuoteColor, #6c8);">
                <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
                    <input type="text" class="sib-outfit-name" value="${o.name}" placeholder="Название (напр. Тактика)" style="background:rgba(0,0,0,0.3); border:1px solid var(--SmartThemeBorderColor, #444); border-radius:4px; padding:6px 10px; font-size:0.9em; width:100%; box-sizing:border-box;">
                    <textarea class="sib-outfit-val" rows="2" placeholder="Одежда..." style="background:rgba(0,0,0,0.3); border:1px solid var(--SmartThemeBorderColor, #444); border-radius:4px; padding:6px 10px; resize:vertical; font-size:0.85em; width:100%; box-sizing:border-box;">${o.value}</textarea>
                </div>
                <button type="button" class="sib-btn-icon sib-btn-del-outfit" title="Удалить" style="color:#e74c3c; margin-top:4px;">✕</button>
            </div>
        `);
        row.find('.sib-outfit-name').on('input', function() { o.name = $(this).val(); });
        row.find('.sib-outfit-val').on('input', function() { o.value = $(this).val(); });
        row.find('.sib-btn-del-outfit').on('click', function() {
            currentOutfits = currentOutfits.filter(x => x.id !== o.id);
            if (currentActiveOutfitId === o.id) currentActiveOutfitId = currentOutfits[0]?.id || null;
            renderOutfits();
        });
        container.append(row);
    });
    $('input[name="char_active_outfit"]').on('change', function() { currentActiveOutfitId = $(this).val(); });
}
function openCharEditor(charId) {
    const c = charId ? getCharacterById(charId) : null;
    $('#sib-modal').data('editing-char-id', charId || null);
    $('#sib-char-ed-name').val(c?.name || ''); $('#sib-char-ed-appearance').val(c?.appearance || '');
    
    currentOutfits = c?.outfits ? JSON.parse(JSON.stringify(c.outfits)) : [];
    if (!currentOutfits.length && c?.outfit) currentOutfits.push({ id: generateId('out'), name: 'Базовый', value: c.outfit });
    currentActiveOutfitId = c?.activeOutfitId || (currentOutfits.length ? currentOutfits[0].id : null);
    
    renderOutfits();
    $('#sib-char-btn-delete').toggle(!!charId); showImageView('char-editor');
}
function saveCharEditor() {
    const name = $('#sib-char-ed-name').val().trim();
    const appearance = $('#sib-char-ed-appearance').val().trim();
    if (!name) return alert('Введите имя персонажа');
    
    const id = $('#sib-modal').data('editing-char-id');
    const data = { name, appearance, outfits: currentOutfits, activeOutfitId: currentActiveOutfitId };
    if (id) updateCharacter(id, data); else addCharacter({ id: generateId('sib-char'), ...data });
    renderCharList(); showImageView('chars');
}

// ── ENVIRONMENTS ─────────────────────────────────────────────
function renderEnvList() {
    const envs = getEnvironments(); const list = $('#sib-env-list').empty();
    if (!envs.length) return list.append('<div class="sib-empty">Нет локаций.</div>');
    envs.forEach(e => {
        const item = $(`<div class="sib-block-item">
            <div class="sib-item-left"><div><div class="sib-item-name">${e.name}</div><div class="sib-item-profile">${e.description || '—'}</div></div></div>
            <div class="sib-item-right"><button class="sib-env-edit sib-btn-icon">✏️</button></div>
        </div>`);
        item.find('.sib-env-edit').on('click', () => openEnvEditor(e.id));
        list.append(item);
    });
}
function openEnvEditor(envId) {
    const e = envId ? getEnvironmentById(envId) : null;
    $('#sib-modal').data('editing-env-id', envId || null);
    $('#sib-env-ed-name').val(e?.name || ''); $('#sib-env-ed-desc').val(e?.description || '');
    $('#sib-env-btn-delete').toggle(!!envId); showImageView('env-editor');
}
function saveEnvEditor() {
    const name = $('#sib-env-ed-name').val().trim();
    const description = $('#sib-env-ed-desc').val().trim();
    if (!name) return alert('Введите название локации');
    
    const id = $('#sib-modal').data('editing-env-id');
    if (id) updateEnvironment(id, { name, description }); else addEnvironment({ id: generateId('sib-env'), name, description });
    renderEnvList(); showImageView('envs');
}

// ── PICKERS ──────────────────────────────────────────────────
function renderCharPicker(selectedIds = []) {
    const picker = $('#sib-img-char-picker').empty(); const chars = getCharacters();
    if (!chars.length) return picker.append('<div style="opacity:0.5;font-size:0.85em;padding:4px;">Нет персонажей.</div>');
    chars.forEach(c => {
        picker.append(`<label class="sib-img-char-pick-row"><input type="checkbox" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''} /><span class="sib-img-char-pick-name">${c.name}</span></label>`);
    });
}
function renderEnvPicker(selectedIds = []) {
    const picker = $('#sib-img-env-picker').empty(); const envs = getEnvironments();
    if (!envs.length) return picker.append('<div style="opacity:0.5;font-size:0.85em;padding:4px;">Нет локаций.</div>');
    envs.forEach(e => {
        picker.append(`<label class="sib-img-char-pick-row"><input type="checkbox" value="${e.id}" ${selectedIds.includes(e.id) ? 'checked' : ''} /><span class="sib-img-char-pick-name">${e.name}</span></label>`);
    });
}

// ── GLOBAL & HELPERS ─────────────────────────────────────────
function loadGlobalForm() { const d = getSettings().display || {}; $('#sib-g-collapse').prop('checked', d.collapseByDefault); $('#sib-g-showname').prop('checked', d.showBlockName); $('#sib-g-animate').prop('checked', d.animateIn); }
function saveGlobalSettings() { getSettings().display = { collapseByDefault: $('#sib-g-collapse').is(':checked'), showBlockName: $('#sib-g-showname').is(':checked'), animateIn: $('#sib-g-animate').is(':checked') }; saveSettings(); toastr.success('Сохранено'); }
function fillProfileSelect(selector, selectedValue) {
    const select = $(selector).empty(); select.append('<option value="">— выберите профиль —</option>');
    (SillyTavern.getContext().extensionSettings?.connectionManager?.profiles || []).forEach(p => select.append(`<option value="${p.name}" ${p.name === selectedValue ? 'selected' : ''}>${p.name}</option>`));
}
function buildFolderSection(folderName, folderBlocks, type) {
    const header = $(`<div class="sib-folder-header"><i class="fas fa-folder sib-folder-icon"></i><span style="flex:1;">${folderName}</span><span style="opacity:0.5;font-size:0.8em;">${folderBlocks.length} шт.</span><i class="fas fa-chevron-right sib-folder-chevron"></i></div>`);
    const content = $('<div class="sib-folder-content" style="display:none;"></div>');
    folderBlocks.forEach(b => {
        const item = $(`<div class="sib-block-item ${b.enabled ? 'sib-item-enabled' : ''}"><div class="sib-item-left"><label class="sib-toggle-wrap"><input type="checkbox" class="sib-info-toggle" ${b.enabled ? 'checked' : ''} /><span class="sib-toggle-slider"></span></label><span class="sib-item-name">${b.name}</span></div><div class="sib-item-right"><span class="sib-item-profile">${b.profile || '—'}</span><button class="sib-info-edit sib-btn-icon">✏️</button></div></div>`);
        item.find('.sib-info-toggle').on('change', function () { toggleInfoBlock(b.id); item.toggleClass('sib-item-enabled', this.checked); });
        item.find('.sib-info-edit').on('click', () => openInfoEditor(b.id)); content.append(item);
    });
    header.on('click', function () { const hidden = content.is(':hidden'); content.slideToggle(200); header.find('.sib-folder-icon').toggleClass('fa-folder', !hidden).toggleClass('fa-folder-open', hidden); header.find('.sib-folder-chevron').css('transform', hidden ? 'rotate(90deg)' : 'rotate(0deg)'); });
    return $('<div class="sib-folder-wrap"></div>').append(header).append(content);
}