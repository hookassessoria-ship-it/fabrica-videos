import { Easing, interpolate, useVideoConfig } from "remotion";
import { Arrow, Strike } from "../components/paper/Arrow";
import { Building, buildingGeometry, Cable } from "../components/paper/Building";
import { Cart } from "../components/paper/Cart";
import { Elevator } from "../components/paper/Elevator";
import { Label } from "../components/paper/Label";
import { Layer } from "../components/paper/Layer";
import { stepFrame, useStopMotionFrame } from "../components/paper/motion";
import { Person } from "../components/paper/Person";
import { Pop } from "../components/paper/Pop";
import type { ProductKind } from "../components/paper/Product";
import { Stairs, stairsGeometry } from "../components/paper/Stairs";
import type { Tone } from "../components/paper/tones";
import { Weight } from "../components/paper/Weight";
import { defineVisual } from "./defineVisual";

type Key = { at: number; value: number };

type TagSpec = {
  text: string;
  sub?: string;
  at?: number;
  exitAt?: number;
  x: number;
  y: number;
  tone?: Tone;
  width?: number;
  height?: number;
  // "elevator": x/y relativos ao piso da cabine.
  attach?: "elevator";
};

export type ElevatorTowerProps = {
  floors?: number;
  floorHeight?: number;
  // Centro do prédio e linha do chão, em coordenadas do palco.
  x?: number;
  groundY?: number;
  width?: number;
  shaftX?: number;
  sign?: string;
  highlightFloors?: number[];
  elevator?: {
    // Andar ao longo do tempo: [{at: seg, value: andar}]. Ou `floor` fixo.
    keys?: Key[];
    floor?: number;
    contents?: ProductKind[];
    width?: number;
    height?: number;
    display?: boolean;
  };
  // Escada dentro do prédio (corte transversal), um lance por andar.
  stairs?: {
    climber?: {
      // Progresso em lances (1 lance = 1 andar): [{at, value}]
      keys: Key[];
      tired?: boolean;
      tag?: string;
      height?: number;
    };
  };
  tags?: TagSpec[];
  arrow?: { at?: number; strikeAt?: number; x: number; y: number; angle?: number; length?: number };
  pullers?: { tag: string; at?: number; scale?: number; tone?: Tone }[];
  pullersY?: number;
  weight?: { title: string; subtitle?: string; at?: number; x: number; y: number; width?: number; height?: number };
  cart?: { floor: number; at?: number; items?: ProductKind[]; x: number; width?: number };
};

const ease = Easing.bezier(0.55, 0, 0.35, 1);

const valueAt = (keys: Key[] | undefined, fallback: number, frame: number, fps: number) => {
  if (!keys || keys.length === 0) {
    return fallback;
  }
  if (keys.length === 1) {
    return keys[0].value;
  }
  return interpolate(
    frame,
    keys.map((k) => k.at * fps),
    keys.map((k) => k.value),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
  );
};

