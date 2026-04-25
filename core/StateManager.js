// core/StateManager.js

import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { extensionName, defaultSettings } from '../constants/DefaultSettings.js';

/**
 * Возвращает настройки расширения, создаёт если нет
 */
export function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = structuredClone(defaultSettings);
    }
    // Добавляем новые поля если версия старая
    const s = extension_settings[extensionName];
    if (!s.blocks) s.blocks = [];
    if (!s.display) s.display = { ...defaultSettings.display };
    return s;
}

/**
 * Сохраняет настройки (debounced)
 */
export function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Возвращает список блоков
 */
export function getBlocks() {
    return getSettings().blocks || [];
}

/**
 * Возвращает блок по id
 */
export function getBlockById(id) {
    return getBlocks().find(b => b.id === id) || null;
}

/**
 * Добавляет новый блок
 */
export function addBlock(blockData) {
    const settings = getSettings();
    settings.blocks.push(blockData);
    saveSettings();
}

/**
 * Обновляет блок по id
 */
export function updateBlock(id, patch) {
    const settings = getSettings();
    const idx = settings.blocks.findIndex(b => b.id === id);
    if (idx === -1) return false;
    settings.blocks[idx] = { ...settings.blocks[idx], ...patch };
    saveSettings();
    return true;
}

/**
 * Удаляет блок по id
 */
export function removeBlock(id) {
    const settings = getSettings();
    settings.blocks = settings.blocks.filter(b => b.id !== id);
    saveSettings();
}

/**
 * Переключает enabled у блока
 */
export function toggleBlock(id) {
    const block = getBlockById(id);
    if (!block) return;
    updateBlock(id, { enabled: !block.enabled });
}

/**
 * Возвращает включённые блоки
 */
export function getEnabledBlocks() {
    return getBlocks().filter(b => b.enabled);
}

/**
 * Генерирует простой уникальный id
 */
export function generateId() {
    return 'sib-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}
