// ui/ImageBlockRenderer.js — ST-Info-Blocks

function getOrCreateImageContainer(mesId) {
    const mesEl = $(`.mes[mesid="${mesId}"]`);
    if (!mesEl.length) return null;

    let container = mesEl.find('.sib-image-container');
    if (!container.length) {
        container = $('<div class="sib-image-container sib-container"></div>');
        // Картинки вставляем после info-container, если он есть, иначе после mes_text
        const infoContainer = mesEl.find('.sib-info-container');
        if (infoContainer.length) {
            infoContainer.after(container);
        } else {
            const mesText = mesEl.find('.mes_text');
            mesText.length ? mesText.after(container) : mesEl.append(container);
        }
    }
    return container;
}

export function renderImageBlockLoading(mesId, blockId, blockName) {
    const container = getOrCreateImageContainer(mesId);
    if (!container) return;

    if (!container.find(`.sib-image-block-wrapper[data-block-id="${blockId}"]`).length) {
        container.append(`
            <div class="sib-image-block-wrapper sib-loading" data-block-id="${blockId}">
                <div class="sib-header" style="opacity:0.7;">
                    <span class="sib-header-name">⏳ Генерация промта: ${blockName}...</span>
                    <span class="sib-spinner"></span>
                </div>
            </div>
        `);
    }
}

export function clearImageBlockLoading(mesId, blockId) {
    $(`.mes[mesid="${mesId}"] .sib-image-container .sib-image-block-wrapper[data-block-id="${blockId}"]`).remove();
}

export function clearImageMessageBlocks(mesId) {
    $(`.mes[mesid="${mesId}"] .sib-image-container`).empty();
}
