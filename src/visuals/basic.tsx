import { mix } from "../brand/color";
import { useTheme } from "../brand/theme";
import { Bars, type BarDatum } from "../components/paper/Bars";
import { Cut } from "../components/paper/Cut";
import { Layer } from "../components/paper/Layer";
import { PaperCard } from "../components/paper/PaperCard";
import { PaperText } from "../components/paper/PaperText";
import { Pop } from "../components/paper/Pop";
import { roughCircle, roughRect } from "../components/paper/shapes";
import { Stamp, useImpactShake } from "../components/paper/Stamp";
import type { Tone } from "../components/paper/tones";
import { defineVisual } from "./defineVisual";

// ---------------------------------------------------------------- TitleCard

type TitleCardProps = {
  title: string;
  subtitle?: string;
  kicker?: string;
  tone?: Tone;
};

export const TitleCard = defineVisual<TitleCardProps>(({ props, scene }) => {
  const { title, subtitle, kicker, tone = "raised" } = props;
  const lines = Math.ceil(title.length / 14);
  const h = 170 + lines * 100 + (subtitle ? 90 : 0);
  return (
    <Layer depth={3}>
      {kicker ? (
        <Pop seed={`${scene.id}-kick`} x={540} y={720 - h / 2 - 70} at={0.1} from="above">
          <PaperCard seed={`${scene.id}-kick`} width={kicker.length * 26 + 90} height={78} tone="accent" title={kicker} titleSize={36} />
        </Pop>
      ) : null}
      <Pop seed={`${scene.id}-title`} x={540} y={720} at={0.25}>
        <PaperCard
          seed={`${scene.id}-title`}
          width={880}
          height={h}
          tone={tone}
          title={title}
          titleSize={92}
          maxChars={14}
          subtitle={subtitle}
          titleY={subtitle ? -45 : 0}
          subtitleY={h / 2 - 75}
          tape
        />
      </Pop>
    </Layer>
  );
});

// ---------------------------------------------------------------- Versus (placar)

type Side = {
  title: string;
  subtitle?: string;
  value?: string;
  tone?: Tone;
};

type VersusProps = {
  header?: string;
  left: Side;
  right: Side;
  vs?: string;
};

export const Versus = defineVisual<VersusProps>(({ props, scene }) => {
  const { c } = useTheme();
  const { header, left, right, vs = "VS" } = props;
  const side = (s: Side, x: number, at: number, k: string, tone: Tone) => (
    <Pop seed={`${scene.id}-${k}`} x={x} y={760} at={at} from="below">
      <PaperCard
        seed={`${scene.id}-${k}`}
        width={410}
        height={s.value ? 560 : 430}
        tone={s.tone ?? tone}
        title={s.title}
        titleFont="numbers"
        titleSize={56}
        titleY={s.value ? -170 : -40}
        subtitle={s.subtitle}
        subtitleSize={36}
        subtitleY={s.value ? -90 : 70}
        maxChars={14}
        tape
      >
        {s.value ? (
          <PaperText text={s.value} y={100} size={124} font="numbers" weight={700} color={c.text} />
        ) : null}
      </PaperCard>
    </Pop>
  );
  return (
    <>
      <Layer depth={3}>
        {header ? (
          <Pop seed={`${scene.id}-hdr`} x={540} y={380} at={0.1} from="above">
            <PaperCard seed={`${scene.id}-hdr`} width={header.length * 30 + 120} height={100} tone="paper" title={header} titleSize={46} />
          </Pop>
        ) : null}
        {side(left, 290, 0.3, "l", "raised")}
        {side(right, 790, 0.6, "r", "accent")}
      </Layer>
      <Layer depth={4}>
        <Pop seed={`${scene.id}-vs`} x={540} y={760} at={0.9} from="none" maxTilt={8}>
          <Cut depth={4}>
            <path d={roughCircle(0, 0, 78, `${scene.id}-vsc`)} fill={c.paperRaised} />
            <PaperText text={vs} size={60} font="numbers" weight={700} color={c.accentLight} />
          </Cut>
        </Pop>
      </Layer>
    </>
  );
});

// ---------------------------------------------------------------- StampSlam

type StampSlamProps = {
  stamp: string;
  sub?: string;
  at?: number;
  docTitle?: string;
};

export const StampSlam = defineVisual<StampSlamProps>(({ props, scene }) => {
  const { c } = useTheme();
  const { stamp, sub, at = 1.1, docTitle } = props;
  const shake = useImpactShake(at);
  const lines = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <g transform={`translate(${shake.x} ${shake.y})`}>
      <Layer depth={3}>
        <Pop seed={`${scene.id}-doc`} x={540} y={740} at={0.1} from="below" maxTilt={2.5}>
          <PaperCard seed={`${scene.id}-doc`} width={760} height={900} tone="light" tape>
            {docTitle ? <PaperText text={docTitle} y={-340} size={48} weight={800} color={c.ink} /> : null}
            {lines.map((i) => (
              <path
                key={i}
                d={roughRect(-300, -250 + i * 62, i % 3 === 2 ? 380 : 600, 16, `${scene.id}-ln${i}`, { radius: 6, wobble: 1 })}
                fill={mix(c.lightPaper, c.ink, 0.22)}
              />
            ))}
          </PaperCard>
        </Pop>
      </Layer>
      <Layer depth={4}>
        <g transform="translate(540 820)">
          <Stamp seed={`${scene.id}-stamp`} text={stamp} sub={sub} at={at} />
        </g>
      </Layer>
    </g>
  );
});

// ---------------------------------------------------------------- BarChart

type BarChartProps = {
  title?: string;
  data: BarDatum[];
  at?: number;
  stagger?: number;
  max?: number;
};

export const BarChart = defineVisual<BarChartProps>(({ props, scene }) => {
  const { title, data, at = 0.4, stagger = 0.42, max } = props;
  return (
    <>
      {title ? (
        <Layer depth={3}>
          <Pop seed={`${scene.id}-t`} x={540} y={330} at={0.1} from="above">
            <PaperCard seed={`${scene.id}-t`} width={Math.min(940, title.length * 30 + 120)} height={104} tone="paper" title={title} titleSize={46} />
          </Pop>
        </Layer>
      ) : null}
      <Layer depth={3}>
        <g transform="translate(95 1130)">
          <Bars seed={`${scene.id}-bars`} data={data} width={890} height={640} at={at} stagger={stagger} max={max} />
        </g>
      </Layer>
    </>
  );
});
