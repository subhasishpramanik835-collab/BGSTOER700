import { CardRank, CardSuit, PlayingCard, AndarBaharSide, AndarBaharConfig, AndarBaharRound } from '../types';

export const SUITS: { suit: CardSuit; symbol: string; color: 'red' | 'black'; name: string }[] = [
  { suit: 'spades', symbol: '♠', color: 'black', name: 'Spade' },
  { suit: 'hearts', symbol: '♥', color: 'red', name: 'Heart' },
  { suit: 'clubs', symbol: '♣', color: 'black', name: 'Club' },
  { suit: 'diamonds', symbol: '♦', color: 'red', name: 'Diamond' },
];

export const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DEFAULT_ANDAR_BAHAR_CONFIG: AndarBaharConfig = {
  isEnabled: true,
  minBet: 10,
  maxBet: 50000,
  bettingDurationSeconds: 15,
  dealingSpeedMs: 650,
  andarMultiplier: 1.95,
  baharMultiplier: 1.95,
  rtpMode: 'fair_rng',
  manualForceWinner: 'random',
  manualJokerRank: 'random',
};

/**
 * Generate a complete 52-card standard deck
 */
export function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  SUITS.forEach((s) => {
    RANKS.forEach((rank, idx) => {
      deck.push({
        id: `${s.suit}_${rank}`,
        suit: s.suit,
        rank,
        value: idx + 1,
        color: s.color,
      });
    });
  });
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 */
export function shuffleDeck(deck: PlayingCard[]): PlayingCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Pick a random card or use preset rank
 */
export function pickJokerCard(deck: PlayingCard[], presetRank?: CardRank | 'random'): { joker: PlayingCard; remainingDeck: PlayingCard[] } {
  let deckCopy = shuffleDeck(deck);
  if (presetRank && presetRank !== 'random') {
    const idx = deckCopy.findIndex((c) => c.rank === presetRank);
    if (idx !== -1) {
      const [joker] = deckCopy.splice(idx, 1);
      return { joker, remainingDeck: deckCopy };
    }
  }
  const joker = deckCopy.shift()!;
  return { joker, remainingDeck: deckCopy };
}

/**
 * Simulates dealing cards step-by-step for Andar Bahar
 * Alternates between Andar and Bahar until a card with matching rank is drawn.
 */
export function simulateAndarBaharRound(
  jokerCard: PlayingCard,
  remainingDeck: PlayingCard[],
  config: AndarBaharConfig,
  totalBetsAndar: number = 0,
  totalBetsBahar: number = 0
): {
  andarCards: PlayingCard[];
  baharCards: PlayingCard[];
  winningSide: AndarBaharSide;
  winningCard: PlayingCard;
  dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[];
} {
  let deck = shuffleDeck(remainingDeck);

  // Check if forced winner is requested
  let targetSide: AndarBaharSide | null = null;
  if (config.manualForceWinner && config.manualForceWinner !== 'random') {
    targetSide = config.manualForceWinner;
  } else if (config.rtpMode === 'house_protect') {
    // If total bets on Andar are significantly higher, house wins more if Bahar wins
    if (totalBetsAndar > totalBetsBahar && totalBetsAndar > 0) {
      targetSide = 'bahar';
    } else if (totalBetsBahar > totalBetsAndar && totalBetsBahar > 0) {
      targetSide = 'andar';
    }
  }

  // Separate matching rank cards and non-matching cards
  const matchingCards = deck.filter((c) => c.rank === jokerCard.rank);
  const nonMatchingCards = deck.filter((c) => c.rank !== jokerCard.rank);

  // If forced to a specific side, we craft dealing sequence so match lands on targetSide
  if (targetSide) {
    const chosenMatchCard = matchingCards[Math.floor(Math.random() * matchingCards.length)];
    // Determine random number of steps before match (e.g. 1 to 14 cards)
    // If target is Andar (1st, 3rd, 5th, 7th card -> odd step index 1, 3, 5...)
    // If target is Bahar (2nd, 4th, 6th, 8th card -> even step index 2, 4, 6...)
    const oddNumbers = [1, 3, 5, 7, 9, 11, 13];
    const evenNumbers = [2, 4, 6, 8, 10, 12, 14];
    const chosenStep = targetSide === 'andar' 
      ? oddNumbers[Math.floor(Math.random() * oddNumbers.length)]
      : evenNumbers[Math.floor(Math.random() * evenNumbers.length)];

    const nonMatchShuffled = shuffleDeck(nonMatchingCards);
    const dealtCards: PlayingCard[] = [];
    for (let i = 0; i < chosenStep - 1; i++) {
      dealtCards.push(nonMatchShuffled.pop()!);
    }
    dealtCards.push(chosenMatchCard);

    const andarCards: PlayingCard[] = [];
    const baharCards: PlayingCard[] = [];
    const dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[] = [];

    dealtCards.forEach((card, index) => {
      const side: AndarBaharSide = index % 2 === 0 ? 'andar' : 'bahar';
      const isMatch = card.rank === jokerCard.rank;
      if (side === 'andar') {
        andarCards.push(card);
      } else {
        baharCards.push(card);
      }
      dealingSequence.push({ side, card, isMatch });
    });

    return {
      andarCards,
      baharCards,
      winningSide: targetSide,
      winningCard: chosenMatchCard,
      dealingSequence,
    };
  }

  // Fair Standard Dealing
  const andarCards: PlayingCard[] = [];
  const baharCards: PlayingCard[] = [];
  const dealingSequence: { side: AndarBaharSide; card: PlayingCard; isMatch: boolean }[] = [];

  let winningSide: AndarBaharSide = 'andar';
  let winningCard: PlayingCard = deck[0];

  for (let i = 0; i < deck.length; i++) {
    const card = deck[i];
    const side: AndarBaharSide = i % 2 === 0 ? 'andar' : 'bahar';
    const isMatch = card.rank === jokerCard.rank;

    if (side === 'andar') {
      andarCards.push(card);
    } else {
      baharCards.push(card);
    }

    dealingSequence.push({ side, card, isMatch });

    if (isMatch) {
      winningSide = side;
      winningCard = card;
      break;
    }
  }

  return {
    andarCards,
    baharCards,
    winningSide,
    winningCard,
    dealingSequence,
  };
}

/**
 * Helper to get card visual symbol and color
 */
export function getSuitDetails(suit: CardSuit) {
  switch (suit) {
    case 'hearts':
      return { symbol: '♥', color: 'text-rose-500', bg: 'bg-rose-500/10' };
    case 'diamonds':
      return { symbol: '♦', color: 'text-rose-500', bg: 'bg-rose-500/10' };
    case 'clubs':
      return { symbol: '♣', color: 'text-slate-900', bg: 'bg-slate-900/10' };
    case 'spades':
      return { symbol: '♠', color: 'text-slate-900', bg: 'bg-slate-900/10' };
  }
}
