import { MetroData, StationData, SubwayLineData, TrainData } from './metro';

const W = 900;
const H = 260;

export function renderSVG(met: MetroData, username: string): string {
  // Convert line points to SVG path strings ("M x,y L x,y ...")
  const pathsMap = new Map<number, string>();
  for (const line of met.lines) {
    const pts = line.points.split(' ');
    if (pts.length > 0) {
      const pathD = `M ${pts[0]} ` + pts.slice(1).map(p => `L ${p}`).join(' ');
      pathsMap.set(line.id, pathD);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
     style="border-radius:12px;overflow:hidden;background:${met.mapBgColor}">
  <defs>
    <!-- Glow filter for neon train headlights/windows and junctions -->
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Grid overlay -->
  ${renderGridPattern(met)}

  <!-- Draw Subway Lines Underlay (glowing shadow) -->
  ${met.lines.map(line => `
    <path d="${pathsMap.get(line.id) || ''}" fill="none" stroke="${line.color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.15" filter="url(#neon-glow)"/>
  `).join('\n  ')}

  <!-- Draw Subway Lines Active Track -->
  ${met.lines.map(line => `
    <path d="${pathsMap.get(line.id) || ''}" fill="none" stroke="${line.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  `).join('\n  ')}

  <!-- Moving Subway Trains along the paths -->
  ${met.trains.map(t => {
    const linePath = pathsMap.get(t.lineId) || '';
    if (!linePath) return '';
    return renderTrain(t, linePath);
  }).join('\n  ')}

  <!-- Stations mounted on top of lines -->
  ${met.stations.map(s => renderStation(s)).join('\n  ')}

  <!-- Construction Hazard blinkers if delays -->
  ${met.hasConstruction ? renderConstruction(met) : ''}

  <!-- HUD Control System Display -->
  ${renderHUD(met, username)}

  <style>${renderCSS(met)}</style>
</svg>`;
}

// ─── Grid Pattern Overlay ────────────────────────────────────
function renderGridPattern(met: MetroData): string {
  const lines: string[] = [];
  // vertical grid
  for (let x = 30; x < W; x += 30) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${met.gridLineColor}" stroke-width="0.8"/>`);
  }
  // horizontal grid
  for (let y = 25; y < H; y += 25) {
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${met.gridLineColor}" stroke-width="0.8"/>`);
  }
  return lines.join('\n  ');
}

// ─── Moving Subway Train (animated along line path) ──────────
function renderTrain(t: TrainData, pathD: string): string {
  // Train is rendered as a lead engine and trailing passenger capsule
  return `
    <g>
      <!-- Train capsule group -->
      <g>
        <animateMotion dur="${t.speed}s" repeatCount="indefinite" path="${pathD}" rotate="auto">
          <!-- Slide offset delay can be implemented via begin attribute -->
        </animateMotion>
        
        <!-- Leading train engine car -->
        <rect x="-10" y="-3" width="16" height="6" rx="1.5" fill="#ffffff" stroke="#333" stroke-width="0.5" />
        <!-- Headlight neon glow -->
        <polygon points="6,-2 15,-5 15,5 6,2" fill="rgba(255,255,255,0.4)" filter="url(#neon-glow)"/>
        
        <!-- Connected trailing coach -->
        <rect x="-24" y="-3" width="12" height="6" rx="1" fill="${t.trainColor}" stroke="#333" stroke-width="0.5" />
        <!-- Coupling link -->
        <line x1="-12" y1="0" x2="-10" y2="0" stroke="#777" stroke-width="1.5"/>
        
        <!-- Glowing coach window dots -->
        <circle cx="-20" cy="0" r="0.8" fill="#fff" filter="url(#neon-glow)"/>
        <circle cx="-16" cy="0" r="0.8" fill="#fff" filter="url(#neon-glow)"/>
      </g>
    </g>
  `;
}

