import { LotteryCard } from './LotteryCard';
import { TechnicalCard } from './TechnicalCard';

export function TileGrid({ tiles, view }) {
  return (
    <div className="card-grid">
      {tiles.map((tile) => (
        view === 'lottery' ? (
          <LotteryCard key={tile.id} tile={tile} />
        ) : (
          <TechnicalCard key={tile.id} tile={tile} />
        )
      ))}
    </div>
  );
}
