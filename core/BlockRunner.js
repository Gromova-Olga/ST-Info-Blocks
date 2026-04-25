// core/BlockRunner.js

import { InfoBlockApiService } from '../api/InfoBlockApiService.js';
import { getEnabledBlocks } from './StateManager.js';
import { renderBlockLoading, clearBlockLoading, clearMessageBlocks, getLastBotMesId } from '../ui/BlockRenderer.js';
import { chat, saveChatDebounced, updateMessageBlock } from '../../../../../script.js';

export async function runAllBlocks(mesId, options = {}) {
    // 1. ИГНОРИРУЕМ ПЕРВОЕ СООБЩЕНИЕ (Приветствие)
    if (mesId === 0 || mesId === '0') return;

    const { isSwipe = false } = options;

    const messageText = chat[mesId]?.mes || '';
    if (messageText.includes('class="sib-block')) {
        console.log(`[ST-InfoBlocks] Блоки уже есть в сообщении ${mesId}, пропускаем.`);
        return;
    }

    const blocks = getEnabledBlocks().filter(b => {
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
    Object.values(manualGroups).forEach(group => taskGroups.push(group));

    blocks.forEach(b => renderBlockLoading(mesId, b.id, b.name));

    await Promise.allSettled(
        taskGroups.map(group => runGroup(group, mesId))
    );
}

async function runGroup(group, mesId) {
    if (group.length === 0) return;

    const combinedPrompt = group.length === 1 
        ? group[0].prompt 
        : `Сгенерируй следующие инфоблоки. Верни ТОЛЬКО чистый HTML код для всех блоков подряд, без пояснений.\n\n` +
          group.map((b, i) => `--- БЛОК ${i+1}: ${b.name} ---\n${b.prompt}`).join('\n\n');

    const virtualBlock = { ...group[0], prompt: combinedPrompt };

    try {
        const html = await InfoBlockApiService.generate(virtualBlock);
        
        // Удаляем временные лоадеры
        group.forEach(b => clearBlockLoading(mesId, b.id));

        const cleanHtml = html.replace(/^```html\s*/im, '').replace(/```\s*$/m, '').trim();

        if (chat[mesId]) {
            // Записываем HTML в память чата
            chat[mesId].mes += '\n\n' + cleanHtml;
            saveChatDebounced();
            
            // ИСПРАВЛЕННАЯ СТРОКА: передаем chat[mesId]
            // Добавил await на всякий случай, в новых версиях ST это промис
            await updateMessageBlock(mesId, chat[mesId]); 
        }

    } catch (err) {
        group.forEach(b => clearBlockLoading(mesId, b.id));
        // Выводим ошибку только всплывашкой сверху справа, в чат ничего не пишем
        toastr.warning(`Ошибка ST-InfoBlocks: ${err.message}`, '', { timeOut: 5000 });
        console.error(`[ST-InfoBlocks] Ошибка:`, err);
    }
}

export function onMessageReceived(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;
    
    setTimeout(() => runAllBlocks(targetId, { isSwipe: false }), 400);
}

export function onMessageSwiped(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;

    setTimeout(() => {
        clearMessageBlocks(targetId);
        runAllBlocks(targetId, { isSwipe: true });
    }, 500);
}