// ─── Subway Station Icon Renderer ──────────────────────────
function renderStation(s: StationData): string {
  if (s.stationType === 'empty') return '';

  switch (s.stationType) {
    case 'local':
      // Tiny white cross tick perpendicular to track
      return `
        <circle cx="${s.x}" cy="${s.y}" r="2" fill="#fff" stroke="#000" stroke-width="0.5" class="station-pop"/>
      `;

    case 'standard':
      // Solid white dot with dark border
      return `
        <circle cx="${s.x}" cy="${s.y}" r="4" fill="#ffffff" stroke="#222" stroke-width="1.5" class="station-pop"/>
      `;

    case 'junction':
      // Target concentric rings indicating transfer station
      return `
        <g class="station-pop">
          <circle cx="${s.x}" cy="${s.y}" r="6" fill="#ffffff" stroke="#222" stroke-width="1.5"/>
          <circle cx="${s.x}" cy="${s.y}" r="2.5" fill="#e74c3c"/>
        </g>
      `;

    case 'terminal':
      // Large terminal icon (concentric square/rings)
      return `
        <g class="station-pop">
          <rect x="${s.x - 6}" y="${s.y - 6}" width="12" height="12" rx="2" fill="#ffffff" stroke="#222" stroke-width="1.5"/>
          <circle cx="${s.x}" cy="${s.y}" r="3" fill="#2c3e50"/>
        </g>
      `;
  }
}

// ─── Blinking Hazard/Construction Areas (Bugs warning) ──────
function renderConstruction(met: MetroData): string {
  const seed = met.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hazards: string[] = [];

  // Spawn 2 flashing warning signs on map
  for (let i = 0; i < 2; i++) {
    const activeStn = met.stations[10 + ((seed * (i + 1) * 19) % 35)];
    if (activeStn) {
      hazards.push(`
        <g transform="translate(${activeStn.x}, ${activeStn.y - 18})" class="hazard-blink">
          <!-- Warning triangle -->
          <polygon points="0,-8 -7,4 7,4" fill="#e67e22" stroke="#d35400" stroke-width="0.8"/>
          <!-- Exclamation point -->
          <rect x="-0.6" y="-4" width="1.2" height="4" fill="#fff"/>
          <circle cx="0" cy="2" r="0.8" fill="#fff"/>
        </g>
      `);
    }
  }

  return hazards.join('\n');
}

// ─── HUD Control Panel Overlay ──────────────────────────────
function renderHUD(met: MetroData, username: string): string {
  let speedIndicator = 'NOMINAL';
  let speedColor = '#2ecc71';
  if (met.efficiencyLevel === 'MINOR DELAYS') {
    speedIndicator = 'REDUCED CLK';
    speedColor = '#e67e22';
  } else if (met.efficiencyLevel === 'EXCELLENT SERVICE') {
    speedIndicator = 'OVERCLOCKED';
    speedColor = '#00afdb';
  }

  return `
  <!-- Left Side: System Banner -->
  <g>
    <rect x="8" y="8" width="220" height="22" rx="4" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.1)"/>
    <text x="14" y="22" font-family="monospace" font-size="10" fill="#fff" font-weight="bold">
      🚇 ${username} Transit Network
    </text>
  </g>

  <!-- Right Side: Status Diagnostics -->
  <g transform="translate(${W - 250}, 8)">
    <rect x="0" y="0" width="242" height="52" rx="4" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.1)"/>
    <!-- Status Line -->
    <text x="8" y="16" font-family="monospace" font-size="8" fill="#fff" opacity="0.8">SYS-STATUS: <tspan fill="${speedColor}" font-weight="bold">${met.efficiencyLevel}</tspan></text>
    <!-- Ridership -->
    <text x="8" y="30" font-family="monospace" font-size="8" fill="#fff" opacity="0.8">RIDERSHIP:  ${met.totalContributions} pass/day</text>
    <!-- Network Clock -->
    <text x="8" y="44" font-family="monospace" font-size="8" fill="#fff" opacity="0.8">NET-CLOCK:  ${speedIndicator} (${met.totalStars} Hz)</text>
  </g>
  `;
}

// ─── CSS Animations ──────────────────────────────────────────
function renderCSS(met: MetroData): string {
  return `
    /* Station pop-up zoom transitions on load */
    .station-pop {
      animation: stn-pop-in 0.8s ease-out forwards;
      transform-origin: center;
    }
    @keyframes stn-pop-in {
      from { transform: scale(0.2); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    /* Blinking warning triangles */
    .hazard-blink {
      animation: blink 1.2s ease-in-out infinite alternate;
    }
    @keyframes blink {
      0%   { opacity: 0.15; filter: brightness(0.6); }
      100% { opacity: 1; filter: brightness(1.4); }
    }
  `;
}
