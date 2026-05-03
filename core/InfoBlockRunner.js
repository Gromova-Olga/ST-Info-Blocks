// core/InfoBlockRunner.js — ST-Info-Blocks

import { InfoBlockApiService } from '../api/InfoBlockApiService.js';
import { getEnabledInfoBlocks } from './StateManager.js';
import { renderInfoBlockLoading, clearInfoBlockLoading, clearInfoMessageBlocks, getLastBotMesId } from '../ui/InfoBlockRenderer.js';
import { chat, saveChatDebounced, updateMessageBlock, eventSource, event_types } from '../../../../../script.js';
import { extensionName } from '../constants/DefaultSettings.js';

const INFO_MARKER = '<' + '!-- sib-info-processed --' + '>';

let isStGenerating = false;

if (eventSource && event_types) {
    eventSource.on(event_types.GENERATION_STARTED, () => { isStGenerating = true; });
    eventSource.on(event_types.GENERATION_STOPPED, () => { isStGenerating = false; });
    eventSource.on(event_types.MESSAGE_RECEIVED,   () => { isStGenerating = false; });
}

export async function runAllInfoBlocks(mesId, options = {}) {
    if (mesId === 0 || mesId === '0') return;
    if (isStGenerating) {
        console.log(`[${extensionName}] InfoBlocks: отмена — таверна генерирует.`);
        return;
    }

    const { isSwipe = false } = options;
    const messageText = chat[mesId]?.mes || '';
    const cleanText = messageText.trim();
    if (!cleanText || cleanText === '...' || cleanText === '…') return;
    if (messageText.includes(INFO_MARKER)) {
        console.log(`[${extensionName}] InfoBlocks: маркер уже есть в ${mesId}, пропуск.`);
        return;
    }

    const blocks = getEnabledInfoBlocks().filter(b => {
        if (isSwipe && !b.triggerOnSwipe) return false;
        return true;
    });
    if (!blocks.length) return;

    // Группировка
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

    blocks.forEach(b => renderInfoBlockLoading(mesId, b.id, b.name));

    await Promise.allSettled(taskGroups.map(group => runInfoGroup(group, mesId)));
}

async function runInfoGroup(group, mesId) {
    if (!group.length) return;

    const combinedPrompt = group.length === 1
        ? group[0].prompt
        : `Сгенерируй следующие инфоблоки. Верни ТОЛЬКО чистый HTML для всех блоков подряд, без пояснений.\n\n` +
          group.map((b, i) => `--- БЛОК ${i + 1}: ${b.name} ---\n${b.prompt}`).join('\n\n');

    const virtualBlock = { ...group[0], prompt: combinedPrompt };

    try {
        const html = await InfoBlockApiService.generate(virtualBlock);
        group.forEach(b => clearInfoBlockLoading(mesId, b.id));

        const cleanHtml = html.replace(/^```html\s*/im, '').replace(/```\s*$/m, '').trim();

        if (chat[mesId]) {
            chat[mesId].mes += '\n\n' + INFO_MARKER + '\n' + cleanHtml;
            saveChatDebounced();
            await updateMessageBlock(mesId, chat[mesId]);

            setTimeout(() => {
                if (eventSource && event_types?.CHARACTER_MESSAGE_RENDERED) {
                    eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, mesId);
                }
            }, 100);
        }
    } catch (err) {
        group.forEach(b => clearInfoBlockLoading(mesId, b.id));
        const names = group.map(b => b.name).join(', ');
        toastr.warning(`Ошибка InfoBlocks (${names}): ${err.message}`, '', { timeOut: 5000 });
        console.error(`[${extensionName}] InfoBlocks ошибка:`, err);
    }
}

export function onInfoMessageReceived(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;
    setTimeout(() => runAllInfoBlocks(targetId, { isSwipe: false }), 400);
}

export function onInfoMessageSwiped(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;
    setTimeout(() => {
        clearInfoMessageBlocks(targetId);
        runAllInfoBlocks(targetId, { isSwipe: true });
    }, 200);
}
