import { Easing, interpolate, useVideoConfig } from "remotion";
import { useTheme } from "../brand/theme";
import { Arrow } from "../components/paper/Arrow";
import { Cart, cartGeometry } from "../components/paper/Cart";
import { Label } from "../components/paper/Label";
import { Layer } from "../components/paper/Layer";
import { useStopMotionFrame } from "../components/paper/motion";
import { PaperCard } from "../components/paper/PaperCard";
import { Pop } from "../components/paper/Pop";
import type { ProductKind } from "../components/paper/Product";
import { Wordmark } from "../components/paper/Wordmark";
import { defineVisual } from "./defineVisual";

// ---------------------------------------------------------------- CartTag

type CartTagProps = {
  price: string;
  sub?: string;
  items?: ProductKind[];
  tagAt?: number;
  // Carrinho sai de cena (rola pra direita) neste segundo.
  leaveAt?: number;
};

const CART_W = 520;

export const CartTag = defineVisual<CartTagProps>(({ props, scene }) => {
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const { price, sub, items = ["rice", "milk", "beans"], tagAt = 0.9, leaveAt } = props;
  const groundY = 1180;
  const enter = interpolate(frame, [0, 0.8 * fps], [-420, 500], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1.05),
  });
  const leave =
    leaveAt === undefined
      ? 0
      : interpolate(frame, [leaveAt * fps, (leaveAt + 0.7) * fps], [0, 900], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.quad),
        });
  const x = enter + leave;
  const g = cartGeometry(CART_W);
  const tagX = 640;
  const tagY = 560;
  return (
    <Layer depth={3}>
      <g transform={`translate(${x} ${groundY})`}>
        <Cart seed={`${scene.id}-cart`} width={CART_W} items={items} wheelTurn={x * 0.9} />
      </g>
      <Pop seed={`${scene.id}-price`} x={tagX + leave} y={tagY} at={tagAt} from="above" rotate={-8} maxTilt={3}>
        <Label
          seed={`${scene.id}-price`}
          text={price}
          sub={sub}
          width={640}
          height={260}
          size={118}
          string={{ dx: x + g.topRight.x - (tagX + leave) + 80, dy: groundY + g.topRight.y - tagY }}
        />
      </Pop>
    </Layer>
  );
});

// ---------------------------------------------------------------- EndCard

type EndCardProps = {
  headline?: string;
  cta?: string;
};

export const EndCard = defineVisual<EndCardProps>(({ props, scene }) => {
  const { brand } = useTheme();
  const { headline, cta = brand.cta } = props;
  return (
    <>
      <Layer depth={3}>
        {headline ? (
          <Pop seed={`${scene.id}-hl`} x={540} y={470} at={0.15} from="above">
            <PaperCard seed={`${scene.id}-hl`} width={860} height={200} tone="paper" title={headline} titleSize={54} maxChars={26} />
          </Pop>
        ) : null}
        <Pop seed={`${scene.id}-wm`} x={540} y={760} at={0.4} from="below" distance={120}>
          <Wordmark seed={`${scene.id}-wm`} />
        </Pop>
      </Layer>
      <Layer depth={4}>
        <Pop seed={`${scene.id}-cta`} x={560} y={1040} at={0.9} from="right" rotate={-3}>
          <Label seed={`${scene.id}-cta`} text={cta} width={cta.length * 38 + 150} height={130} font="text" size={58} />
        </Pop>
        <Pop seed={`${scene.id}-arrow`} x={540} y={1190} at={1.3} from="above" distance={50}>
          <Arrow seed={`${scene.id}-arrow`} angle={90} length={150} thickness={46} tone="light" />
        </Pop>
      </Layer>
    </>
  );
});
