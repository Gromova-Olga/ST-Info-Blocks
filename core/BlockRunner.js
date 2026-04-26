// core/BlockRunner.js

import { InfoBlockApiService } from '../api/InfoBlockApiService.js';
import { getEnabledBlocks } from './StateManager.js';
import { renderBlockLoading, clearBlockLoading, clearMessageBlocks, getLastBotMesId } from '../ui/BlockRenderer.js';
// ВАЖНО: Добавили eventSource и event_types в импорты
import { chat, saveChatDebounced, updateMessageBlock, eventSource, event_types } from '../../../../../script.js';

// 1. ГЛОБАЛЬНЫЙ МАРКЕР (Защита от дублей)
const SIB_MARKER = '<' + '!-- sib-processed --' + '>';

// ФЛАГ: Генерирует ли Таверна ответ прямо сейчас?
let isStGenerating = false;

// Подключаемся к "мозгам" Таверны
if (eventSource && event_types) {
    eventSource.on(event_types.GENERATION_STARTED, () => { 
        isStGenerating = true; 
    });
    eventSource.on(event_types.GENERATION_STOPPED, () => { 
        isStGenerating = false; 
    });
    eventSource.on(event_types.MESSAGE_RECEIVED, () => { 
        isStGenerating = false; 
    });
}

export async function runAllBlocks(mesId, options = {}) {
    if (mesId === 0 || mesId === '0') return;

    // ЖЕЛЕЗОБЕТОННАЯ ЗАЩИТА: Если Таверна сейчас пишет ответ (реролл) — спим!
    if (isStGenerating) {
        console.log(`[ST-InfoBlocks] Отмена: Таверна в процессе генерации. Ждем MESSAGE_RECEIVED.`);
        return;
    }

    const { isSwipe = false } = options;
    const messageText = chat[mesId]?.mes || '';
    const cleanText = messageText.trim();

    // Защита от пустых сообщений
    if (!cleanText || cleanText === '...' || cleanText === '…') {
        return;
    }

    // УНИВЕРСАЛЬНАЯ ЗАЩИТА: Ищем наш скрытый маркер
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
        
        group.forEach(b => clearBlockLoading(mesId, b.id));

        const cleanHtml = html.replace(/^```html\s*/im, '').replace(/```\s*$/m, '').trim();

        if (chat[mesId]) {
            // ВСТАВЛЯЕМ НЕВИДИМЫЙ МАРКЕР + СГЕНЕРИРОВАННЫЙ КОД
            chat[mesId].mes += '\n\n' + SIB_MARKER + '\n' + cleanHtml;
            
            saveChatDebounced();
            await updateMessageBlock(mesId, chat[mesId]); 
            
            // ПИНАЕМ SILLYIMAGES (и другие расширения), чтобы они увидели вклеенный код
            setTimeout(() => {
                if (eventSource && event_types && event_types.CHARACTER_MESSAGE_RENDERED) {
                    console.log('[ST-InfoBlocks] Сигналим SillyImages о появлении новых тегов...');
                    eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, mesId);
                }
            }, 100);
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
    
    // Ждем чуть-чуть, пока Таверна отрендерит ответ
    setTimeout(() => runAllBlocks(targetId, { isSwipe: false }), 400);
}

export function onMessageSwiped(mesId) {
    const targetId = mesId ?? getLastBotMesId();
    if (targetId === null || targetId === undefined) return;

    setTimeout(() => {
        clearMessageBlocks(targetId);
        runAllBlocks(targetId, { isSwipe: true });
    }, 200);
}
