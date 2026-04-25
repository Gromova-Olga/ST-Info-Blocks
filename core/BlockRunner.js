// core/BlockRunner.js

import { InfoBlockApiService } from '../api/InfoBlockApiService.js';
import { getEnabledBlocks } from './StateManager.js';
import { renderBlockLoading, clearBlockLoading, clearMessageBlocks, getLastBotMesId } from '../ui/BlockRenderer.js';
import { chat, saveChatDebounced, updateMessageBlock } from '../../../../../script.js';

// 1. ГЛОБАЛЬНЫЙ МАРКЕР (Вынесен наверх, чтобы его видели все функции)
const SIB_MARKER = '<' + '!-- sib-processed --' + '>';

export async function runAllBlocks(mesId, options = {}) {
    if (mesId === 0 || mesId === '0') return;

    const { isSwipe = false } = options;
    const messageText = chat[mesId]?.mes || '';

    // 2. ЗАЩИТА: Не дергаем API на пустых сообщениях
    if (!messageText.trim()) {
        console.log(`[ST-InfoBlocks] Сообщение ${mesId} пока пустое, пропускаем.`);
        return;
    }

    // 3. УНИВЕРСАЛЬНАЯ ЗАЩИТА: Ищем наш скрытый маркер
    if (messageText.includes(SIB_MARKER)) {
        console.log(`[ST-InfoBlocks] Блоки уже есть в сообщении ${mesId}, пропускаем генерацию.`);
        return;
    }

    const blocks = getEnabledBlocks().filter(b => {
        if (isSwipe && !b.triggerOnSwipe) return false;
        return true;
    });

    if (!blocks.length) return;

    // Группировка блоков
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

    // Показываем лоадеры
    blocks.forEach(b => renderBlockLoading(mesId, b.id, b.name));

    // Запускаем группы параллельно
    await Promise.allSettled(
        taskGroups.map(group => runGroup(group, mesId))
    );
}

async function runGroup(group, mesId) {
    if (group.length === 0) return;

    // Склеиваем промпты для группы
    const combinedPrompt = group.length === 1 
        ? group[0].prompt 
        : `Сгенерируй следующие инфоблоки. Верни ТОЛЬКО чистый HTML код для всех блоков подряд, без пояснений.\n\n` +
          group.map((b, i) => `--- БЛОК ${i+1}: ${b.name} ---\n${b.prompt}`).join('\n\n');

    const virtualBlock = { ...group[0], prompt: combinedPrompt };

    try {
        const html = await InfoBlockApiService.generate(virtualBlock);
        
        // Удаляем временные лоадеры
        group.forEach(b => clearBlockLoading(mesId, b.id));

        // Чистим ответ от возможных markdown-оберток
        const cleanHtml = html.replace(/^```html\s*/im, '').replace(/```\s*$/m, '').trim();

        if (chat[mesId]) {
            // ВСТАВЛЯЕМ НЕВИДИМЫЙ МАРКЕР + СГЕНЕРИРОВАННЫЙ КОД
            chat[mesId].mes += '\n\n' + SIB_MARKER + '\n' + cleanHtml;
            
            saveChatDebounced();
            await updateMessageBlock(mesId, chat[mesId]); 
        }

    } catch (err) {
        group.forEach(b => clearBlockLoading(mesId, b.id));
        const groupNames = group.map(b => b.name).join(', ');
        toastr.warning(`Ошибка ST-InfoBlocks (${groupNames}): ${err.message}`, '', { timeOut: 5000 });
        console.error(`[ST-InfoBlocks] Ошибка генерации:`, err);
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

    // ХАКЕРСКАЯ ЗАЩИТА ОТ РЕРОЛЛА (Детектор стриминга)
    // Запоминаем текст сообщения в момент свайпа
    const textBefore = chat[targetId]?.mes || '';

    setTimeout(() => {
        // Проверяем текст через 800мс
        const textAfter = chat[targetId]?.mes || '';
        
        // Если текст изменился, значит нейросеть прямо сейчас печатает ответ!
        // Сбрасываем генерацию и ждем события MESSAGE_RECEIVED
        if (textBefore !== textAfter) {
            console.log('[ST-InfoBlocks] Обнаружен стриминг при реролле, ждем окончания генерации.');
            return;
        }

        // Если текст не менялся — это обычный свайп на старое сообщение
        clearMessageBlocks(targetId);
        runAllBlocks(targetId, { isSwipe: true });
    }, 800);
}
