'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Goal,
  LogOut,
  MapPin,
  Medal,
  RefreshCw,
  Shield,
  Star,
  Trophy,
  Users,
  X
} from 'lucide-react';
import type {
  DashboardData,
  DashboardPlayer,
  HistoryMatch,
  Position,
  RosterPlayer
} from '@/lib/types';

type SortKey = 'rating' | 'winRate' | 'matches';
type PositionFilter = 'ALL' | Position;

const positionLabels: Record<Position, string> = {
  GK: 'Portero',
  DEF: 'Defensa',
  MID: 'Medio',
  FWD: 'Delantero'
};

function winRate(player: DashboardPlayer): number {
  const decisions = player.wins + player.draws + player.losses;
  return decisions ? player.wins / decisions : 0;
}

function matchDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }
): string {
  return new Intl.DateTimeFormat('es-ES', {
    ...options,
    timeZone: 'Europe/Madrid'
  }).format(new Date(`${date}T12:00:00Z`));
}

function kickoff(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wanted = Date.UTC(
    year ?? 2000,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 20,
    minute ?? 0
  );
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(wanted));
  const rendered = new Map(
    parts.map((part) => [part.type, Number(part.value)])
  );
  const renderedUtc = Date.UTC(
    rendered.get('year') ?? 2000,
    (rendered.get('month') ?? 1) - 1,
    rendered.get('day') ?? 1,
    rendered.get('hour') ?? 0,
    rendered.get('minute') ?? 0
  );
  return wanted + wanted - renderedUtc;
}

