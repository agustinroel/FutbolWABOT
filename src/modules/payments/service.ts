import { db } from '../../database/client.js';
import { config } from '../../config/env.js';
import type { Match } from '../matches/service.js';

export function isPaymentProofIntent(messageType: string, caption: string): boolean {
  return messageType === 'image' &&
    /(?:^|[^\p{L}])(?:bizum|pago|pagad[oa]|pagu[eé]|transferencia)(?=$|[^\p{L}])/iu.test(caption);
}

export function reportPayment(match: Match, playerId: string): 'PENDING_CONFIRMATION' | 'PAID' {
  const rostered = db.prepare('SELECT 1 FROM roster WHERE match_id = ? AND player_id = ? AND status = ?')
    .get(match.id, playerId, 'CONFIRMED');
  if (!rostered) throw new Error('Solo los jugadores convocados pueden notificar un pago.');
  const result = db.prepare(`
    UPDATE payments SET status = 'PENDING_CONFIRMATION', updated_at = CURRENT_TIMESTAMP
    WHERE match_id = ? AND player_id = ? AND status != 'PAID'
  `).run(match.id, playerId);
  if (result.changes === 0) {
    const payment = db.prepare('SELECT status FROM payments WHERE match_id = ? AND player_id = ?')
      .get(match.id, playerId) as { status: string } | undefined;
    if (payment?.status !== 'PAID') throw new Error('No se encontró el pago del jugador; vuelve a apuntarte al partido.');
    return 'PAID';
  }
  return 'PENDING_CONFIRMATION';
}

export function confirmPayment(match: Match, playerId: string): void {
  const result = db.prepare(`
    UPDATE payments SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
    WHERE match_id = ? AND player_id = ? AND status != 'PAID'
  `).run(match.id, playerId);
  if (result.changes === 0) throw new Error('El jugador no está en la convocatoria o ya constaba como pagado.');
}

export function resetPayments(matchId: number): number {
  return db.prepare(`
    UPDATE payments SET status = 'UNPAID', updated_at = CURRENT_TIMESTAMP
    WHERE match_id = ? AND status != 'UNPAID'
  `).run(matchId).changes;
}

export function listDebtors(matchId: number): Array<{ id: string; name: string }> {
  return db.prepare(`
    SELECT p.id, p.name FROM roster r
    JOIN players p ON p.id = r.player_id
    LEFT JOIN payments pay ON pay.match_id = r.match_id AND pay.player_id = r.player_id
    WHERE r.match_id = ? AND r.status = 'CONFIRMED' AND COALESCE(pay.status, 'UNPAID') != 'PAID'
    ORDER BY r.joined_at
  `).all(matchId) as Array<{ id: string; name: string }>;
}

export function getPlayerFee(playerCount: number): number | undefined {
  if (config.feePerPlayer !== undefined) return config.feePerPlayer;
  return config.pitchCost === undefined || playerCount < 1 ? undefined : config.pitchCost / playerCount;
}
