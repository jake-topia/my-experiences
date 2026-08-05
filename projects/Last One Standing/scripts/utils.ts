class utils extends SystemScript {
  makeText({
    spriteName = 'waitMessage',
    text,
    align,
    justify,
    onClick,
    allowSpectatorInteraction,
    uniqueId,
  }: {
    spriteName?: any;
    uniqueId?: string;
    text?: string;
    align?: 'start' | 'center' | 'end';
    justify?: 'start' | 'center' | 'end';
    onClick?: any;
    allowSpectatorInteraction?: boolean;
  }) {
    if (!playerManager.isHost) return;

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
