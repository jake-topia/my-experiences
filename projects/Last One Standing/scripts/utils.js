"use strict";
class utils extends SystemScript {
    makeText({ spriteName = 'waitMessage', text, align, justify, onClick, allowSpectatorInteraction, uniqueId, }) {
        if (!playerManager.isHost)
            return;
        const sprite = spriteManager.addSprite(spriteName, {
            displayLayer: 'top',
            text,
            uniqueId,
            opacity: 0,
        });
        sprite.attachComponent({
            scriptId: 'textBehavior',
            props: {
                text,
                align,
                justify,
                onClick,
                allowSpectatorInteraction,
            },
        });
        return sprite;
    }
}
