import GameObject from "./GameObject";
import GameMap from "../map/GameMap";
import G from "../utils/G";
import {GameMapConfig, ModeEnum, TypePosition} from "../types";
import Player from "../player/Player";
import {UserInfo} from "../../../store/user";
import AIPlayer from "../player/AIPlayer";
import pubsub from "pubsub-js";
import {sendMessage} from "../../../store/websocket";

export const tagSendAct = "tagSendAct";
export const tagReceiveAct = "tagReceivedAct";

class Game {
  $parent: HTMLDivElement;
  $canvas: HTMLCanvasElement;
  gameObjects: GameObject[] = [];
  players: Player[] = [];
  screenConfig: GameMapConfig;
  gameMap: GameMap;
  scale: number = 0;
  engine: number = -1;

  hasStarted: Boolean;

  lastTimeStep: number = 0;
  cursorPosition: TypePosition = null;
  mode: ModeEnum = "unknown";
  resizeInterval: NodeJS.Timer | null = null;

  private handlers: any[] = [];

  constructor($parent: HTMLDivElement, $canvas: HTMLCanvasElement) {
    this.$parent = $parent;

    this.$canvas = $canvas;
    G.context = $canvas.getContext("2d")!;

    this.screenConfig = {
      widthRatio: 16,
      heightRatio: 9
    };
    this.gameMap = new GameMap(this, {
      widthRatio: 16,
      heightRatio: 9
    });
    this.resize();
    this.resetScale();
    this.initEventListener();

    this.hasStarted = false;
  }

  addObject(gameObject: GameObject) {
    this.gameObjects.push(gameObject);
  }

  removeObject(removedGameObject: GameObject) {
    this.gameObjects = this.gameObjects.filter(gameObject => gameObject !== removedGameObject);
  }

  addPlayer(user: UserInfo, isOperated?: boolean, isAI?: boolean) {
    if (isAI) {
      new AIPlayer(this, {
        x: this.screenConfig.widthRatio / 2,
        y: this.screenConfig.heightRatio / 2
      }, {
        maxHP: 100,
        headIcon: G.randomPicUrl(),
        radius: 0.5,
        speed: 1,
        isOperated: false
      });
    } else {
      const player = new Player(this, {
        x: this.screenConfig.widthRatio / 2,
        y: this.screenConfig.heightRatio / 2
      }, {
        maxHP: 100,
        headIcon: user!.headIcon,
        radius: 0.5,
        speed: 1,
        isOperated: isOperated || false
      });
      if (user.nanoid) player.nanoid = user.nanoid;
    }
  }

  start(mode: ModeEnum) {
    if (this.hasStarted)
      throw new Error("This Game has been started.");
    this.hasStarted = true;
    this.mode = mode;

    if (this.mode === "single") {
      for (let i = 0; i < 5; ++i) {
        this.addPlayer({
          id: 0, username: "",
          headIcon: G.randomPicUrl()
        }, false, true);
      }
    }

    pubsub.subscribe(tagSendAct, (tg, data) => {
      const {callback} = data;
      if (this.mode === "multi")
        sendMessage({
          service: "game",
          data
        });
      else callback();
    });
    pubsub.subscribe(tagReceiveAct, (tg, data) => {
      this.findAndAct(data.nanoid, data.act, data.args);
    });

    const engine = (lastTimeStep: number) => {
      this.gameObjects.forEach(gameObject => {
        if (gameObject.hasStarted) {
          gameObject.deltaTime = lastTimeStep - this.lastTimeStep;
          gameObject.update();
        } else {
          gameObject.hasStarted ? gameObject.update() : gameObject.start()
        }
      });
      this.lastTimeStep = lastTimeStep;
      window.requestAnimationFrame(engine);
    };
    this.engine = window.requestAnimationFrame(engine);
  }

  findAndAct(nanoid: string, act: string, args: any[]) {
    const obj: any = this.gameObjects.filter(gameObject => gameObject.nanoid === nanoid)[0];
    try {
      obj[act](...args, false);
    } catch (e) {}
  }

  stop() {
    pubsub.unsubscribe(tagSendAct);
    pubsub.unsubscribe(tagReceiveAct);
    this.gameObjects.forEach(gameObject => gameObject.destroy());
    window.cancelAnimationFrame(this.engine);
    window.clearInterval(this.resizeInterval!);
  }

  // @MARK: Private Methods

  private initEventListener() {
    this.addEventListener();
    this.preventContextMenu();
  }

  private addEventListener() {
    // resize
    this.resizeInterval = setInterval(() => {
      this.resetScale()
      this.resize();
    }, 200);

    // mousemove
    this.handlers.push([this.$canvas, "mousemove", (e: MouseEvent) => {
      this.cursorPosition = {
        x: e.offsetX / this.scale,
        y: e.offsetY / this.scale
      }
    }]);
    this.handlers.forEach(([target, type, event]) => {
      target.addEventListener(type, event);
    });
  }

  private preventContextMenu() {
    this.$canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  private resize() {
    const rect = this.$parent;
    const width = window.innerWidth * 11 / 12;
    const height = window.innerHeight * 5 / 6;
    const {widthRatio, heightRatio} = this.screenConfig;
    const scale = Math.min(width / widthRatio, height / heightRatio);
    rect.style.width = `${Math.floor(scale * widthRatio)}px`;
    rect.style.height = `${Math.floor(scale * heightRatio)}px`;
  }

  private resetScale() {
    const c = G.context;
    const rect = this.$parent;
    c.canvas.width = rect.clientWidth;
    c.canvas.height = rect.clientHeight;
    const {width, height} = c.canvas;
    this.scale = Math.min(
      width / this.screenConfig.widthRatio,
      height / this.screenConfig.heightRatio
    );
  }
}

export default Game;