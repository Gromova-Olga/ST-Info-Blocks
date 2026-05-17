// core/ImageBlockRunner.js — ST-Info-Blocks

import { ImageBlockApiService } from '../api/ImageBlockApiService.js';
import { getEnabledImageBlocks, buildCharactersString, buildEnvironmentsString } from './StateManager.js';
import { renderImageBlockLoading, clearImageBlockLoading, clearImageMessageBlocks } from '../ui/ImageBlockRenderer.js';
import { getLastBotMesId } from '../ui/InfoBlockRenderer.js';
import { chat, saveChatDebounced, updateMessageBlock, eventSource, event_types, setExtensionPrompt } from '../../../../../script.js';
import { extensionName } from '../constants/DefaultSettings.js';

const IMAGE_MARKER  = '<' + '!-- sib-img-processed --' + '>';
const INJECTION_KEY = `${extensionName}_image_injection`;

let isStGenerating = false;

if (eventSource && event_types) {
    eventSource.on(event_types.GENERATION_STARTED, () => { isStGenerating = true; });
    eventSource.on(event_types.GENERATION_STOPPED, () => { isStGenerating = false; });
    eventSource.on(event_types.MESSAGE_RECEIVED,   () => { isStGenerating = false; });
    // Дополнительный сброс — GENERATION_STOPPED не всегда стреляет
    eventSource.on(event_types.GENERATION_ENDED,   () => { isStGenerating = false; });
}

// ── Injection mode ────────────────────────────────────────────

export function updateInjectionPrompt() {
    const injectBlocks = getEnabledImageBlocks().filter(b => b.mode === 'inject');

    if (!injectBlocks.length) {
        setExtensionPrompt(INJECTION_KEY, '', 1, 0);
        return;
    }

    const parts = injectBlocks.map(b => {
        const charStr = buildCharactersString(b.characterIds);
        const envStr  = buildEnvironmentsString(b.environmentIds);
        
        let template = b.injectionTemplate || '';
        
        const hasCharMacro = template.includes('{{characters}}');
        const hasEnvMacro = template.includes('{{environments}}');

        if (hasCharMacro) template = template.replace(/\{\{characters\}\}/g, charStr);
        if (hasEnvMacro) template = template.replace(/\{\{environments\}\}/g, envStr || '');

        let autoInjectPrefix = '';
        if (!hasEnvMacro && envStr) {
            autoInjectPrefix += `[ENVIRONMENT / LOCATION]\n${envStr}\n\n`;
        }
        if (!hasCharMacro && charStr && charStr !== '(no characters specified)') {
            autoInjectPrefix += `[ACTIVE CHARACTERS]\n${charStr}\n\n`;
        }
        
        return autoInjectPrefix + template;
    });

    setExtensionPrompt(INJECTION_KEY, parts.join('\n\n---\n\n'), 1, 0);
    console.log(`[${extensionName}] ImageBlocks: injection обновлён (${injectBlocks.length} блок(ов))`);
}

// ── Request mode ──────────────────────────────────────────────

export async function runAllImageBlocks(mesId, options = {}) {
    if (mesId === 0 || mesId === '0') return;
    if (isStGenerating) {
        console.log(`[${extensionName}] ImageBlocks: отмена — таверна генерирует.`);
        return;
    }

    const { isSwipe = false } = options;
    const messageText = chat[mesId]?.mes || '';
    const cleanText = messageText.trim();
    if (!cleanText || cleanText === '...' || cleanText === '…') return;
    if (messageText.includes(IMAGE_MARKER)) {
        console.log(`[${extensionName}] ImageBlocks: маркер уже есть в ${mesId}, пропуск.`);
        return;
    }

    const blocks = getEnabledImageBlocks().filter(b => {
        if (b.mode === 'inject') return false;
        if (isSwipe && !b.triggerOnSwipe) return false;
        return true;
    });
    if (!blocks.length) return;

    const taskGroups = [];
    const manualGroups = {};
    for (const b of blocks) {
        if (b.groupId) {
            if (!manualGroups[b.groupId]) manualGroups[b.groupId] = [];
            manualGroups[b.groupId].push(b);
        } else {
            taskGroups.push([b]);
        }
    }
    Object.values(manualGroups).forEach(g => taskGroups.push(g));

    blocks.forEach(b => renderImageBlockLoading(mesId, b.id, b.name));

    await Promise.allSettled(taskGroups.map(group => runImageGroup(group, mesId)));
}

