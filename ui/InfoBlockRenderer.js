// ui/InfoBlockRenderer.js — ST-Info-Blocks

function getOrCreateInfoContainer(mesId) {
    const mesEl = $(`.mes[mesid="${mesId}"]`);
    if (!mesEl.length) return null;

    let container = mesEl.find('.sib-info-container');
    if (!container.length) {
        container = $('<div class="sib-info-container sib-container"></div>');
        const mesText = mesEl.find('.mes_text');
        mesText.length ? mesText.after(container) : mesEl.append(container);
    }
    return container;
}

export function renderInfoBlockLoading(mesId, blockId, blockName) {
    const container = getOrCreateInfoContainer(mesId);
    if (!container) return;

    if (!container.find(`.sib-wrapper[data-block-id="${blockId}"]`).length) {
        container.append(`
            <div class="sib-wrapper sib-loading" data-block-id="${blockId}">
                <div class="sib-header" style="opacity:0.7;">
                    <span class="sib-header-name">⏳ Генерируется: ${blockName}...</span>
                    <span class="sib-spinner"></span>
                </div>
            </div>
        `);
    }
}

export function clearInfoBlockLoading(mesId, blockId) {
    $(`.mes[mesid="${mesId}"] .sib-info-container .sib-wrapper[data-block-id="${blockId}"]`).remove();
}

export function clearInfoMessageBlocks(mesId) {
    $(`.mes[mesid="${mesId}"] .sib-info-container`).empty();
}

export function getLastBotMesId() {
    const botMessages = $('.mes[is_user="false"]');
    if (!botMessages.length) return null;
    return botMessages.last().attr('mesid');
}
