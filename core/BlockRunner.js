// core/BlockRunner.js

import { InfoBlockApiService } from '../api/InfoBlockApiService.js';
import { getEnabledBlocks } from './StateManager.js';
import { renderBlockLoading, clearBlockLoading, clearMessageBlocks, getLastBotMesId } from '../ui/BlockRenderer.js';
import { chat, saveChatDebounced, updateMessageBlock } from '../../../../../script.js';

// 1. ГЛОБАЛЬНЫЙ МАРКЕР (Защита от дублей)
const SIB_MARKER = '<' + '!-- sib-processed --' + '>';

export async function runAllBlocks(mesId, options = {}) {
    if (mesId === 0 || mesId === '0') return;

    const { isSwipe = false } = options;
    const messageText = chat[mesId]?.mes || '';
    const cleanText = messageText.trim();

    // ===== ДЕБАГ БЛОК (Смотрим, что нам врет Таверна) =====
    console.log("%c[ST-InfoBlocks DEBUG]", "color: #00ffcc; font-size: 14px; font-weight: bold;");
    console.log(`Срабатывание на сообщении: ${mesId}. Это свайп? ${isSwipe}`);
    console.log("Текст, который видит скрипт прямо сейчас: >>>\n", cleanText, "\n<<<");
    console.log("Есть ли там маркер?", messageText.includes(SIB_MARKER));
    // =======================================================

    // ЗАЩИТА 1: Пустота или точки
    if (!cleanText || cleanText === '...' || cleanText === '…') {
        console.log(`[ST-InfoBlocks] Отмена: сообщение пустое или это точки.`);
        return;
    }

    // ЗАЩИТА 2: Наш маркер
    if (messageText.includes(SIB_MARKER)) {
        console.log(`[ST-InfoBlocks] Отмена: маркер уже стоит.`);
        return;
    }

    console.log("%c[ST-InfoBlocks] ВНИМАНИЕ! ЗАЩИТА ПРОБИТА! ИДЕТ ЗАПРОС...", "color: #ff3333; font-weight: bold;");

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
