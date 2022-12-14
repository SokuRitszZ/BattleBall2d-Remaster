import Ball, {BallConfig} from "./Ball";
import Game from "../../../base/Game";
import {CircleConfig, TypePosition} from "../../../types";
import Player from "../../../player/Player";
import DirectMoveUpdater from "../../../updater/move/DirectMoveUpdater";
import Collisionable from "../../../interfaces";
import C from "../../../utils/C";
import GameObject from "../../../base/GameObject";
import Shadow from "./Shadow";

class Mooney extends Ball implements Collisionable {
  hasTouch: Set<GameObject> = new Set<GameObject>();

  constructor(root: Game, parent: Player, position: TypePosition, config: BallConfig) {
    super(root, position, config);
  }

  onStart() {
    this.updaters.push(new DirectMoveUpdater(this, {
      angle: this.config.angle,
      speed: this.config.speed,
      maxLength: 20,
      disappearIfEnd: true
    }));
  }

  update() {
    super.update();
    this.checkAttacked();

    new Shadow(this.root, this.position!, {
      color: "#cccccc", radius: this.config.radius
    });
  }

  afterAttacked(params?: any): void {
    // recently touch
    this.hasTouch.add(params);
    setTimeout(() => {
      this.hasTouch.delete(params);
    }, 1000);

    // changeAngle
    let angle = this.config.angle;
    const normal = C.angle(params.position, this.position);
    const type = C.angleType(angle, normal);
    if (type === -1) { // 钝角
      const tangent = normal + Math.PI / 2;
      const newAngle = C.angleMod(tangent + tangent - angle);
      this.updaters.filter(updater => updater instanceof DirectMoveUpdater && updater.setConfig("angle", newAngle));
    }
  }


  checkAttacked(): void {
    const objs = this.root.gameObjects
      .filter(gameObject => {
        return 'afterAttacked' in gameObject
          && gameObject !== this
          && gameObject !== this.config.parent
          && !this.hasTouch.has(gameObject)
          && C.isCollision(this, gameObject as unknown as CircleConfig);
      });
    if (objs.length) {
      const obj = objs[0];
      if (obj instanceof Player) obj.HP -= this.config.damage!;
      (obj as unknown as Collisionable).afterAttacked(this);
      this.afterAttacked(obj);
      return ;
    }
  }
}

export default Mooney;