// O prédio dos preços: andar = preço, elevador = inflação, escada = salário.
export const ElevatorTower = defineVisual<ElevatorTowerProps>(({ props, scene }) => {
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const {
    floors = 10,
    floorHeight = 90,
    x: bx = 560,
    groundY: gy = 1240,
    width = 700,
    shaftX = 180,
    sign,
    highlightFloors,
    elevator,
    stairs,
    tags = [],
    arrow,
    pullers = [],
    pullersY = 1250,
    weight,
    cart,
  } = props;
  const id = scene.id;
  const g = buildingGeometry({ floors, floorHeight, width, shaftX, shaftWidth: 220 });

  // Elevador
  const floorNow = valueAt(elevator?.keys, elevator?.floor ?? 1, frame, fps);
  const floorNext = valueAt(elevator?.keys, elevator?.floor ?? 1, frame + 2, fps);
  const speed = Math.min(1, (Math.abs(floorNext - floorNow) * (fps / 2)) / 4);
  const carW = elevator?.width ?? g.shaftWidth - 30;
  const carH = elevator?.height ?? floorHeight * 0.92;
  const carX = bx + shaftX;
  const carY = gy + g.floorY(floorNow) - 8;
  const pulleyY = gy + g.pulleyY;

  // Escada + bonequinho
  const stairsX = bx + g.stairwell.left;
  const flightWidth = g.stairwell.right - g.stairwell.left;
  const sg = stairsGeometry({ flights: floors - 1, stepsPerFlight: 6, flightWidth, flightHeight: floorHeight });
  const climberP = stairs?.climber ? valueAt(stairs.climber.keys, 0, frame, fps) : 0;
  const climberPos = sg.pointAt(climberP);
  const moving = stairs?.climber ? Math.abs(valueAt(stairs.climber.keys, 0, frame + 2, fps) - climberP) > 0.0005 : false;

  const tagNode = (t: TagSpec, i: number) => {
    const ax = t.attach === "elevator" ? carX + t.x : t.x;
    const ay = t.attach === "elevator" ? carY + t.y : t.y;
    return (
      <Pop key={`tag${i}`} seed={`${id}-tag${i}`} x={ax} y={ay} at={t.at ?? 0.4} exitAt={t.exitAt} from="right" distance={70}>
        <Label
          seed={`${id}-tag${i}`}
          text={t.text}
          sub={t.sub}
          tone={t.tone ?? "accent"}
          width={t.width ?? Math.max(240, t.text.length * 34 + 120)}
          height={t.height ?? (t.sub ? 140 : 110)}
          font="numbers"
        />
      </Pop>
    );
  };

  return (
    <>
      <Layer depth={3}>
        <g transform={`translate(${bx} ${gy})`}>
          <Building
            seed="tower"
            floors={floors}
            floorHeight={floorHeight}
            width={width}
            shaftX={shaftX}
            shaftWidth={g.shaftWidth}
            sign={sign}
            highlightFloors={highlightFloors}
            stairwell={Boolean(stairs)}
          />
        </g>
        {stairs ? (
          <g transform={`translate(${stairsX} ${gy - 7})`}>
            <Stairs seed="stairs" flights={floors - 1} stepsPerFlight={6} flightWidth={flightWidth} flightHeight={floorHeight} />
          </g>
        ) : null}
        <Cable x1={carX} y1={pulleyY} x2={carX} y2={carY - carH - 40} />
        {weight ? <Cable x1={carX + 26} y1={pulleyY} x2={weight.x} y2={weight.y + 6} /> : null}
        <g transform={`translate(${carX} ${carY})`}>
          <Elevator
            seed="car"
            width={carW}
            height={carH}
            contents={elevator?.contents}
            speed={speed}
            display={elevator?.display === false ? undefined : `${Math.round(floorNow)}`}
          />
        </g>
        {stairs?.climber ? (
          <g transform={`translate(${stairsX + climberPos.x} ${gy - 7 + climberPos.y})`}>
            <Person
              seed={`${id}-climber`}
              height={stairs.climber.height ?? floorHeight * 0.8}
              pose={moving ? "climb" : "stand"}
              phase={stepFrame(frame, 4) * 0.5}
              facing={climberPos.facing}
              tired={stairs.climber.tired}
              tag={stairs.climber.tag}
              tagScale={0.8}
            />
          </g>
        ) : null}
        {cart ? (
          <Pop seed={`${id}-cart`} x={cart.x} y={gy + g.floorY(cart.floor) - 8} at={cart.at ?? 0.3} from="above" distance={60}>
            <Cart seed={`${id}-cart`} width={cart.width ?? 150} items={cart.items} />
          </Pop>
        ) : null}
        {tags.filter((t) => t.attach === "elevator").map(tagNode)}
      </Layer>

      <Layer depth={4}>
        {tags.filter((t) => t.attach !== "elevator").map(tagNode)}
        {arrow ? (
          <Pop seed={`${id}-arrow`} x={arrow.x} y={arrow.y} at={arrow.at ?? 0.5} from="above">
            <Arrow seed={`${id}-arrow`} angle={arrow.angle ?? 90} length={arrow.length ?? 260} thickness={64} tone="light" />
            {arrow.strikeAt !== undefined ? (
              <>
                <Strike
                  seed={`${id}-strike1`}
                  length={330}
                  angle={-40}
                  progress={interpolate(frame, [arrow.strikeAt * fps, (arrow.strikeAt + 0.25) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                />
                <Strike
                  seed={`${id}-strike2`}
                  length={330}
                  angle={40}
                  progress={interpolate(frame, [(arrow.strikeAt + 0.3) * fps, (arrow.strikeAt + 0.55) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                />
              </>
            ) : null}
          </Pop>
        ) : null}
        {pullers.map((p, i) => {
          const spacing = 112;
          const x0 = 90 + i * spacing;
          return (
            <Pop key={`pl${i}`} seed={`${id}-pl${i}`} x={x0} y={pullersY} at={p.at ?? 0.4 + i * 0.45} from="left" distance={80}>
              <Person
                seed={`${id}-pl${i}`}
                height={150 * (p.scale ?? 1)}
                pose="pull"
                phase={stepFrame(frame, 6) * 0.35 + i}
                facing={1}
                tag={p.tag}
                tagTone={p.tone ?? "accent"}
                tagScale={0.72 * (p.scale ?? 1)}
              />
            </Pop>
          );
        })}
        {weight ? (
          <Pop seed={`${id}-weight`} x={weight.x} y={weight.y} at={weight.at ?? 0.5} from="above" distance={160}>
            <Weight seed={`${id}-weight`} title={weight.title} subtitle={weight.subtitle} width={weight.width} height={weight.height} />
          </Pop>
        ) : null}
      </Layer>
    </>
  );
});
