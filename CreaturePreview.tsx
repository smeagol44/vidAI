import {mouthDimensions} from './mouthGeometry';
import {getPartCornerVertices, getOrganAnchor, getCardinalOutwardNormal, restSegments, type Genome} from './simulation';

export default function CreaturePreview({genome: g}: {genome: Genome}) {
  const segments = restSegments(g.parts);
  const points = g.parts.map((p, i) => getPartCornerVertices(segments[i], p));
  const mouths = g.mouths.map(mouth => {
    const p = g.parts[mouth.partIndex], s = segments[mouth.partIndex];
    const a = getOrganAnchor(mouth, p.width, p.height), n = getCardinalOutwardNormal(mouth.direction);
    const c = Math.cos(s.angle), sn = Math.sin(s.angle), {radius, halfSpan} = mouthDimensions(mouth);
    const x = s.x + c * a.x - sn * a.y, y = s.y + sn * a.x + c * a.y;
    const tx = -c * n.y - sn * n.x, ty = -sn * n.y + c * n.x;
    return {id: mouth.id, radius, x1: x - tx * halfSpan, y1: y - ty * halfSpan, x2: x + tx * halfSpan, y2: y + ty * halfSpan};
  });
  const flat = [...points.flat(), ...mouths.flatMap(m => [
    {x: Math.min(m.x1, m.x2) - m.radius, y: Math.min(m.y1, m.y2) - m.radius},
    {x: Math.max(m.x1, m.x2) + m.radius, y: Math.max(m.y1, m.y2) + m.radius}])];
  const xs = flat.map(p => p.x), ys = flat.map(p => p.y);
  const left = Math.min(...xs) - 10, top = Math.min(...ys) - 10;
  const width = Math.max(...xs) - left + 10, height = Math.max(...ys) - top + 10;
  return <svg viewBox={`${left} ${top} ${width} ${height}`} className="w-14 h-12 shrink-0" aria-label={`${g.name} body preview`}>
    {points.map((corners, i) => <polygon key={g.parts[i].id} points={corners.map(p => `${p.x},${p.y}`).join(' ')}
      fill={`hsl(${g.hue},${g.saturation}%,${g.lightness}%)`} stroke="#cffafe" strokeWidth="1" />)}
    {mouths.map(m => <line key={m.id} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
      stroke="#fb7185" strokeWidth={2 * m.radius} strokeLinecap="round" />)}
    {g.eyes.map(organ => {
      const p = g.parts[organ.partIndex], s = segments[organ.partIndex], a = getOrganAnchor(organ, p.width, p.height);
      const x = s.x + Math.cos(s.angle) * a.x - Math.sin(s.angle) * a.y;
      const y = s.y + Math.sin(s.angle) * a.x + Math.cos(s.angle) * a.y;
      const scale = organ.slot === undefined ? 1 : Math.min(1, (organ.direction === 'NORTH' || organ.direction === 'SOUTH' ? p.width : p.height) / 30);
      return <circle key={`${'mouthType' in organ ? 'mouth' : 'eye'}:${organ.id}`} cx={x} cy={y} r={3 * scale} fill={'mouthType' in organ ? '#fb7185' : '#fff'} />;
    })}
  </svg>;
}