function Countdown({
  date,
  time
}: {
  date: string;
  time: string;
}): ReactElement {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = (): void =>
      setRemaining(Math.max(0, kickoff(date, time) - Date.now()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [date, time]);
  const days =
    remaining === null
      ? '––'
      : String(Math.floor(remaining / 86_400_000)).padStart(2, '0');
  const hours =
    remaining === null
      ? '––'
      : String(Math.floor((remaining / 3_600_000) % 24)).padStart(2, '0');
  const minutes =
    remaining === null
      ? '––'
      : String(Math.floor((remaining / 60_000) % 60)).padStart(2, '0');
  return (
    <div className="countdown" aria-label="Tiempo hasta el partido">
      <span>
        <b>{days}</b>
        <small>DÍAS</small>
      </span>
      <i>:</i>
      <span>
        <b>{hours}</b>
        <small>HRS</small>
      </span>
      <i>:</i>
      <span>
        <b>{minutes}</b>
        <small>MIN</small>
      </span>
    </div>
  );
}

function PositionBadge({ position }: { position: Position }): ReactElement {
  return (
    <span className={`position-badge position-${position.toLowerCase()}`}>
      {position}
    </span>
  );
}

function PaymentBadge({
  status
}: {
  status: RosterPlayer['paymentStatus'];
}): ReactElement {
  const label =
    status === 'PAID'
      ? 'Pagado'
      : status === 'PENDING_CONFIRMATION'
        ? 'Por verificar'
        : 'Pendiente';
  return (
    <span className={`payment-badge payment-${status.toLowerCase()}`}>
      {status === 'PAID' ? <Check size={12} /> : <Clock3 size={12} />}
      {label}
    </span>
  );
}

function RosterRow({
  player,
  index
}: {
  player: RosterPlayer;
  index: number;
}): ReactElement {
  return (
    <li className="roster-row">
      <span className="roster-number">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="roster-identity">
        <span className="avatar avatar-small">
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{player.name}</strong>
          <small>{player.rating.toFixed(1)} nivel</small>
        </div>
      </div>
      <PositionBadge position={player.position} />
      <PaymentBadge status={player.paymentStatus} />
    </li>
  );
}

function EmptyRoster({ message }: { message: string }): ReactElement {
  return (
    <div className="empty-roster">
      <Users size={19} />
      <span>{message}</span>
    </div>
  );
}

function MatchCard({
  game,
  index
}: {
  game: HistoryMatch;
  index: number;
}): ReactElement {
  const teamA = game.roster.filter((player) => player.team === 'A');
  const teamB = game.roster.filter((player) => player.team === 'B');
  return (
    <motion.article
      className="history-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.045, 0.2) }}
    >
      <div className="history-card-top">
        <span className="history-date">
          <CalendarDays size={14} /> JUEVES · {matchDate(game.matchDate)}
        </span>
        <span className="attendance-count">
          <Users size={14} /> {game.attendance}
        </span>
      </div>
      <div className="scoreboard">
        <div className="team-side">
          <span className="team-marker marker-a" />
          <b>Peto</b>
          <small>{teamA.map((p) => p.name).join(' · ') || 'Equipo A'}</small>
        </div>
        <div className="score">
          <span>{game.scoreA}</span>
          <i>:</i>
          <span>{game.scoreB}</span>
        </div>
        <div className="team-side team-side-right">
          <span className="team-marker marker-b" />
          <b>Sin peto</b>
          <small>{teamB.map((p) => p.name).join(' · ') || 'Equipo B'}</small>
        </div>
      </div>
      {game.mvp ? (
        <div className="mvp-line">
          <Crown size={15} /> MVP <strong>{game.mvp}</strong>
        </div>
      ) : null}
    </motion.article>
  );
}

function PlayerDialog({
  player,
  onClose
}: {
  player: DashboardPlayer | null;
  onClose: () => void;
}): ReactElement {
  useEffect(() => {
    if (!player) return;
    const dialog = document.getElementById(
      'player-detail'
    ) as HTMLDialogElement | null;
    dialog?.showModal();
    return () => dialog?.close();
  }, [player]);
  return (
    <dialog
      id="player-detail"
      className="player-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {player ? (
        <div className="dialog-content">
          <button
            className="icon-button dialog-close"
            aria-label="Cerrar perfil"
            onClick={() =>
              (
                document.getElementById(
                  'player-detail'
                ) as HTMLDialogElement | null
              )?.close()
            }
          >
            <X size={19} />
          </button>
          <span className="eyebrow">FICHA DE JUGADOR</span>
          <div className="dialog-player">
            <span className="avatar avatar-large">
              {player.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>{player.name}</h2>
              <span>
                <PositionBadge position={player.position} />{' '}
                <small>{positionLabels[player.position]}</small>
              </span>
            </div>
          </div>
          <div className="detail-grid">
            <div>
              <Star size={16} />
              <strong>{player.rating.toFixed(2)}</strong>
              <small>Rating</small>
            </div>
            <div>
              <Activity size={16} />
              <strong>{player.matches}</strong>
              <small>Partidos</small>
            </div>
            <div>
              <Medal size={16} />
              <strong>{(winRate(player) * 100).toFixed(0)}%</strong>
              <small>Victorias</small>
            </div>
            <div>
              <Check size={16} />
              <strong>{player.attendanceRate.toFixed(0)}%</strong>
              <small>Asistencia</small>
            </div>
          </div>
          <div className="detail-record">
            <span>Balance</span>
            <strong>
              <i>{player.wins}V</i> · {player.draws}E · <b>{player.losses}D</b>
            </strong>
          </div>
          <div className="detail-record">
            <span>Ausencias / bajas tardías</span>
            <strong>
              {player.noShows} / {player.lateCancellations}
            </strong>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

function PlayerRow({
  player,
  rank,
  onSelect
}: {
  player: DashboardPlayer;
  rank: number;
  onSelect: (player: DashboardPlayer) => void;
}): ReactElement {
  return (
    <button className="leader-row" onClick={() => onSelect(player)}>
      <span className={`rank rank-${rank}`}>
        {String(rank).padStart(2, '0')}
      </span>
      <span className="leader-name">
        <span className="avatar avatar-small">
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong>{player.name}</strong>
          <small>{positionLabels[player.position]}</small>
        </span>
      </span>
      <span className="leader-rating">
        <strong>{player.rating.toFixed(2)}</strong>
        <small>RATING</small>
      </span>
      <span className="leader-change">
        {player.ratingChange >= 0 ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )}
        {Math.abs(player.ratingChange).toFixed(2)}
      </span>
      <span className="leader-stat">
        {(winRate(player) * 100).toFixed(0)}
        <small>% win</small>
      </span>
      <span className="leader-stat">
        {player.matches}
        <small>partidos</small>
      </span>
      <ChevronDown className="leader-open" size={15} />
    </button>
  );
}

export function Dashboard({
  initialData,
  initialError
}: {
  initialData: DashboardData | null;
  initialError: string | null;
}): ReactElement {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<PositionFilter>('ALL');
  const [sort, setSort] = useState<SortKey>('rating');
  const [selected, setSelected] = useState<DashboardPlayer | null>(null);
  const [lastUpdated, setLastUpdated] = useState(
    initialData?.generatedAt ?? ''
  );

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      const payload = (await response.json()) as DashboardData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || 'No se pudo actualizar el panel.');
      setData(payload);
      setError(null);
      setLastUpdated(payload.generatedAt);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo actualizar el panel.'
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredPlayers = useMemo(() => {
    if (!data) return [];
    const players = data.leaderboard.filter(
      (player) => filter === 'ALL' || player.position === filter
    );
    return players.sort((left, right) => {
      if (sort === 'winRate')
        return winRate(right) - winRate(left) || right.matches - left.matches;
      if (sort === 'matches')
        return right.matches - left.matches || right.rating - left.rating;
      return right.rating - left.rating || right.matches - left.matches;
    });
  }, [data, filter, sort]);

  async function logout(): Promise<void> {
    await fetch('/api/session', { method: 'DELETE' });
    window.location.reload();
  }

  if (!data && refreshing) {
    return (
      <main className="dashboard-shell" aria-busy="true">
        <header className="topbar">
          <Brand />
          <span className="private-mark">
            <Shield size={13} /> SOLO GRUPO
          </span>
        </header>
        <section
          className="skeleton-state"
          aria-label="Cargando datos del grupo"
        >
          <span className="eyebrow">CONECTANDO CON EL VESTUARIO</span>
          <div className="skeleton-block skeleton-title" />
          <div className="skeleton-block skeleton-copy" />
          <div className="skeleton-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton-block skeleton-card" key={index} />
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="dashboard-shell">
        <header className="topbar">
          <Brand />
          <span className="private-mark">
            <Shield size={13} /> SOLO GRUPO
          </span>
        </header>
        <section className="error-state">
          <div className="error-icon">
            <Activity size={24} />
          </div>
          <span className="eyebrow">CONEXIÓN CON EL VESTUARIO</span>
          <h1>
            El panel está
            <br />
            <em>fuera de juego.</em>
          </h1>
          <p>{error || 'No se pudieron cargar los datos del grupo.'}</p>
          <button
            className="button button-primary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Conectando…' : 'Reintentar'}
          </button>
        </section>
      </main>
    );
  }

  const confirmed = data.currentMatch.roster.filter(
    (player) => player.status === 'CONFIRMED'
  );
  const substitutes = data.currentMatch.roster.filter(
    (player) => player.status === 'WAITLIST'
  );
  const openSpots = Math.max(0, data.currentMatch.capacity - confirmed.length);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <Brand />
        <nav className="desktop-nav">
          <a href="#convocatoria">Convocatoria</a>
          <a href="#clasificacion">Clasificación</a>
          <a href="#historial">Historial</a>
        </nav>
        <div className="topbar-actions">
          <span className="private-mark">
            <Shield size={13} /> SOLO GRUPO
          </span>
          <button
            className="icon-button refresh-button"
            aria-label="Actualizar datos"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          </button>
          <button
            className="icon-button logout-button"
            aria-label="Cerrar sesión"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
      {error ? (
        <div className="inline-error" role="alert">
          {error}
          <button onClick={() => void refresh()}>Reintentar</button>
        </div>
      ) : null}
      <section className="hero-grid" id="convocatoria">
        <div className="hero-copy">
          <div className="section-kicker">
            <span className="live-dot" /> PARTIDO DE LA SEMANA{' '}
            <span className="kicker-rule" />{' '}
            {matchDate(data.currentMatch.date, {
              day: 'numeric',
              month: 'long'
            })}
          </div>
          <h1>
            El jueves
            <br />
            <em>se juega.</em>
          </h1>
          <div className="hero-meta">
            <span>
              <MapPin size={15} />
              {data.currentMatch.location}
            </span>
            <span>
              <Clock3 size={15} />
              {data.currentMatch.time}
            </span>
          </div>
          <div className="hero-countdown">
            <span>PRÓXIMO SAQUE INICIAL</span>
            <Countdown
              date={data.currentMatch.date}
              time={data.currentMatch.time}
            />
          </div>
          <a className="text-link" href="#convocatoria-list">
            Ver convocatoria <ArrowUp size={15} className="link-arrow" />
          </a>
        </div>
        <div className="hero-visual">
          <div className="visual-label">
            <span>CANCHA</span>
            <strong>
              MONTEMAR <i>·</i> ALICANTE
            </strong>
          </div>
          <div className="pitch">
            <div className="pitch-half" />
            <div className="pitch-circle" />
            <div className="pitch-spot" />
            <div className="pitch-goal pitch-goal-left" />
            <div className="pitch-goal pitch-goal-right" />
            <span className="player-dot dot-one" />
            <span className="player-dot dot-two" />
            <span className="player-dot dot-three" />
            <span className="player-dot dot-four" />
            <span className="player-dot dot-five" />
            <span className="ball-dot" />
          </div>
          <div className="pitch-footer">
            <span>01 — EL CAMPO</span>
            <span>
              {data.currentMatch.status === 'CANCELLED'
                ? 'CANCELADO'
                : `JUEVES · ${data.currentMatch.time}`}
            </span>
          </div>
        </div>
      </section>
      <section className="stat-strip" aria-label="Resumen de la temporada">
        <div>
          <span>PARTIDOS JUGADOS</span>
          <strong>
            {data.history.summary.totalPlayed.toString().padStart(2, '0')}
          </strong>
        </div>
        <div>
          <span>GOLES MARCADOS</span>
          <strong>
            {data.history.summary.totalGoals.toString().padStart(2, '0')}
          </strong>
        </div>
        <div>
          <span>MEDIA POR PARTIDO</span>
          <strong>
            {data.history.summary.averageGoals.toFixed(1)}
            <small> gol</small>
          </strong>
        </div>
        <div>
          <span>ASISTENCIAS</span>
          <strong>
            {data.history.summary.attendedPlayers.toString().padStart(2, '0')}
          </strong>
        </div>
        <div className="stat-sync">
          <span>DATOS ACTUALIZADOS</span>
          <strong>
            {lastUpdated
              ? new Intl.DateTimeFormat('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Madrid'
                }).format(new Date(lastUpdated))
              : '—'}{' '}
            <button
              className="mini-refresh"
              onClick={() => void refresh()}
              aria-label="Actualizar"
            >
              <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
            </button>
          </strong>
        </div>
      </section>
      <div className="content-grid">
        <section className="panel callup-panel" id="convocatoria-list">
          <SectionHeading
            index="01"
            title="La convocatoria"
            detail={`${confirmed.length} / ${data.currentMatch.capacity} plazas`}
          />
          <div className="callup-status">
            <span
              className={`status-pill status-${data.currentMatch.status.toLowerCase()}`}
            >
              <i />
              {data.currentMatch.status === 'OPEN'
                ? 'Abierta'
                : data.currentMatch.status === 'CANCELLED'
                  ? 'Cancelada'
                  : data.currentMatch.status === 'PLAYED'
                    ? 'Jugado'
                    : 'Cerrada'}
            </span>
            <span>
              {openSpots ? `${openSpots} plazas libres` : 'Cupo completo'}
            </span>
          </div>
          <div className="capacity-track">
            <span
              style={{
                width: `${Math.min(100, (confirmed.length / data.currentMatch.capacity) * 100)}%`
              }}
            />
          </div>
          {data.currentMatch.status === 'CANCELLED' ? (
            <EmptyRoster message="Este jueves no hay convocatoria." />
          ) : (
            <>
              <RosterSection
                label="TITULARES"
                count={`${confirmed.length}`}
                players={confirmed}
                empty="Todavía no hay titulares apuntados."
              />
              <RosterSection
                label="SUPLENTES"
                count={`${substitutes.length}`}
                players={substitutes}
                empty="La lista de espera está vacía."
              />
            </>
          )}
        </section>
        <section className="panel leaderboard-panel" id="clasificacion">
          <SectionHeading
            index="02"
            title="La clasificación"
            detail={`${data.leaderboard.length} jugadores`}
          />
          <div className="leader-controls">
            <div
              className="position-filters"
              role="group"
              aria-label="Filtrar por posición"
            >
              {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((value) => (
                <button
                  key={value}
                  className={filter === value ? 'filter-active' : ''}
                  onClick={() => setFilter(value)}
                >
                  {value === 'ALL' ? 'Todos' : value}
                </button>
              ))}
            </div>
            <label className="sort-select">
              <ArrowUpDown size={14} />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Ordenar clasificación"
              >
                <option value="rating">Rating</option>
                <option value="winRate">% Victorias</option>
                <option value="matches">Partidos</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <div className="leader-head">
            <span>JUGADOR</span>
            <span>RATING</span>
            <span>CAMBIO</span>
            <span>VICTORIAS</span>
            <span>PARTIDOS</span>
            <span />
          </div>
          <div className="leader-list">
            {filteredPlayers.length ? (
              filteredPlayers.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  onSelect={setSelected}
                />
              ))
            ) : (
              <EmptyRoster message="No hay jugadores con esta posición." />
            )}
          </div>
        </section>
      </div>
      <section className="history-section" id="historial">
        <SectionHeading
          index="03"
          title="La historia del jueves"
          detail="RESULTADOS & MOMENTOS"
        />
        <div className="history-grid">
          {data.history.matches.length ? (
            data.history.matches.map((game, index) => (
              <MatchCard key={game.id} game={game} index={index} />
            ))
          ) : (
            <div className="history-empty">
              <div className="history-empty-mark">
                <Goal size={23} />
              </div>
              <div>
                <strong>La temporada empieza aquí.</strong>
                <p>
                  Cuando registremos el primer resultado, aparecerá en esta
                  pizarra.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="season-record">
          <span>
            <Trophy size={15} /> PALMARÉS DEL GRUPO
          </span>
          <b>
            <i>{data.history.summary.winsA} victorias A</i>
            <span>·</span>
            {data.history.summary.draws} empates<span>·</span>
            <i className="record-b">{data.history.summary.winsB} victorias B</i>
          </b>
        </div>
      </section>
      <footer className="footer">
        <Brand />
        <span>HECHO PARA LOS JUEVES · MONTEMAR, ALICANTE</span>
        <span>ACTUALIZACIÓN AUTOMÁTICA · 60 S</span>
      </footer>
      <PlayerDialog player={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function Brand(): ReactElement {
  return (
    <a className="brand" href="#" aria-label="Montemar Matchday inicio">
      <span className="brand-ball">
        <span />
      </span>
      <span>
        MONTEMAR<small>MATCHDAY CLUB</small>
      </span>
    </a>
  );
}

function SectionHeading({
  index,
  title,
  detail
}: {
  index: string;
  title: string;
  detail: string;
}): ReactElement {
  return (
    <div className="section-heading">
      <span>{index}</span>
      <div>
        <h2>{title}</h2>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function RosterSection({
  label,
  count,
  players,
  empty
}: {
  label: string;
  count: string;
  players: RosterPlayer[];
  empty: string;
}): ReactElement {
  return (
    <div className="roster-section">
      <div className="roster-heading">
        <h3>{label}</h3>
        <span>{count}</span>
      </div>
      {players.length ? (
        <ul>
          {players.map((player, index) => (
            <RosterRow key={player.id} player={player} index={index} />
          ))}
        </ul>
      ) : (
        <EmptyRoster message={empty} />
      )}
    </div>
  );
}
