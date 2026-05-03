// constants/DefaultSettings.js — ST-Info-Blocks (unified)

export const extensionName = 'ST-Info-Blocks';

export const defaultSettings = {
    enabled: true,

    // ── Инфоблоки ────────────────────────────────────────────
    infoBlocks: [
        {
            id: 'example-status',
            name: '📊 Статус сцены',
            enabled: false,
            profile: '',
            folder: '',
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

    // ── Блоки картинок ────────────────────────────────────────
    imageBlocks: [
        {
            id: 'example-image',
            name: '🖼️ Промт сцены',
            enabled: false,
            mode: 'request',   // 'request' | 'inject'
            profile: '',
            groupId: '',
            temperature: 0.7,
            maxTokens: 400,
            contextMessages: 6,
            triggerOnSwipe: true,
            characterIds: [],
            promptInstruction: `You are a Stable Diffusion prompt writer.
Based on the last few messages of the roleplay scene, write a concise image generation prompt.

Active characters in this scene:
{{characters}}

Rules:
- Write ONLY the prompt, no explanations
- Start with the scene type: (portrait), (scene), (close-up), etc.
- Include lighting, atmosphere, art style at the end
- Max 120 words
- Comma-separated tags`,
            htmlTemplate: `<div class="sib-block sib-image-prompt">
  <div class="sib-block-title">🖼️ Image Prompt</div>
  <div class="sib-image-prompt-text">{{prompt}}</div>
</div>`,
            injectionTemplate: `[IMAGE PROMPT INSTRUCTION]
After your reply, append an image generation prompt on a new line wrapped in [IMG]...[/IMG] tags.
Characters present: {{characters}}
Write a concise Stable Diffusion prompt describing the scene.
[/IMAGE PROMPT INSTRUCTION]`,
        }
    ],

    // ── Персонажи (для image-блоков) ─────────────────────────
    characters: [],
    environments: [],

    // ── Общие настройки отображения ──────────────────────────
    display: {
        collapseByDefault: false,
        showBlockName: true,
        animateIn: true,
    }
};
