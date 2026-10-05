export interface RosterDisplayPlayer {
  name: string;
}

export interface PlayerDirectoryDisplayEntry {
  name: string;
  position: string;
  rating: number;
  matches: number;
  attendanceRate: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface MatchHistoryDisplay {
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
  recent: Array<{
    matchDate: string;
    scoreA: number;
    scoreB: number;
    attendance: number;
    mvp: string | null;
  }>;
}

export function formatCard(title: string, lines: string[]): string {
  return [`*⚽ ${title}*`, '━━━━━━━━━━━━━━', ...lines].join('\n');
}

export function formatRoster(
  confirmed: RosterDisplayPlayer[],
  waitlist: RosterDisplayPlayer[],
  capacity: number,
  matchDate?: string,
  matchStatus?: string
): string {
  const heading = matchDate ? `*Convocatoria · Jueves ${matchDate}*` : '*Convocatoria*';
  const status = matchStatus === 'OPEN' ? '🟢 Abierta' :
    matchStatus === 'CLOSED' ? '🔒 Cerrada' :
      matchStatus === 'CANCELLED' ? '⛔ Cancelada' : undefined;
  const confirmedLines = confirmed.length
    ? confirmed.map((player, index) => `${String(index + 1).padStart(2, '0')}  ${player.name}`)
    : ['_Todavía no hay convocados._'];
  const waitlistLines = waitlist.length
    ? waitlist.map((player, index) => `${String(index + 1).padStart(2, '0')}  ${player.name}`)
    : ['_Sin suplentes por ahora._'];

  return [
    heading,
    '━━━━━━━━━━━━━━',
    ...(status ? [status] : []),
    '',
    `*🟢 CONVOCADOS · ${confirmed.length}/${capacity}*`,
    ...confirmedLines,
    '',
    `*🟠 SUPLENTES · ${waitlist.length}*`,
    ...waitlistLines
  ].join('\n');
}

export function formatHelp(isAdmin: boolean): string {
  const playerCommands = [
    '*👟 JUGADORES*',
    '`/voy` o `+1` — apuntarme al partido',
    '`/mebajo` o `-1` — darme de baja',
    '`/lista` — ver convocados y suplentes',
    '`/jugadores` — ver perfiles y estadísticas básicas de todos',
    '`/historial [1-20]` — resumen y últimos resultados de partidos',
    '`/plantilla` — alias de `/jugadores`',
    '`/perfil <GK|DEF|MID|FWD> <1-10>` — configurar mi posición y nivel',
    '`/pague` — avisar de que he pagado',
    '`/stats [@jugador]` — consultar estadísticas',
    '`/mvp @jugador` — votar MVP (2 h tras registrar el resultado)',
    '`/ayuda` — mostrar esta ayuda',
    '`/id` — mostrar el ID de este grupo'
  ];
  if (!isAdmin) return formatCard('COMANDOS MONTEMAR', playerCommands);

  return formatCard('COMANDOS MONTEMAR · ADMIN', [
    ...playerCommands,
    '',
    '*🛡️ ADMINISTRACIÓN*',
    '`/convocar @jugador` — añadir a la convocatoria',
    '`/retirar @jugador` — retirar y promocionar al siguiente suplente',
    '`/armar_equipos` — equilibrar equipos y guardar su composición',
    '`/pagado @jugador` — confirmar un pago',
    '`/deudores` — publicar los pagos pendientes',
    '`/reset_pagos` — reiniciar los pagos del partido',
    '`/cerrar` — cerrar la convocatoria',
    '`/resultado <A>-<B>` — registrar resultado y actualizar ratings',
    '`/nuevo_partido` — alias de `/abrir_convocatoria`',
    '`/abrir_convocatoria` — abrir el jueves que corresponda según la fecha actual',
    '`/cancelar_convocatoria CONFIRMAR` — cancelar el partido y vaciar la convocatoria',
    '`/borrar_partido AAAA-MM-DD CONFIRMAR` — eliminar partido de prueba y sus datos',
    '`/no_show @jugador` — marcar una ausencia del último partido',
    '`/registrar_jugador <teléfono> <posición> <rating> <nombre>`'
  ]);
}

export function formatPlayerDirectory(players: PlayerDirectoryDisplayEntry[], maxLength = 3200): string[] {
  if (players.length === 0) {
    return [formatCard('DIRECTORIO DE JUGADORES', ['Todavía no hay jugadores registrados.'])];
  }

  const rows = players.map((player) => [
    `*${player.name}* · ${player.position} · ⭐ ${player.rating.toFixed(1)}/10`,
    `   ${player.matches} partidos · ${player.attendanceRate.toFixed(0)}% asistencia · V/E/D ${player.wins}/${player.draws}/${player.losses}`
  ].join('\n'));
  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentLength = 0;

  for (const row of rows) {
    const addedLength = row.length + (currentPage.length ? 2 : 0);
    if (currentPage.length && currentLength + addedLength > maxLength) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = 0;
    }
    currentPage.push(row);
    currentLength += row.length + (currentPage.length > 1 ? 2 : 0);
  }
  if (currentPage.length) pages.push(currentPage);

  return pages.map((page, index) => formatCard(
    `JUGADORES · ${players.length}${pages.length > 1 ? ` · ${index + 1}/${pages.length}` : ''}`,
    page.flatMap((row, rowIndex) => rowIndex === 0 ? [row] : ['', row])
  ));
}

export function formatMatchHistory(history: MatchHistoryDisplay, timezone: string): string {
  const summary = history.summary;
  const recentLines = history.recent.length
    ? history.recent.map((match) => {
        const date = new Intl.DateTimeFormat('es-ES', {
          timeZone: timezone,
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }).format(new Date(`${match.matchDate}T12:00:00Z`));
        const mvp = match.mvp ? ` · ⭐ ${match.mvp}` : '';
        return `• *${date}*  🔵 ${match.scoreA} — ${match.scoreB} ⚪\n  👥 ${match.attendance} presentes${mvp}`;
      })
    : ['Todavía no hay resultados registrados.'];

  return formatCard('HISTORIAL DE PARTIDOS', [
    `⚽ Jugados: *${summary.totalPlayed}*`,
    `🏆 Equipo A: *${summary.winsA}* · Empates: *${summary.draws}* · Equipo B: *${summary.winsB}*`,
    `🥅 Goles: *${summary.totalGoals}* · Media: *${summary.averageGoals.toFixed(1)} por partido*`,
    `👟 Asistencias registradas: *${summary.attendedPlayers}* · No presentados: *${summary.noShows}*`,
    '',
    '*ÚLTIMOS RESULTADOS*',
    ...recentLines
  ]);
}
