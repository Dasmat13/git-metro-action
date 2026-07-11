import { GitHubData } from './github';

export interface StationData {
  weekIdx:      number;
  stationType:  'local' | 'standard' | 'junction' | 'terminal' | 'empty';
  x:            number;
  y:            number;
  name:         string;
}

export interface TrainData {
  id:         number;
  lineId:     number;
  trainColor: string;
  speed:      number;
  delay:      number;
}

export interface SubwayLineData {
  id:         number;
  name:       string;
  color:      string;
  points:     string;
}

export interface MetroData {
  stations:           StationData[];
  trains:             TrainData[];
  lines:              SubwayLineData[];
  mapBgColor:         strokeColor;
  gridLineColor:      string;
  hasConstruction:    boolean;  // open issues > 20
  efficiencyLevel:    string;   // streak -> "EXCELLENT", "ON TIME", "MINOR DELAYS"
  totalStars:         number;
  totalContributions: number;
  streak:             number;
  username:           string;
}

type strokeColor = string;

const METRO_THEMES: Record<string, { bg: string, grid: string, mainLine: string, altLine: string }> = {
  JavaScript: {
    bg: '#141414', grid: 'rgba(241, 196, 15, 0.04)', mainLine: '#f1c40f', altLine: '#e67e22'
  },
  TypeScript: {
    bg: '#0c101a', grid: 'rgba(0, 210, 255, 0.04)', mainLine: '#00d2ff', altLine: '#9b59b6'
  },
  Python: {
    bg: '#0a140f', grid: 'rgba(46, 204, 113, 0.04)', mainLine: '#2ecc71', altLine: '#1abc9c'
  },
  Go: {
    bg: '#0d181c', grid: 'rgba(0, 175, 219, 0.04)', mainLine: '#00afdb', altLine: '#34495e'
  },
  Rust: {
    bg: '#1a0d0a', grid: 'rgba(231, 76, 60, 0.04)', mainLine: '#e74c3c', altLine: '#f39c12'
  }
};

const DEFAULT_THEME = {
  bg: '#1e1e24', grid: 'rgba(255,255,255,0.02)', mainLine: '#9b59b6', altLine: '#3498db'
};

export function buildMetro(data: GitHubData): MetroData {
  const theme = METRO_THEMES[data.topLanguage] || DEFAULT_THEME;
  const allMax = Math.max(...data.weeks.flatMap(w => w.map(d => d.count)), 1);

  // 1. Determine stations (52 columns -> 52 stations)
  const W = 900;
  const H = 260;
  const seed = data.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // Subway lines points layout:
  // Line 1: Main line runs left to right along the center-ish axis with some diagonal segments
  const mainLinePoints: string[] = [];
  const stations: StationData[] = [];

  for (let i = 0; i < 52; i++) {
    const x = Math.round(40 + i * ((W - 80) / 51));
    
    // Diagonal offset pathing based on week index
    let y = 130;
    if (i > 10 && i < 22) {
      y = 130 - (i - 10) * 5;  // climb up
    } else if (i >= 22 && i < 35) {
      y = 70 + (i - 22) * 6;   // descend down
    } else if (i >= 35) {
      y = 148;                 // settle straight
    }

    mainLinePoints.push(`${x},${y}`);

    const week = data.weeks[i] || [];
    const maxCount = Math.max(...week.map(d => d.count), 0);
    let stationType: StationData['stationType'] = 'empty';

    if (maxCount > 0) {
      stationType = maxCount > 8 ? 'terminal' : maxCount > 4 ? 'junction' : maxCount > 2 ? 'standard' : 'local';
    }

    stations.push({
      weekIdx: i,
      stationType,
      x,
      y,
      name: `STN-${i.toString().padStart(2, '0')}`,
    });
  }

  // Define subway lines
  const lines: SubwayLineData[] = [
    {
      id: 1,
      name: 'Main Loop Line',
      color: theme.mainLine,
      points: mainLinePoints.join(' ')
    }
  ];

  // If closed issues/PRs are present, spawn an auxiliary intersecting transfer line (Line 2)
  if (data.closedIssues > 0) {
    const crossLinePoints: string[] = [];
    const step = Math.floor(52 / Math.min(8, data.closedIssues));
    for (let i = 0; i < 52; i += step) {
      const parentStn = stations[i];
      if (parentStn) {
        // Cross line runs diagonal across the parent stations
        crossLinePoints.push(`${parentStn.x},${parentStn.y - 30}`);
        crossLinePoints.push(`${parentStn.x + 20},${parentStn.y}`);
        crossLinePoints.push(`${parentStn.x},${parentStn.y + 30}`);
      }
    }
    if (crossLinePoints.length > 0) {
      lines.push({
        id: 2,
        name: 'Exp Line',
        color: theme.altLine,
        points: crossLinePoints.join(' ')
      });
    }
  }

  // 2. Trains running on the lines
  const trains: TrainData[] = [];
  const trainCount = Math.min(6, Math.max(2, Math.floor(Math.log10(data.totalStars + 1) * 2)));
  const baseSpeed = Math.max(4, 18 - Math.min(12, Math.log10(data.totalStars + 1) * 4.5)); // speed of the train loops

  for (let i = 0; i < trainCount; i++) {
    trains.push({
      id: i,
      lineId: (i % lines.length) + 1,
      trainColor: i % 2 === 0 ? theme.mainLine : theme.altLine,
      speed: baseSpeed,
      delay: i * 2,
    });
  }

  const hasConstruction = data.openIssues > 20;
  
  let efficiencyLevel = 'NORMAL SERVICE';
  if (data.streak >= 15) efficiencyLevel = 'EXCELLENT SERVICE';
  else if (hasConstruction) efficiencyLevel = 'MINOR DELAYS';

  return {
    stations,
    trains,
    lines,
    mapBgColor: theme.bg,
    gridLineColor: theme.grid,
    hasConstruction,
    efficiencyLevel,
    totalStars: data.totalStars,
    totalContributions: data.totalContributions,
    streak: data.streak,
    username: data.username,
  };
}
