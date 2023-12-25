/* eslint-disable @typescript-eslint/unbound-method */
"use client";
import Head from "next/head";
import { Stage, Sprite, useTick, useApp } from "@pixi/react";
import { useEffect, useReducer, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { v4 } from "uuid";
import Vec2 from "~/utils/Vec2";
import useECS, { ComponentType, Entity } from "~/hooks/useECS";

class TransformComp {
  pos: Vec2;
  rotation: number;
  scale: Vec2;

  constructor(pos: Vec2, rotation: number, scale: Vec2) {
    this.pos = pos;
    this.rotation = rotation;
    this.scale = scale;
  }
}

class RigidBodyComp {
  mass: number;
  force: Vec2;
  velocity: Vec2;
  hasGravity: boolean;

  constructor(mass: number, force: Vec2, velocity: Vec2, hasGravity = false) {
    this.mass = mass;
    this.force = force;
    this.velocity = velocity;
    this.hasGravity = hasGravity;
  }
}

// Define a type for the state
type State = {
  x: number;
  y: number;
  rotation: number;
  anchor: number;
  mass: number;
  force: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
};

// Define a type for the action
type Action =
  | { type: "move"; dx: number; dy: number }
  | { type: "rotate"; rotation: number }
  | { type: "anchor"; anchor: number }
  | { type: "apply_forces"; tick_rate: number }
  | { type: "update"; dt: number }
  | { type: "collide_edge"; axis: "x" | "y" };

const speed = 0.01; // Speed of the bunny
const PHYSICS_TIME_STEP = 1 / 60;
const VELOCITY_DAMPING = 0.998;

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "apply_forces":
      const weight = state.mass * 9.82; // POSITIVE Y IS DOWN
      const updatedForce = state.force.add(new Vec2(0, weight));
      const updatedAcceleration = updatedForce.div(state.mass);
      const updatedVelocity = state.velocity.add(
        updatedAcceleration.mul(action.tick_rate),
      );

      return {
        ...state,
        force: new Vec2(0, 0),
        acceleration: updatedAcceleration,
        velocity: updatedVelocity.mul(0.992),
      };
    case "move":
      return {
        ...state,
        velocity: state.velocity.add(new Vec2(action.dx, action.dy)),
      };
    case "rotate":
      return { ...state, rotation: action.rotation };
    case "anchor":
      return { ...state, anchor: action.anchor };
    case "update":
      return {
        ...state,
        x: state.x + state.velocity.x,
        y: state.y + state.velocity.y,
      };
    case "collide_edge":
      const dampingFactor = 0.8;
      if (action.axis === "x") {
        return {
          ...state,
          velocity: new Vec2(
            -state.velocity.x * dampingFactor,
            state.velocity.y,
          ),
        };
      } else if (action.axis === "y") {
        let newVelocityY = -state.velocity.y * dampingFactor;

        // Threshold to stop the bunny
        if (Math.abs(newVelocityY) < 0.12) {
          newVelocityY = 0;
        }

        return {
          ...state,
          velocity: new Vec2(state.velocity.x, newVelocityY),
          // Consider resetting force or acceleration if necessary
        };
      }
      return state;
    default:
      return state;
  }
};

