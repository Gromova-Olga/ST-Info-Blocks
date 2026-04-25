// constants/DefaultSettings.js

export const extensionName = 'ST-Info-Blocks';

export const defaultSettings = {
    enabled: true,

    // Список инфоблоков
    blocks: [
        {
            id: 'example-status',
            name: '📊 Статус сцены',
            enabled: false,
            profile: '',          // имя профиля ST Connection Manager
            groupId: '',
            temperature: 0.7,
            maxTokens: 800,
            contextMessages: 6,
            triggerOnSwipe: true,
            prompt: `Ты анализируешь текущую сцену ролевой игры. На основе последних сообщений заполни следующий HTML-шаблон — вместо {{...}} подставь реальные данные. Верни ТОЛЬКО готовый HTML, без пояснений, без markdown-блоков.

<div class="sib-block sib-status">
  <div class="sib-block-title">📊 Статус сцены</div>
  <div class="sib-row"><span class="sib-label">Настроение:</span><span class="sib-value">{{mood}}</span></div>
  <div class="sib-row"><span class="sib-label">Локация:</span><span class="sib-value">{{location}}</span></div>
  <div class="sib-row"><span class="sib-label">Время суток:</span><span class="sib-value">{{time_of_day}}</span></div>
  <div class="sib-row"><span class="sib-label">Напряжение:</span><span class="sib-value">{{tension}}</span></div>
</div>`
        }
    ],

    // Глобальные настройки отображения
    display: {
        collapseByDefault: false,   // сворачивать блоки при вставке
        showBlockName: true,         // показывать заголовок блока
        animateIn: true              // анимация появления
    }
};
