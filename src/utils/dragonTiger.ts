import { CardRank, CardSuit, PlayingCard, DragonTigerSide, DragonTigerConfig, DragonTigerRound } from '../types';
import { SUITS, RANKS, createDeck, shuffleDeck } from './andarBahar';

export { SUITS, RANKS };

export const DEFAULT_DRAGON_TIGER_CONFIG: DragonTigerConfig = {
  isEnabled: true,
  minBet: 10,
  maxBet: 50000,
  bettingDurationSeconds: 15,
  dragonMultiplier: 2.0,
  tigerMultiplier: 2.0,
  tieMultiplier: 9.0,
  rtpMode: 'fair_rng',
  manualForceWinner: 'random',
  manualDragonRank: 'random',
  manualTigerRank: 'random',
};

/**
 * Returns numeric rank comparison value for Dragon Tiger:
 * Ace = 1 (Lowest)
 * 2 - 10 = 2 - 10
 * Jack = 11
 * Queen = 12
 * King = 13 (Highest)
 */
export function getRankNumericValue(rank: CardRank): number {
  switch (rank) {
    case 'A': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return 5;
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J': return 11;
    case 'Q': return 12;
    case 'K': return 13;
    default: return 1;
  }
}

/**
 * Compares two cards to determine the winner
 */
export function determineDragonTigerWinner(dragonCard: PlayingCard, tigerCard: PlayingCard): DragonTigerSide {
  const dragonVal = getRankNumericValue(dragonCard.rank);
  const tigerVal = getRankNumericValue(tigerCard.rank);

  if (dragonVal > tigerVal) {
    return 'dragon';
  } else if (tigerVal > dragonVal) {
    return 'tiger';
  } else {
    return 'tie';
  }
}

/**
 * Simulates drawing Dragon and Tiger cards based on config and house protection rules
 */
export function simulateDragonTigerRound(
  config: DragonTigerConfig,
  totalBetsDragon: number = 0,
  totalBetsTiger: number = 0,
  totalBetsTie: number = 0
): {
  dragonCard: PlayingCard;
  tigerCard: PlayingCard;
  winningSide: DragonTigerSide;
} {
  let deck = shuffleDeck(createDeck());

  let targetSide: DragonTigerSide | null = null;
  if (config.manualForceWinner && config.manualForceWinner !== 'random') {
    targetSide = config.manualForceWinner;
  } else if (config.rtpMode === 'house_protect') {
    // Determine which outcome gives minimum payout to players
    const dragonPayout = totalBetsDragon * (config.dragonMultiplier || 2.0);
    const tigerPayout = totalBetsTiger * (config.tigerMultiplier || 2.0);
    const tiePayout = totalBetsTie * (config.tieMultiplier || 9.0);

    const outcomes: { side: DragonTigerSide; payout: number }[] = [
      { side: 'dragon', payout: dragonPayout },
      { side: 'tiger', payout: tigerPayout },
      { side: 'tie', payout: tiePayout },
    ];

    // Pick side with lowest total payout
    outcomes.sort((a, b) => a.payout - b.payout);
    targetSide = outcomes[0].side;
  }

  // Handle manual specific ranks if specified
  const manualDragonRank = config.manualDragonRank && config.manualDragonRank !== 'random' ? config.manualDragonRank : null;
  const manualTigerRank = config.manualTigerRank && config.manualTigerRank !== 'random' ? config.manualTigerRank : null;

  if (manualDragonRank && manualTigerRank) {
    const dragonCard = deck.find((c) => c.rank === manualDragonRank) || deck[0];
    deck = deck.filter((c) => c.id !== dragonCard.id);
    const tigerCard = deck.find((c) => c.rank === manualTigerRank) || deck[0];
    const winningSide = determineDragonTigerWinner(dragonCard, tigerCard);
    return { dragonCard, tigerCard, winningSide };
  }

  if (targetSide === 'dragon') {
    // Dragon must have higher rank than Tiger
    // Pick higher rank for Dragon (e.g. 8 to K), lower for Tiger (e.g. A to 7)
    for (let attempts = 0; attempts < 100; attempts++) {
      const dCard = deck[Math.floor(Math.random() * deck.length)];
      const tCard = deck[Math.floor(Math.random() * deck.length)];
      if (dCard.id !== tCard.id && getRankNumericValue(dCard.rank) > getRankNumericValue(tCard.rank)) {
        return { dragonCard: dCard, tigerCard: tCard, winningSide: 'dragon' };
      }
    }
  } else if (targetSide === 'tiger') {
    // Tiger must have higher rank than Dragon
    for (let attempts = 0; attempts < 100; attempts++) {
      const dCard = deck[Math.floor(Math.random() * deck.length)];
      const tCard = deck[Math.floor(Math.random() * deck.length)];
      if (dCard.id !== tCard.id && getRankNumericValue(tCard.rank) > getRankNumericValue(dCard.rank)) {
        return { dragonCard: dCard, tigerCard: tCard, winningSide: 'tiger' };
      }
    }
  } else if (targetSide === 'tie') {
    // Both cards must have matching ranks with different suits
    for (let attempts = 0; attempts < 100; attempts++) {
      const dCard = deck[Math.floor(Math.random() * deck.length)];
      const matchingTigerCard = deck.find((c) => c.id !== dCard.id && c.rank === dCard.rank);
      if (matchingTigerCard) {
        return { dragonCard: dCard, tigerCard: matchingTigerCard, winningSide: 'tie' };
      }
    }
  }

  // Default: Pure Natural Fair RNG
  const dragonCard = deck[0];
  const tigerCard = deck[1];
  const winningSide = determineDragonTigerWinner(dragonCard, tigerCard);

  return { dragonCard, tigerCard, winningSide };
}

/**
 * Calculate user payout for a Dragon Tiger bet
 * In this system, the bet stake is deducted and never refunded.
 * When the user wins, ONLY the pure winning profit is credited to the account.
 */
export function calculateDragonTigerPayout(
  bet: { side: DragonTigerSide; amount: number },
  winningSide: DragonTigerSide,
  config: DragonTigerConfig
): { wonAmount: number; status: 'won' | 'lost'; netProfit: number } {
  if (bet.side === winningSide) {
    let multiplier = 2.0;
    if (bet.side === 'dragon') multiplier = config.dragonMultiplier || 2.0;
    if (bet.side === 'tiger') multiplier = config.tigerMultiplier || 2.0;
    if (bet.side === 'tie') multiplier = config.tieMultiplier || 9.0;

    // Full winning payout returned to player wallet (e.g. 100 bet @ 2x => 200 credited)
    const wonAmount = Math.round(bet.amount * multiplier);

    return {
      wonAmount,
      status: 'won',
      netProfit: wonAmount - bet.amount,
    };
  }

  // Non-winning bet is 100% lost with 0 refund
  return {
    wonAmount: 0,
    status: 'lost',
    netProfit: -bet.amount,
  };
}
