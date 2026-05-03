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

        // Если макросы есть в тексте — заменяем их
        if (hasCharMacro) template = template.replace(/\{\{characters\}\}/g, charStr);
        if (hasEnvMacro) template = template.replace(/\{\{environments\}\}/g, envStr || '');

        // АВТОИНЖЕКТ: Если макросов нет, собираем "шапку" из включенных данных
        let autoInjectPrefix = '';
        if (!hasEnvMacro && envStr) {
            autoInjectPrefix += `[ENVIRONMENT / LOCATION]\n${envStr}\n\n`;
        }
        if (!hasCharMacro && charStr && charStr !== '(no characters specified)') {
            autoInjectPrefix += `[ACTIVE CHARACTERS]\n${charStr}\n\n`;
        }
        
        // Клеим шапку к твоему шаблону
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
            
            // На случай если макрос есть
            const instructionWithEnv = (b.promptInstruction || '').replace(/\{\{environments\}\}/g, envStr || '');
            const bCopy = { ...b, promptInstruction: instructionWithEnv };

            // АВТОИНЖЕКТ для отдельного запроса:
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