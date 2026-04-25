// ui/BlockRenderer.js

function getOrCreateContainer(mesId) {
    const mesEl = $(`.mes[mesid="${mesId}"]`);
    if (!mesEl.length) return null;

    let container = mesEl.find('.sib-container');
    if (!container.length) {
        container = $('<div class="sib-container"></div>');
        const mesText = mesEl.find('.mes_text');
        if (mesText.length) {
            mesText.after(container);
        } else {
            mesEl.append(container);
        }
    }
    return container;
}

export function renderBlockLoading(mesId, blockId, blockName) {
    const container = getOrCreateContainer(mesId);
    if (!container) return;

    let wrapper = container.find(`.sib-wrapper[data-block-id="${blockId}"]`);
    if (!wrapper.length) {
        wrapper = $(`
            <div class="sib-wrapper sib-loading" data-block-id="${blockId}">
                <div class="sib-header" style="opacity: 0.7;">
                    <span class="sib-header-name">⏳ Генерируется: ${blockName}...</span>
                    <span class="sib-spinner"></span>
                </div>
            </div>
        `);
        container.append(wrapper);
    }
}

export function clearBlockLoading(mesId, blockId) {
    // Просто удаляем временный лоадер из DOM. Никаких следов.
    const wrapper = $(`.mes[mesid="${mesId}"] .sib-wrapper[data-block-id="${blockId}"]`);
    wrapper.remove(); 
}

export function clearMessageBlocks(mesId) {
    $(`.mes[mesid="${mesId}"] .sib-container`).empty();
}

export function getLastBotMesId() {
    const botMessages = $('.mes[is_user="false"]');
    if (!botMessages.length) return null;
    return botMessages.last().attr('mesid');
}