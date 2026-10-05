export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface DashboardPlayer {
  id: string;
  name: string;
  position: Position;
  rating: number;
  matches: number;
  attended: number;
  lateCancellations: number;
  noShows: number;
  wins: number;
  draws: number;
  losses: number;
  attendanceRate: number;
  ratingChange: number;
}

export interface RosterPlayer extends DashboardPlayer {
  status: 'CONFIRMED' | 'WAITLIST';
  paymentStatus: 'UNPAID' | 'PENDING_CONFIRMATION' | 'PAID';
  team: 'A' | 'B' | null;
}

export interface HistoryMatch {
  id: number;
  matchDate: string;
  scoreA: number;
  scoreB: number;
  attendance: number;
  mvp: string | null;
  roster: Array<{ name: string; position: Position; team: 'A' | 'B' | null }>;
}

export interface DashboardData {
  generatedAt: string;
  currentMatch: {
    id: number;
    date: string;
    time: string;
    location: string;
    capacity: number;
    status: 'OPEN' | 'CLOSED' | 'PLAYED' | 'CANCELLED';
    roster: RosterPlayer[];
  };
  leaderboard: DashboardPlayer[];
  history: {
    summary: {
      totalPlayed: number;
      winsA: number;
      draws: number;
      winsB: number;
      totalGoals: number;
      averageGoals: number;
      attendedPlayers: number;
      noShows: number;
    };
    matches: HistoryMatch[];
  };
}
