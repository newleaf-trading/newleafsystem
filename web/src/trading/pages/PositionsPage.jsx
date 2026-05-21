import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { useVerdict, VERDICT_STATES, VERDICT_CONFIG } from '../hooks/useVerdict';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { formatStrategy } from '../utils/formatters';
import { PhaseHeader } from '../components/PhaseHeader';
import { SentimentBadge } from '../components/SentimentBadge';
import { useVerdictExplanation } from '../hooks/useVerdictExplanation';
import { Card } from '../../shared/components/ui/Card';
import { VerdictBadge } from '../../shared/components/ui/VerdictBadge';
import { PnlDisplay } from '../../shared/components/ui/PnlDisplay';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import styles from './PositionsPage.module.css';

/**
 * /trading/positions — Defend phase. Active positions with verdicts.
 *
 * Sorted by DTE (soonest expiry first), then symbol.
 * Each card shows verdict pill, symbol, strategy, P&L, and AI explain CTA.
 */

function getDte(item, tile) {
  const expiry = item?.expiry || tile?.expiry;
  if (!expiry) return 999;
  return Math.max(0, Math.round((new Date(expiry + 'T16:00:00') - new Date()) / 86400000));
}

function PositionCard({ item, tile, navigate }) {
  const liveData = usePositionLiveData(tile, item);
  const verdict = useVerdict(item.tileId, tile, liveData);
  const { explanation, loading: aiLoading, error, fetchExplanation } = useVerdictExplanation();
  const cfg = VERDICT_CONFIG[verdict.state];
  const pnl = liveData.pnlTotal || (item.unrealizedPnl || 0) * (item.quantity || 1);
  const dte = getDte(item, tile);

  return (
    <Card
      onClick={() => navigate(`/invest/strategy/${item.tileId}`)}
      className={styles.posCard}
      style={{ '--accent-color': cfg.color }}
    >
      <div className={styles.cardTop}>
        <div>
          <div className={styles.badges}>
            <VerdictBadge state={verdict.state} />
            {tile?.sentiment && <SentimentBadge sentiment={tile.sentiment} />}
          </div>
          <div className={styles.symbol}>{item.symbol}</div>
          <div className={styles.meta}>
            {formatStrategy(item.strategy)} &middot; {dte} DTE
          </div>
        </div>
        <div className={styles.pnlCol}>
          <PnlDisplay value={pnl} size="md" />
          <div className={styles.contracts}>
            {item.quantity || 1} contract{(item.quantity || 1) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className={styles.reason}>{verdict.reason}</div>

      <div className={styles.aiSection}>
        {explanation ? (
          <div className={styles.aiExplanation}>
            <span className={styles.aiBadge}>AI</span>
            {explanation}
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              loading={aiLoading}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                fetchExplanation({
                  ticker: item.symbol,
                  strategy: item.strategy,
                  verdictState: verdict.state,
                  verdictReason: verdict.reason,
                  marketData: { pnl, dte: tile?.daysToExpiry },
                  position: { legs: item.legs },
                });
              }}
            >
              AI explain
            </Button>
            {error && <div className={styles.aiError}>{error}</div>}
          </>
        )}
      </div>
    </Card>
  );
}

export function PositionsPage({ tiles, onOpenChat }) {
  const navigate = useNavigate();
  const { portfolioItems, loading } = usePortfolio();

  const now = new Date();
  const activePositions = portfolioItems
    .filter(item => {
      if (item.status !== 'active') return false;
      const tile = tiles?.find(t => t.id === item.tileId);
      if (!tile) return false;
      const expiry = item.expiry || tile.expiry;
      if (expiry) {
        const expiryDate = new Date(expiry + 'T16:00:00');
        if (expiryDate < now) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const tileA = tiles?.find(t => t.id === a.tileId);
      const tileB = tiles?.find(t => t.id === b.tileId);
      const dteA = getDte(a, tileA);
      const dteB = getDte(b, tileB);
      return dteA - dteB || (a.symbol || '').localeCompare(b.symbol || '');
    });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <PhaseHeader
          currentPhase="defend"
          title="Positions"
          subtitle="Active positions sorted by urgency. Verdict-driven actions."
          activeCount={activePositions.length || null}
        />
        {onOpenChat && activePositions.length > 0 && (
          <button
            className={styles.askAi}
            onClick={() => onOpenChat('Review my active positions. Any that need attention?')}
          >
            <span style={{ fontSize: 14 }}>&#9889;</span> Ask AI
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading positions...</div>
      ) : activePositions.length === 0 ? (
        <EmptyState
          icon="&#128203;"
          title="No active positions"
          message="Build a portfolio from Discover to start tracking positions here."
          actionLabel="Go to Discover"
          onAction={() => navigate('/invest/discover')}
        />
      ) : (
        <div className={styles.list}>
          {activePositions.map(item => (
            <PositionCard
              key={item.id}
              item={item}
              tile={tiles?.find(t => t.id === item.tileId)}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
