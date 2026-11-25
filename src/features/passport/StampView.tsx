import Svg, { Circle, Ellipse, G, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import type { StampSnapshot } from '@/core/domain/types';

const dash = (border: StampSnapshot['border']) => (border === 'dashed' ? '6 4' : '0');

function Outline({ s }: { readonly s: StampSnapshot }) {
  const common = { fill: 'none', stroke: s.color, strokeWidth: 4, strokeDasharray: dash(s.border) } as const;
  const inner = { fill: 'none', stroke: s.color, strokeWidth: 1.5 } as const;
  switch (s.shape) {
    case 'round':
      return (
        <G>
          <Circle cx={60} cy={60} r={55} {...common} />
          {s.border === 'double' ? <Circle cx={60} cy={60} r={47} {...inner} /> : null}
        </G>
      );
    case 'oval':
      return (
        <G>
          <Ellipse cx={60} cy={60} rx={57} ry={44} {...common} />
          {s.border === 'double' ? <Ellipse cx={60} cy={60} rx={50} ry={37} {...inner} /> : null}
        </G>
      );
    case 'hex':
      return <Polygon points="60,4 110,32 110,88 60,116 10,88 10,32" {...common} />;
    default:
      return (
        <G>
          <Rect x={6} y={18} width={108} height={84} rx={8} {...common} />
          <Rect x={13} y={25} width={94} height={70} rx={4} {...inner} />
        </G>
      );
  }
}

/** Renders a stamp from its immutable snapshot only, so old stamps never change appearance. */
export function StampView({ snapshot, size = 120, faded = false }: { readonly snapshot: StampSnapshot; readonly size?: number; readonly faded?: boolean }) {
  const title = snapshot.title.length > 16 ? `${snapshot.title.slice(0, 15)}…` : snapshot.title;
  const titleSize = title.length > 11 ? 10 : title.length > 7 ? 12 : 15;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" opacity={faded ? 0.45 : 0.92}>
      <Outline s={snapshot} />
      <SvgText x={60} y={40} fontSize={6} fontWeight="600" fill={snapshot.color} textAnchor="middle" letterSpacing={0.5}>
        {snapshot.caption}
      </SvgText>
      <SvgText x={60} y={64} fontSize={titleSize} fontWeight="800" fill={snapshot.color} textAnchor="middle">
        {title}
      </SvgText>
      <SvgText x={60} y={82} fontSize={11} fontWeight="600" fill={snapshot.color} textAnchor="middle">
        {snapshot.dateLabel}
      </SvgText>
      <SvgText x={60} y={96} fontSize={7} fill={snapshot.color} textAnchor="middle" letterSpacing={2}>
        {snapshot.code}
      </SvgText>
    </Svg>
  );
}
