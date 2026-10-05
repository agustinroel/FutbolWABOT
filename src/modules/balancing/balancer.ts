export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface BalancePlayer {
  id: string;
  name: string;
  position: Position;
  rating: number;
}

export interface BalancedTeams {
  teamA: BalancePlayer[];
  teamB: BalancePlayer[];
  averageA: number;
  averageB: number;
  ratingDelta: number;
}

const positionWeights: Record<Position, number> = { GK: 4, DEF: 3, MID: 1.5, FWD: 2 };

function teamRating(players: BalancePlayer[]): number {
  return players.reduce((total, player) => total + player.rating, 0) / players.length;
}

function scorePartition(teamA: BalancePlayer[], teamB: BalancePlayer[]): number {
  const ratingDifference = Math.abs(teamRating(teamA) - teamRating(teamB));
  const positionDifference = (['GK', 'DEF', 'MID', 'FWD'] as const).reduce((total, position) => {
    const countA = teamA.filter((player) => player.position === position).length;
    const countB = teamB.filter((player) => player.position === position).length;
    return total + Math.abs(countA - countB) * positionWeights[position];
  }, 0);
  return positionDifference * 10 + ratingDifference;
}

export function balanceTeams(players: BalancePlayer[]): BalancedTeams {
  if (players.length < 2 || players.length % 2 !== 0) {
    throw new Error('Para armar equipos se necesita un número par de al menos 2 jugadores.');
  }
  if (players.some((player) => !Number.isFinite(player.rating) || player.rating < 1 || player.rating > 10)) {
    throw new Error('Todos los jugadores deben tener un rating válido entre 1 y 10.');
  }

  const ordered = [...players].sort((left, right) => left.id.localeCompare(right.id));
  const teamSize = ordered.length / 2;
  let bestA: BalancePlayer[] | undefined;
  let bestB: BalancePlayer[] | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  function search(index: number, teamA: BalancePlayer[], teamB: BalancePlayer[]): void {
    if (teamA.length > teamSize || teamB.length > teamSize) return;
    if (index === ordered.length) {
      if (teamA.length !== teamSize || teamB.length !== teamSize) return;
      const score = scorePartition(teamA, teamB);
      if (score < bestScore) {
        bestScore = score;
        bestA = [...teamA];
        bestB = [...teamB];
      }
      return;
    }

    const player = ordered[index];
    if (!player) return;
    if (index === 0 || teamA.length < teamSize) search(index + 1, [...teamA, player], teamB);
    if (index > 0 && teamB.length < teamSize) search(index + 1, teamA, [...teamB, player]);
  }

  search(0, [], []);
  if (!bestA || !bestB) throw new Error('No se pudo construir una partición válida de equipos.');

  const averageA = teamRating(bestA);
  const averageB = teamRating(bestB);
  return { teamA: bestA, teamB: bestB, averageA, averageB, ratingDelta: Math.abs(averageA - averageB) };
}
