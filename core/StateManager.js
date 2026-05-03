// core/StateManager.js — ST-Info-Blocks (unified)

import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { extensionName, defaultSettings } from '../constants/DefaultSettings.js';

export function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = structuredClone(defaultSettings);
    }
    const s = extension_settings[extensionName];
    if (!s.infoBlocks)   s.infoBlocks   = [];
    if (!s.imageBlocks)  s.imageBlocks  = [];
    if (!s.characters)   s.characters   = [];
    if (!s.environments) s.environments = [];
    if (!s.display)      s.display      = { ...defaultSettings.display };
    return s;
}

export function saveSettings() {
    saveSettingsDebounced();
}

export function generateId(prefix = 'sib') {
    return `${prefix}-` + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

// ── Инфоблоки ────────────────────────────────────────────────

export function getInfoBlocks() { return getSettings().infoBlocks || []; }
export function getInfoBlockById(id) { return getInfoBlocks().find(b => b.id === id) || null; }
export function addInfoBlock(data) { getSettings().infoBlocks.push(data); saveSettings(); }
export function updateInfoBlock(id, patch) {
    const s = getSettings();
    const idx = s.infoBlocks.findIndex(b => b.id === id);
    if (idx === -1) return false;
    s.infoBlocks[idx] = { ...s.infoBlocks[idx], ...patch };
    saveSettings();
    return true;
}
export function removeInfoBlock(id) {
    const s = getSettings();
    s.infoBlocks = s.infoBlocks.filter(b => b.id !== id);
    saveSettings();
}
export function toggleInfoBlock(id) {
    const b = getInfoBlockById(id);
    if (b) updateInfoBlock(id, { enabled: !b.enabled });
}
export function getEnabledInfoBlocks() { return getInfoBlocks().filter(b => b.enabled); }

// ── Блоки картинок ───────────────────────────────────────────

export function getImageBlocks() { return getSettings().imageBlocks || []; }
export function getImageBlockById(id) { return getImageBlocks().find(b => b.id === id) || null; }
export function addImageBlock(data) { getSettings().imageBlocks.push(data); saveSettings(); }
export function updateImageBlock(id, patch) {
    const s = getSettings();
    const idx = s.imageBlocks.findIndex(b => b.id === id);
    if (idx === -1) return false;
    s.imageBlocks[idx] = { ...s.imageBlocks[idx], ...patch };
    saveSettings();
    return true;
}
export function removeImageBlock(id) {
    const s = getSettings();
    s.imageBlocks = s.imageBlocks.filter(b => b.id !== id);
    saveSettings();
}
export function toggleImageBlock(id) {
    const b = getImageBlockById(id);
    if (b) updateImageBlock(id, { enabled: !b.enabled });
}
export function getEnabledImageBlocks() { return getImageBlocks().filter(b => b.enabled); }

// ── Персонажи и Аутфиты ──────────────────────────────────────

export function getCharacters() { return getSettings().characters || []; }
export function getCharacterById(id) { return getCharacters().find(c => c.id === id) || null; }
export function addCharacter(data) { getSettings().characters.push(data); saveSettings(); }
export function updateCharacter(id, patch) {
    const s = getSettings();
    const idx = s.characters.findIndex(c => c.id === id);
    if (idx === -1) return false;
    s.characters[idx] = { ...s.characters[idx], ...patch };
    saveSettings();
    return true;
}
export function removeCharacter(id) {
    const s = getSettings();
    s.characters = s.characters.filter(c => c.id !== id);
    s.imageBlocks.forEach(b => {
        if (b.characterIds) b.characterIds = b.characterIds.filter(cid => cid !== id);
    });
    saveSettings();
}

export function buildCharactersString(characterIds) {
    if (!characterIds || !characterIds.length) return '(no characters specified)';
    const chars = getCharacters().filter(c => characterIds.includes(c.id));
    if (!chars.length) return '(no characters found)';
    return chars.map(c => {
        const parts = [`Name: ${c.name}`];
        if (c.appearance?.trim()) parts.push(`Appearance: ${c.appearance}`);
        
        // Обработка активного аутфита
        let activeOutfitVal = c.outfit || ''; // legacy fallback
        if (c.outfits && c.outfits.length > 0) {
            const active = c.outfits.find(o => o.id === c.activeOutfitId) || c.outfits[0];
            activeOutfitVal = active.value;
        }
        if (activeOutfitVal?.trim()) parts.push(`Outfit: ${activeOutfitVal}`);
        
        return parts.join(', ');
    }).join('\n');
}

// ── Окружение (Environments) ─────────────────────────────────

export function getEnvironments() { return getSettings().environments || []; }
export function getEnvironmentById(id) { return getEnvironments().find(e => e.id === id) || null; }
export function addEnvironment(data) { getSettings().environments.push(data); saveSettings(); }
export function updateEnvironment(id, patch) {
    const s = getSettings();
    const idx = s.environments.findIndex(e => e.id === id);
    if (idx === -1) return false;
    s.environments[idx] = { ...s.environments[idx], ...patch };
    saveSettings();
    return true;
}
export function removeEnvironment(id) {
    const s = getSettings();
    s.environments = s.environments.filter(e => e.id !== id);
    s.imageBlocks.forEach(b => {
        if (b.environmentIds) b.environmentIds = b.environmentIds.filter(eid => eid !== id);
    });
    saveSettings();
}

export function buildEnvironmentsString(environmentIds) {
    if (!environmentIds || !environmentIds.length) return '';
    const envs = getEnvironments().filter(e => environmentIds.includes(e.id));
    if (!envs.length) return '';
    return envs.map(e => `${e.name}: ${e.description || ''}`).join('\n');
}