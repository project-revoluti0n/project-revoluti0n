
import { ISprite } from "./Sprite";

import { ISoundSprite } from "./SoundSprite"
import { transformPoints } from "../matrix/index";
import { StageInteractionManager, IStageInteractionManagerProps } from "./StageInteractionManager";
import { IInteractionPoint } from "../util/index";
import { TAU } from "../ease/consts";

export interface IStageProps extends IStageInteractionManagerProps {
  audioContext: AudioContext;
};

export interface IStage {
  addSprite(sprite: ISprite): IStage;
  removeSprite(sprite: ISprite): IStage;
  addSoundSprite(sprite: ISoundSprite): IStage;
  removeSoundSprite(sprite: ISoundSprite): IStage;
  skipAnimations(): IStage;
  update(): IStage;
  render(): IStage;
};

const sortZ = (a: ISprite, b: ISprite): number => a.position[7] - b.position[7];

export class Stage extends StageInteractionManager {
  constructor(props: IStageProps) {
    super(props);
    this.audioContext = props.audioContext;
  }
  private ctx: CanvasRenderingContext2D = this.canvas.getContext("2d");
  private sprites: ISprite[] = [];
  private soundSprites: ISoundSprite[] = [];
  private audioContext: AudioContext = null;
  
  addSprite(sprite: ISprite): IStage {
    if (!this.sprites.includes(sprite)) {
      this.sprites.push(sprite);
      super.emit("sprite-add", sprite);
    }
    return this;
  }
  removeSprite(sprite: ISprite): IStage {
    if (this.sprites.includes(sprite)) {
      const index = this.sprites.indexOf(sprite);
      this.sprites.splice(index, 1);
      super.emit("sprite-remove", sprite);
    }
    return this;
  }
  removeSoundSprite(sprite: ISoundSprite): IStage {
    if (!this.soundSprites.includes(sprite)) {
      const index = this.soundSprites.indexOf(sprite);
      this.soundSprites.splice(index, 1);
      super.emit("sound-sprite-remove", sprite);
    }
    return this;
  }
  addSoundSprite(sprite: ISoundSprite): IStage {
    if (!this.soundSprites.includes(sprite)) {
      this.soundSprites.push(sprite);
      sprite.gain.connect(this.audioContext.destination);
      super.emit("sound-sprite-add", sprite);
    }
    return this;
  }
  skipAnimations(): IStage {
    for(let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].skipAnimation();
    }
    return this;
  }
  update(): IStage {
    super.emit("pre-stage-update");
    const now: number = Date.now();

    super.emit("pre-interpolate");
    for(let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].interpolate(now);
    }
    this.sprites.sort(sortZ);
    super.emit("post-interpolate");

    super.emit("pre-collision");
    let point: IInteractionPoint, sprite: ISprite;
    for(let i = 0; i < this.sprites.length; i++) {
      sprite = this.sprites[i];
      sprite.down = false;
      sprite.clicked = false;
      sprite.hover = false;

      transformPoints(this.points, sprite.inverse);
      for(let j = 0; j < this.points.length; j++) {
        point = this.points[j];
        if (point.captured) {
          continue;
        }
        this.ctx.beginPath();
        this.ctx.arc(point.tx, point.ty, 10, 0, TAU);
        this.ctx.closePath();
        this.ctx.fill();

        if (sprite.broadPhase(point) && sprite.narrowPhase(point)) {
          sprite.pointCollision(point);
          
          if (point.clicked) {
            sprite.active = true;
          }
          break;
        }
      }
    }
    super.emit("post-collision");

    super.emit("pre-update");
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].update();
    }
    super.emit("post-update");

    super.emit("post-stage-update");
    this.cleanUp();
    return this;
  }
  cleanUp() {
    for(let i = 0; i < this.sprites.length; i++) {
      let sprite: ISprite = this.sprites[i];
      sprite.clicked = false;
    }
    super.cleanUp();
  }
  dispose() {
    super.dispose();
  }
  render(): IStage {
    super.emit("pre-render");
    let sprite: ISprite;
    let pointer: boolean = false;
    let ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for(let i = 0; i < this.sprites.length; i++) {
      sprite = this.sprites[i];
      ctx.save();
      ctx.setTransform(
        sprite.interpolatedPosition[0],
        sprite.interpolatedPosition[1],
        sprite.interpolatedPosition[2],
        sprite.interpolatedPosition[3],
        sprite.interpolatedPosition[4],
        sprite.interpolatedPosition[5],
      );
      ctx.globalAlpha = sprite.interpolatedPosition[6];
      sprite.render(ctx);
      ctx.restore();
      pointer = pointer || (sprite.hover && sprite.cursor === "pointer");
    }

    this.canvas.style.cursor = pointer ? "pointer" : "default";

    super.emit("post-render");
    return this;
  }
};