async function runImageGroup(group, mesId) {
    if (!group.length) return;

    try {
        let finalHtml = '';

        for (const b of group) {
            const charStr = buildCharactersString(b.characterIds);
            const envStr  = buildEnvironmentsString(b.environmentIds);
            
            const instructionWithEnv = (b.promptInstruction || '').replace(/\{\{environments\}\}/g, envStr || '');
            const bCopy = { ...b, promptInstruction: instructionWithEnv };

            let contextPayload = charStr;
            if (envStr) {
                contextPayload = `--- LOCATION / ENVIRONMENT ---\n${envStr}\n\n--- CHARACTERS ---\n${charStr}`;
            }

            const rawPrompt = await ImageBlockApiService.generate(bCopy, contextPayload);

            const template = b.htmlTemplate || '<div class="sib-image-prompt-text">{{prompt}}</div>';
            finalHtml += (template.includes('{{prompt}}')
                ? template.replace(/\{\{prompt\}\}/g, rawPrompt)
                : rawPrompt) + '\n';
        }

        group.forEach(b => clearImageBlockLoading(mesId, b.id));

        if (chat[mesId]) {
            chat[mesId].mes += '\n\n' + IMAGE_MARKER + '\n' + finalHtml.trim();
            saveChatDebounced();
            await updateMessageBlock(mesId, chat[mesId]);

            setTimeout(() => {
                if (eventSource && event_types?.CHARACTER_MESSAGE_RENDERED) {
                    eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, mesId);
                }
            }, 100);
        }
    } catch (err) {
        group.forEach(b => clearImageBlockLoading(mesId, b.id));
        const names = group.map(b => b.name).join(', ');
        toastr.warning(`Ошибка ImageBlocks (${names}): ${err.message}`, '', { timeOut: 5000 });
        console.error(`[${extensionName}] ImageBlocks ошибка:`, err);
    }
}

// ── Regen ─────────────────────────────────────────────────────

/**
 * Удаляет старый промт из chat[mesId].mes и перезапускает генерацию.
 * Вызывается кнопкой 🔄 в посте.
 */
export async function regenImageBlocksForMessage(mesId) {
    // Пользователь нажал кнопку вручную — флаг мог застрять.
    isStGenerating = false;

    // Удаляем старую кнопку сразу — после рендера injectRegenButton создаст новую
    $(`.mes[mesid="${mesId}"] .sib-img-regen-btn`).remove();

    // Срезаем маркер и всё что после него
    if (chat[mesId]) {
        const markerIdx = chat[mesId].mes.indexOf(IMAGE_MARKER);
        if (markerIdx !== -1) {
            chat[mesId].mes = chat[mesId].mes.slice(0, markerIdx).trimEnd();
        }
        saveChatDebounced();
        await updateMessageBlock(mesId, chat[mesId]);
    }

    // Чистим DOM-контейнер с промтом
    clearImageMessageBlocks(mesId);

    // Маркера больше нет — защита от дублей пропустит
    await runAllImageBlocks(mesId, { isSwipe: false });
}

/**
 * Вставляет кнопку 🔄 в DOM поста, если:
 * - в тексте сообщения есть IMAGE_MARKER (промт уже был сгенерирован)
 * - кнопки ещё нет в DOM
 * Вызывается из обработчика CHARACTER_MESSAGE_RENDERED.
 */
export function injectRegenButton(mesId) {
    const hasRequestBlocks = getEnabledImageBlocks().some(b => b.mode !== 'inject');
    if (!hasRequestBlocks) return;

    const mesEl = $(`.mes[mesid="${mesId}"]`);
    if (!mesEl.length) return;

    if (mesEl.find('.sib-img-regen-btn').length) return;

    // Проверяем наличие маркера двумя способами:
    // 1. В chat[] — надёжно когда чат уже загружен
    // 2. В тексте mes_text — надёжно при рендере живого поста
    const inChat = chat[mesId]?.mes?.includes(IMAGE_MARKER);
    const inDom  = mesEl.find('.mes_text').html()?.includes('sib-img-processed');
    if (!inChat && !inDom) return;

    const btn = $(`<button class="sib-img-regen-btn" data-mesid="${mesId}" title="Перегенерировать промт картинки">🔄 Промт</button>`);
    
    // Вставляем после image-container, или после info-container, или после mes_text
    const imgContainer = mesEl.find('.sib-image-container');
    const infoContainer = mesEl.find('.sib-info-container');
    if (imgContainer.length) {
        imgContainer.after(btn);
    } else if (infoContainer.length) {
        infoContainer.after(btn);
    } else {
        mesEl.find('.mes_text').after(btn);
    }
}

// ── Event handlers ────────────────────────────────────────────

export function onImageMessageReceived(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;
    setTimeout(() => runAllImageBlocks(targetId, { isSwipe: false }), 500);
}

export function onImageMessageSwiped(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;
    setTimeout(() => {
        clearImageMessageBlocks(targetId);
        runAllImageBlocks(targetId, { isSwipe: true });
    }, 300);
}