type BunnyProps = {
  entity: Entity;
};
const Bunny = ({ entity }: BunnyProps) => {
  const addComponent = useECS((state) => state.addComponent);
  const getComponent = useECS((state) => state.getComponent);

  const [motion, update] = useReducer(reducer, {
    x: 100,
    y: 200,
    rotation: 0,
    anchor: 0,
    mass: 1,
    force: new Vec2(0, 0),
    velocity: new Vec2(0, 0),
    acceleration: new Vec2(0, 0),
  });

  const keysPressed = useRef<Record<string, boolean>>({});

  const physicsAccumulator = useRef(0);

  const app = useApp();

  const canvasWidth = app.renderer.width;
  const canvasHeight = app.renderer.height;

  const [transform, setTransform] = useState({
    pos: new Vec2(0, 0),
    rotation: 0,
    scale: new Vec2(1, 1),
  });

  const bunnyRef = useRef<PIXI.Sprite>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    addComponent(
      TransformComp as ComponentType<TransformComp>,
      entity.id,
      new TransformComp(
        new Vec2(motion.x, motion.y),
        motion.rotation,
        new Vec2(1, 1),
      ),
    );

    addComponent(
      RigidBodyComp as ComponentType<RigidBodyComp>,
      entity.id,
      new RigidBodyComp(10, new Vec2(0, 0), new Vec2(0, 0)),
    );

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useTick((deltaTime) => {
    const transform = getComponent(
      TransformComp as ComponentType<TransformComp>,
      entity.id,
    );
    if (!transform) return;

    // transform.pos.x += 1.0 * deltaTime;

    const rigidBody = getComponent(
      RigidBodyComp as ComponentType<RigidBodyComp>,
      entity.id,
    );

    if (!rigidBody) return;

    physicsAccumulator.current += deltaTime;

    while (physicsAccumulator.current >= PHYSICS_TIME_STEP) {
      // apply forces
      if (rigidBody.hasGravity) {
        const weight = rigidBody.mass * 9.82; // POSITIVE Y IS DOWN
        rigidBody.force = rigidBody.force.add(new Vec2(0, weight));
      }

      const linearAcceleration = rigidBody.force.div(rigidBody.mass);

      // v += a * dt
      rigidBody.velocity = rigidBody.velocity.add(
        linearAcceleration.mul(PHYSICS_TIME_STEP),
      );

      // v *= damping
      rigidBody.velocity = rigidBody.velocity.mul(VELOCITY_DAMPING);

      // pos += v * dt
      transform.pos = transform.pos.add(
        rigidBody.velocity.mul(PHYSICS_TIME_STEP),
      );

      rigidBody.force = new Vec2(0, 0);

      // apply user input
      let dx = 0;
      let dy = 0;
      if (keysPressed.current.w) dy -= speed;
      if (keysPressed.current.s) dy += speed;
      if (keysPressed.current.a) dx -= speed;
      if (keysPressed.current.d) dx += speed;

      if (dx !== 0 || dy !== 0) {
        rigidBody.velocity = rigidBody.velocity.add(new Vec2(dx, dy));
      }

      console.log(rigidBody.velocity);

      //   // detect collisions

      //   if (bunnyRef.current) {
      //     const bunnyBounds = bunnyRef.current.getBounds();

      //     // Check right and left bounds
      //     if (
      //       bunnyBounds.x + bunnyBounds.width > canvasWidth ||
      //       bunnyBounds.x < 0
      //     ) {
      //       update({ type: "collide_edge", axis: "x" });
      //     }

      //     // Check bottom and top bounds
      //     if (
      //       bunnyBounds.y + bunnyBounds.height > canvasHeight ||
      //       bunnyBounds.y < 0
      //     ) {
      //       update({ type: "collide_edge", axis: "y" });
      //     }
      //   }

      //   // resolve collisions

      // decrease accumulator
      physicsAccumulator.current -= PHYSICS_TIME_STEP;
    }

    setTransform((prev) => ({ ...prev, ...transform }));
  });

  return (
    <Sprite
      ref={bunnyRef}
      image="https://pixijs.io/pixi-react/img/bunny.png"
      // {...motion}
      x={transform.pos.x}
      y={transform.pos.y}
    />
  );
};

export default function Home() {
  const createEntity = useECS((state) => state.createEntity);
  return (
    <>
      <Head>
        <title>Wolfleader101's Resume</title>
        <meta name="description" content="Resume for Wolfleader101" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-800">
        <Stage width={900} height={900} options={{ backgroundAlpha: 1 }}>
          <Bunny entity={createEntity()} />
        </Stage>
      </main>
    </>
  );
}
