"use strict";
class utils extends SystemScript {
    makeText({ text, align, justify, onClick, allowSpectatorInteraction, uniqueId, }) {
        const sprite = spriteManager.addSprite('basicText', {
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
