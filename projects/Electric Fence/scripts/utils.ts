class utils extends SystemScript {
  makeText({
    text,
    align,
    justify,
    onClick,
    allowSpectatorInteraction,
    uniqueId,
  }: {
    uniqueId?: string;
    text?: string;
    align?: "start" | "center" | "end";
    justify?: "start" | "center" | "end";
    onClick?: any;
    allowSpectatorInteraction?: boolean;
  }) {
    const sprite = spriteManager.addSprite("text", {
      displayLayer: "top",
      text,
      uniqueId,
      opacity: 0,
      containerWidth: undefined,
    });
    sprite.attachComponent({
      scriptId: "textBehavior",
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
