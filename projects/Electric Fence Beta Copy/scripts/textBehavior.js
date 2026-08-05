"use strict";
class textBehavior extends ComponentScript {
    padding;
    engineHeight;
    engineWidth;
    maxWrapAt;
    textAlign;
    justify;
    align;
    text;
    onClick;
    constructor({ align, justify, onClick, text, allowSpectatorInteraction, isHydration, maxWrapAt = 450, textAlign = "center", }) {
        if (isHydration)
            return;
        this.padding = 25;
        this.engineHeight = 500;
        this.engineWidth = 500;
        this.maxWrapAt = maxWrapAt;
        this.textAlign = textAlign;
        // placement on Y axis: start / center / end
        this.justify = justify;
        // placement on X axis: start / center / end
        this.align = align;
        if (onClick) {
            this.onClick = onClick;
            this.sprite.isInteractive = 1;
            this.sprite.allowSpectatorInteraction = Boolean(allowSpectatorInteraction);
        }
        this.text = text;
        this.sprite.text = text;
        // @ts-expect-error - can't yet type the way align needs
        // ie: "center" | "left" | "right"
        this.sprite.align = this.textAlign || 'center';
    }
    onInit() {
        this.positionText();
        this.sprite.opacity = 1;
    }
    updateText(text) {
        console.log("updateText", text);
        this.text = text;
        this.sprite.text = text;
        this.positionText();
    }
    positionText() {
        let newWidth = this.text.length * (this.sprite.fontSize || 12);
        if (this.maxWrapAt && newWidth > this.maxWrapAt)
            newWidth = this.maxWrapAt;
        this.sprite.width = newWidth;
        this.sprite.containerWidth = newWidth;
        let newX = 0, newY = 0;
        if (this.justify === 'start') {
            newY = this.padding;
        }
        if (this.justify === 'center') {
            newY = this.engineHeight / 2 - this.sprite.height / 2;
        }
        if (this.justify === 'end') {
            newY = this.engineHeight - this.sprite.height - this.padding;
        }
        if (this.align === 'start') {
            newX = this.padding;
        }
        if (this.align === 'center') {
            newX = this.engineWidth / 2 - this.sprite.width / 2;
        }
        if (this.align === 'end') {
            newX = this.engineWidth - this.sprite.width - this.padding;
        }
        this.sprite.position.x = newX;
        this.sprite.position.y = newY;
    }
    onClicked() {
        if (this.onClick)
            this.onClick();
    }
}
