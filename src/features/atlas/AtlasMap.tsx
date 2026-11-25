import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Chip, spacing, useTheme } from '@/design-system';
import type { GeoRegion } from '@/engines/atlas-engine/dataset';
import { projectRegions } from '@/engines/atlas-engine/paths';
import type { Projection } from '@/engines/atlas-engine/projection';

type Box = [number, number, number, number];

export interface AtlasMapProps {
  readonly regions: readonly GeoRegion[];
  readonly projection: Projection;
  readonly visited: ReadonlyMap<string, number>;
  readonly selected: string | null;
  readonly onSelect: (code: string) => void;
  readonly aspect?: number;
  readonly accessibilityLabel: string;
}

const MIN_ZOOM_W = 40;

/** Offline SVG atlas with drag, wheel/button zoom and tap-to-select. Remount (key) to reset the view. */
export function AtlasMap({ regions, projection, visited, selected, onSelect, aspect, accessibilityLabel }: AtlasMapProps) {
  const { colors } = useTheme();
  const map = useMemo(() => projectRegions(regions, projection), [regions, projection]);
  const full = useMemo<Box>(() => [map.viewBox[0], map.viewBox[1], map.viewBox[2], map.viewBox[3]], [map]);
  const [box, setBox] = useState<Box>(full);
  const [width, setWidth] = useState(1);
  const drag = useRef<{ x: number; y: number; box: Box } | null>(null);
  const moved = useRef(false);
  const host = useRef<unknown>(null);
  const ratio = aspect ?? full[3] / full[2];

  const clamp = useCallback(
    (b: Box): Box => {
      const w = Math.min(full[2], Math.max(MIN_ZOOM_W, b[2]));
      const h = (w * full[3]) / full[2];
      const x = Math.min(full[2] - w, Math.max(0, b[0]));
      const y = Math.min(full[3] - h, Math.max(0, b[1]));
      return [x, y, w, h];
    },
    [full],
  );
  const zoom = useCallback(
    (factor: number, cx = 0.5, cy = 0.5) =>
      setBox((b) => {
        const w = b[2] * factor;
        const h = b[3] * factor;
        return clamp([b[0] + (b[2] - w) * cx, b[1] + (b[3] - h) * cy, w, h]);
      }),
    [clamp],
  );

  // Drag to pan (touch and mouse). Small movements still count as taps on a region.
  const responder = {
    onStartShouldSetResponderCapture: (e: GestureResponderEvent) => {
      // Remember where the touch began without claiming it, so taps still reach the regions.
      drag.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, box };
      return false;
    },
    onMoveShouldSetResponderCapture: (e: GestureResponderEvent) => {
      if (!drag.current) return false;
      return Math.abs(e.nativeEvent.pageX - drag.current.x) + Math.abs(e.nativeEvent.pageY - drag.current.y) > 6;
    },
    onResponderGrant: () => {
      moved.current = true;
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const d = drag.current;
      if (!d) return;
      const k = d.box[2] / width;
      setBox(clamp([d.box[0] - (e.nativeEvent.pageX - d.x) * k, d.box[1] - (e.nativeEvent.pageY - d.y) * k, d.box[2], d.box[3]]));
    },
    onResponderRelease: () => {
      drag.current = null;
      setTimeout(() => (moved.current = false), 50);
    },
    onResponderTerminate: () => {
      drag.current = null;
      moved.current = false;
    },
  };

  // Desktop: mouse wheel / trackpad zoom around the cursor.
  useEffect(() => {
    const el = host.current as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    const onUp = () => {
      drag.current = null;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerup', onUp);
    };
  }, [zoom]);

  const stroke = Math.max(0.15, box[2] / 1400);
  return (
    <View style={styles.wrap}>
      <View
        ref={host as never}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width || 1)}
        style={[styles.map, { aspectRatio: 1 / ratio, backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityLabel={accessibilityLabel}
        {...responder}
      >
        <Svg width="100%" height="100%" viewBox={box.join(' ')} preserveAspectRatio="xMidYMid meet">
          {map.regions.map((r) => {
            const isSel = r.code === selected;
            const isVisited = visited.has(r.code);
            return (
              <Path
                key={r.code}
                d={r.d}
                fill={isSel ? colors.accent : isVisited ? colors.visited : colors.unvisited}
                stroke={colors.border}
                strokeWidth={isSel ? stroke * 3 : stroke}
                onPress={() => {
                  if (!moved.current) onSelect(r.code);
                }}
              />
            );
          })}
        </Svg>
      </View>
      <View style={styles.controls}>
        <Chip label="Phóng to +" selected={false} onPress={() => zoom(1 / 1.5)} />
        <Chip label="Thu nhỏ −" selected={false} onPress={() => zoom(1.5)} />
        <Chip label="Toàn cảnh" selected={false} onPress={() => setBox(full)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  map: { width: '100%', maxHeight: 640, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden', cursor: 'grab' } as never,
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
