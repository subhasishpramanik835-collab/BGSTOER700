import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Volume2, VolumeX, Sparkles, HelpCircle, History, 
  RotateCcw, Trash2, Zap, CheckCircle2, ChevronRight, Crown, 
  TrendingUp, ShieldCheck, Plus, AlertTriangle, Layers, Award
} from 'lucide-react';
import { User, WalletTransaction, AndarBaharConfig, AndarBaharRound, AndarBaharBet, PlayingCard, AndarBaharSide } from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  DEFAULT_ANDAR_BAHAR_CONFIG, 
  createDeck, 
  shuffleDeck, 
  pickJokerCard, 
  simulateAndarBaharRound 
} from '../utils/andarBahar';
import { PlayingCardView } from './PlayingCardView';
import confetti from 'canvas-confetti';

interface AndarBaharGameProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
}

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

export const AndarBaharGame: React.FC<AndarBaharGameProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit
}) => {
  // Game Configuration State (synced with Firestore)
  const [config, setConfig] = useState<AndarBaharConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_andar_bahar_config');
      return cached ? { ...DEFAULT_ANDAR_BAHAR_CONFIG, ...JSON.parse(cached) } : DEFAULT_ANDAR_BAHAR_CONFIG;
    } catch {
      return DEFAULT_ANDAR_BAHAR_CONFIG;
    }
  });
  const configRef = useRef<AndarBaharConfig>(config);
  configRef.current = config;

  // Game Lifecycle States
  const [gamePhase, setGamePhase] = useState<'betting' | 'dealing' | 'completed'>('betting');
  const [countdown, setCountdown] = useState<number>(config.bettingDurationSeconds || 15);
  const [roundId, setRoundId] = useState<string>(() => generateRoundId());
  
  // Card states
  const [jokerCard, setJokerCard] = useState<PlayingCard | null>(null);
  const [andarCards, setAndarCards] = useState<PlayingCard[]>([]);
  const [baharCards, setBaharCards] = useState<PlayingCard[]>([]);
  const [winningSide, setWinningSide] = useState<AndarBaharSide | null>(null);
  const [winningCard, setWinningCard] = useState<PlayingCard | null>(null);
  const [dealingActiveSide, setDealingActiveSide] = useState<AndarBaharSide | null>(null);

  // Betting States
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [userBetAndar, setUserBetAndar] = useState<number>(0);
  const [userBetBahar, setUserBetBahar] = useState<number>(0);
  const [lastBets, setLastBets] = useState<{ andar: number; bahar: number } | null>(null);

  // Simulated Table Bets (Real-time live casino feel)
  const [tableBetsAndar, setTableBetsAndar] = useState<number>(1450);
  const [tableBetsBahar, setTableBetsBahar] = useState<number>(1820);
  const [tablePlayersAndar, setTablePlayersAndar] = useState<number>(12);
  const [tablePlayersBahar, setTablePlayersBahar] = useState<number>(15);

  // User Win/Result popup
  const [roundWinAmount, setRoundWinAmount] = useState<number | null>(null);
  const [showWinCelebration, setShowWinCelebration] = useState<boolean>(false);

  // UI Modals
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Road history / Bead plate
  const [roadHistory, setRoadHistory] = useState<{ id: string; winner: AndarBaharSide; cardsCount: number; rank: string }[]>([
    { id: '1', winner: 'andar', cardsCount: 7, rank: 'K' },
    { id: '2', winner: 'bahar', cardsCount: 4, rank: '7' },
    { id: '3', winner: 'bahar', cardsCount: 12, rank: 'A' },
    { id: '4', winner: 'andar', cardsCount: 3, rank: '9' },
    { id: '5', winner: 'andar', cardsCount: 9, rank: 'J' },
    { id: '6', winner: 'bahar', cardsCount: 2, rank: '4' },
    { id: '7', winner: 'andar', cardsCount: 15, rank: 'Q' },
    { id: '8', winner: 'andar', cardsCount: 5, rank: '10' },
    { id: '9', winner: 'bahar', cardsCount: 8, rank: '3' },
    { id: '10', winner: 'andar', cardsCount: 1, rank: '6' },
  ]);

  // User's bet records
  const [myBetsHistory, setMyBetsHistory] = useState<AndarBaharBet[]>(() => {
    try {
      const cached = localStorage.getItem(`bg_ab_my_bets_${user.id}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // User balance ref and bet refs to maintain authoritative latest balance during gameplay without race conditions
  const balanceRef = useRef<number>(user.balance);
  const userBetAndarRef = useRef<number>(0);
  const userBetBaharRef = useRef<number>(0);

  useEffect(() => {
    // Only sync from external user prop if no active bets are placed and we are in betting phase
    if (userBetAndarRef.current === 0 && userBetBaharRef.current === 0 && gamePhase === 'betting') {
      balanceRef.current = typeof user.balance === 'number' ? user.balance : 0;
    }
  }, [user.balance, gamePhase]);

  function generateRoundId(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `AB-${dateStr}-${rand}`;
  }

  // 1. Listen to Realtime Config from Firestore collection `game_settings`
  useEffect(() => {
    // Primary: game_settings collection
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'andar_bahar'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          const next: AndarBaharConfig = {
            ...prev,
            isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled,
            minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
            andarMultiplier: data.multiplierPrimary !== undefined ? data.multiplierPrimary : (data.andarMultiplier || prev.andarMultiplier),
            baharMultiplier: data.multiplierSecondary !== undefined ? data.multiplierSecondary : (data.baharMultiplier || prev.baharMultiplier),
            rtpMode: data.rtpMode === 'house_protect' ? 'house_protect' : data.rtpMode === 'manual_force' ? 'manual_force_winner' : (data.rtpMode || prev.rtpMode),
          };
          try {
            localStorage.setItem('bg_andar_bahar_config', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }, (err) => console.warn('Andar Bahar game_settings listener notice:', err.message));

    // Fallback: legacy config
    const unsubLegacy = onSnapshot(doc(db, 'andar_bahar_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AndarBaharConfig>;
        setConfig((prev) => {
          const next = { ...prev, ...data };
          try {
            localStorage.setItem('bg_andar_bahar_config', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }, (err) => console.warn('Andar Bahar config listener notice:', err.message));

    return () => {
      unsubGameSettings();
      unsubLegacy();
    };
  }, []);

  // 2. Initialize First Joker Card on mount
  useEffect(() => {
    startNewBettingRound();
  }, []);

  // Setup a new betting round
  const startNewBettingRound = () => {
    const deck = createDeck();
    const { joker } = pickJokerCard(deck, configRef.current.manualJokerRank);
    
    setJokerCard(joker);
    setAndarCards([]);
    setBaharCards([]);
    setWinningSide(null);
    setWinningCard(null);
    setDealingActiveSide(null);
    setRoundWinAmount(null);
    setShowWinCelebration(false);
    userBetAndarRef.current = 0;
    userBetBaharRef.current = 0;
    setUserBetAndar(0);
    setUserBetBahar(0);
    setGamePhase('betting');
    setRoundId(generateRoundId());
    setCountdown(configRef.current.bettingDurationSeconds || 15);

    // Randomize table bets slightly for dynamic live vibe
    setTableBetsAndar(Math.floor(1200 + Math.random() * 2500));
    setTableBetsBahar(Math.floor(1100 + Math.random() * 2600));
    setTablePlayersAndar(Math.floor(8 + Math.random() * 18));
    setTablePlayersBahar(Math.floor(9 + Math.random() * 18));

    soundFx.playCardFlip();
  };

  // 3. Betting Countdown Timer
  useEffect(() => {
    if (gamePhase !== 'betting') return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((c) => c - 1);
        if (countdown <= 4 && countdown > 0) {
          soundFx.playCountdownTick();
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown ended -> Lock bets & start dealing!
      soundFx.playBetsClosed();
      startDealingPhase();
    }
  }, [countdown, gamePhase]);

  // 4. Start Dealing Simulation
  const startDealingPhase = async () => {
    setGamePhase('dealing');
    if (!jokerCard) return;

    // Cache current bets for "Re-Bet" option
    if (userBetAndar > 0 || userBetBahar > 0) {
      setLastBets({ andar: userBetAndar, bahar: userBetBahar });
    }

    // Build complete remaining deck
    const fullDeck = createDeck().filter((c) => c.id !== jokerCard.id);
    const roundSim = simulateAndarBaharRound(
      jokerCard,
      fullDeck,
      configRef.current,
      tableBetsAndar + userBetAndar,
      tableBetsBahar + userBetBahar
    );

    const speed = configRef.current.dealingSpeedMs || 650;
    const dealingSequence = roundSim.dealingSequence;

    // Deal cards sequentially with animated delay
    for (let i = 0; i < dealingSequence.length; i++) {
      const step = dealingSequence[i];
      setDealingActiveSide(step.side);
      soundFx.playCardDeal();

      await new Promise((resolve) => setTimeout(resolve, speed));

      if (step.side === 'andar') {
        setAndarCards((prev) => [...prev, step.card]);
      } else {
        setBaharCards((prev) => [...prev, step.card]);
      }

      if (step.isMatch) {
        // MATCH FOUND! Round concluded
        soundFx.playCardFlip();
        setWinningSide(roundSim.winningSide);
        setWinningCard(roundSim.winningCard);
        setDealingActiveSide(null);
        setGamePhase('completed');
        
        await resolveRoundOutcome(roundSim.winningSide, roundSim.winningCard, dealingSequence.length);
        return;
      }
    }
  };

  // 5. Resolve Winnings, Losses & Persist to Firestore
  const resolveRoundOutcome = async (
    winSide: AndarBaharSide, 
    winCard: PlayingCard, 
    totalCardsCount: number
  ) => {
    const totalUserBet = userBetAndarRef.current + userBetBaharRef.current;
    let wonAmt = 0;
    const andarMult = configRef.current.andarMultiplier || 1.95;
    const baharMult = configRef.current.baharMultiplier || 1.95;

    // Full winning payout calculation (e.g. 100 bet on 1.95x => 195 credited to wallet)
    if (winSide === 'andar' && userBetAndarRef.current > 0) {
      wonAmt = Math.round(userBetAndarRef.current * andarMult);
    } else if (winSide === 'bahar' && userBetBaharRef.current > 0) {
      wonAmt = Math.round(userBetBaharRef.current * baharMult);
    }

    // Update Road History
    const newRoadItem = {
      id: Date.now().toString(),
      winner: winSide,
      cardsCount: totalCardsCount,
      rank: jokerCard?.rank || winCard.rank
    };
    setRoadHistory((prev) => [newRoadItem, ...prev.slice(0, 19)]);

    // Process user winning or loss
    if (wonAmt > 0) {
      const currentBal = balanceRef.current;
      const newBal = currentBal + wonAmt;
      balanceRef.current = newBal;

      onUpdateBalance(newBal);
      setRoundWinAmount(wonAmt);
      setShowWinCelebration(true);
      soundFx.playLoudWinSound();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      const winTx: WalletTransaction = {
        id: `tx-ab-win-${Date.now()}`,
        userId: user.id,
        userEmail: (user.email || '').toLowerCase().trim(),
        type: 'andar_bahar_win',
        amount: wonAmt,
        description: `Won ₹${wonAmt.toLocaleString('en-IN')} on Andar Bahar Round ${roundId} (${winSide.toUpperCase()})`,
        status: 'completed',
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: new Date().toISOString()
      };
      onAddTransaction(winTx);

      logAnalyticsEvent('andar_bahar_win', {
        roundId,
        wonAmount: wonAmt,
        side: winSide,
        multiplier: winSide === 'andar' ? andarMult : baharMult
      });
    } else if (totalUserBet > 0) {
      // User lost - no refund! Keep deducted balance locked in Firestore and state
      soundFx.playLossSound();
      onUpdateBalance(balanceRef.current);
      logAnalyticsEvent('andar_bahar_loss', {
        roundId,
        lostAmount: totalUserBet,
        winningSide: winSide
      });
    }

    // Persist user bet entry in state & local cache
    if (totalUserBet > 0) {
      const betRecord: AndarBaharBet = {
        id: `bet-${roundId}-${user.id}`,
        roundId,
        userId: user.id,
        userName: user.name || 'Player',
        userPhone: user.phone,
        side: userBetAndar > 0 ? 'andar' : 'bahar',
        amount: totalUserBet,
        payoutMultiplier: winSide === 'andar' ? andarMult : baharMult,
        wonAmount: wonAmt > 0 ? wonAmt : 0,
        status: wonAmt > 0 ? 'won' : 'lost',
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      setMyBetsHistory((prev) => {
        const updated = [betRecord, ...prev.slice(0, 49)];
        try {
          localStorage.setItem(`bg_ab_my_bets_${user.id}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Persist bet to Firestore
      try {
        await setDoc(doc(db, 'andar_bahar_bets', betRecord.id), betRecord, { merge: true });
      } catch (e) {
        console.warn('Failed to persist Andar Bahar bet to Firestore:', e);
      }
    }

    // Persist Completed Round to Firestore
    try {
      const roundDoc: AndarBaharRound = {
        id: roundId,
        roundNumber: roadHistory.length + 1,
        jokerCard: jokerCard!,
        andarCards: andarCards,
        baharCards: baharCards,
        winningSide: winSide,
        winningCard: winCard,
        totalCardsDealt: totalCardsCount,
        status: 'completed',
        startTime: Date.now() - ((configRef.current.bettingDurationSeconds || 15) * 1000),
        endTime: Date.now(),
        totalBetsAndar: tableBetsAndar + userBetAndar,
        totalBetsBahar: tableBetsBahar + userBetBahar,
        totalPayout: wonAmt,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'andar_bahar_rounds', roundId), roundDoc, { merge: true });
    } catch (e) {
      console.warn('Failed to persist Andar Bahar round to Firestore:', e);
    }

    // Schedule next round automatically after 6 seconds
    setTimeout(() => {
      startNewBettingRound();
    }, 6000);
  };

  // 6. User Bet Placement Handler
  const handlePlaceBet = (side: AndarBaharSide) => {
    if (gamePhase !== 'betting') {
      soundFx.playLossSound();
      return;
    }

    const currentBal = balanceRef.current;
    if (currentBal < selectedChip) {
      soundFx.playLossSound();
      alert('Insufficient wallet balance! Please deposit to continue.');
      onOpenDeposit();
      return;
    }

    const currentSideBet = side === 'andar' ? userBetAndarRef.current : userBetBaharRef.current;
    const newSideTotal = currentSideBet + selectedChip;

    if (newSideTotal > (config.maxBet || 50000)) {
      alert(`Maximum bet limit for ${side.toUpperCase()} is ₹${(config.maxBet || 50000).toLocaleString('en-IN')}`);
      return;
    }

    // Deduct chip amount from balance permanently
    const newBal = Math.max(0, currentBal - selectedChip);
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    if (side === 'andar') {
      userBetAndarRef.current += selectedChip;
      setUserBetAndar((prev) => prev + selectedChip);
      setTableBetsAndar((prev) => prev + selectedChip);
    } else {
      userBetBaharRef.current += selectedChip;
      setUserBetBahar((prev) => prev + selectedChip);
      setTableBetsBahar((prev) => prev + selectedChip);
    }

    soundFx.playChipPlace();

    // Log wallet transaction for bet placement
    const betTx: WalletTransaction = {
      id: `tx-ab-bet-${Date.now()}-${side}`,
      userId: user.id,
      userEmail: (user.email || '').toLowerCase().trim(),
      type: 'andar_bahar_bet',
      amount: -selectedChip,
      description: `Placed ₹${selectedChip} on ${side.toUpperCase()} (Round ${roundId})`,
      status: 'completed',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      createdAt: new Date().toISOString()
    };
    onAddTransaction(betTx);
  };

  // Clear current round bets (only before betting ends)
  const handleClearBets = () => {
    if (gamePhase !== 'betting') return;
    const totalPlaced = userBetAndarRef.current + userBetBaharRef.current;
    if (totalPlaced <= 0) return;

    const currentBal = balanceRef.current;
    const newBal = currentBal + totalPlaced;
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    setTableBetsAndar((prev) => Math.max(0, prev - userBetAndarRef.current));
    setTableBetsBahar((prev) => Math.max(0, prev - userBetBaharRef.current));
    userBetAndarRef.current = 0;
    userBetBaharRef.current = 0;
    setUserBetAndar(0);
    setUserBetBahar(0);
    soundFx.playClick();
  };

  // Double current bets
  const handleDoubleBets = () => {
    if (gamePhase !== 'betting') return;
    const totalPlaced = userBetAndarRef.current + userBetBaharRef.current;
    if (totalPlaced <= 0) return;

    const currentBal = balanceRef.current;
    if (currentBal < totalPlaced) {
      alert('Insufficient balance to double your bets!');
      onOpenDeposit();
      return;
    }

    const newBal = Math.max(0, currentBal - totalPlaced);
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    setTableBetsAndar((prev) => prev + userBetAndarRef.current);
    setTableBetsBahar((prev) => prev + userBetBaharRef.current);
    userBetAndarRef.current *= 2;
    userBetBaharRef.current *= 2;
    setUserBetAndar((prev) => prev * 2);
    setUserBetBahar((prev) => prev * 2);
    soundFx.playChipPlace();
  };

  // Re-bet last round
  const handleReBet = () => {
    if (gamePhase !== 'betting' || !lastBets) return;
    const needed = (lastBets.andar || 0) + (lastBets.bahar || 0);
    if (needed <= 0) return;

    const currentBal = balanceRef.current;
    if (currentBal < needed) {
      alert('Insufficient balance to repeat last bets!');
      onOpenDeposit();
      return;
    }

    const newBal = Math.max(0, currentBal - needed);
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    userBetAndarRef.current = lastBets.andar;
    userBetBaharRef.current = lastBets.bahar;
    setUserBetAndar(lastBets.andar);
    setUserBetBahar(lastBets.bahar);
    setTableBetsAndar((prev) => prev + lastBets.andar);
    setTableBetsBahar((prev) => prev + lastBets.bahar);
    soundFx.playChipPlace();
  };

  // Calculate Bead Plate stats
  const totalRoundsCount = roadHistory.length || 1;
  const andarWinsCount = roadHistory.filter((r) => r.winner === 'andar').length;
  const baharWinsCount = roadHistory.filter((r) => r.winner === 'bahar').length;
  const andarPercentage = Math.round((andarWinsCount / totalRoundsCount) * 100);
  const baharPercentage = 100 - andarPercentage;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-screen h-[100dvh] overflow-hidden text-white select-none font-sans">
      
      {/* 1. TOP CASINO BAR */}
      <header className="h-12 sm:h-14 shrink-0 bg-slate-950/95 border-b border-amber-500/30 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between shadow-2xl z-30">
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer shadow active:scale-95"
            title="Return to Lobby"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-black font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
                ANDAR BAHAR
              </span>
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[8px] sm:text-[9px] font-black font-mono px-1.5 py-0.2 rounded-full uppercase animate-pulse">
                LIVE HD
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-slate-400 font-mono leading-none">
              <span>ROUND: <strong className="text-amber-400">{roundId}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Side: Prominent Balance + Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Prominent Real Wallet Balance Pill */}
          <div 
            onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
            className="flex items-center bg-slate-900 border-2 border-amber-400/80 hover:border-amber-300 rounded-xl px-2 sm:px-3 py-1 cursor-pointer shadow-lg shadow-amber-500/10 transition-all active:scale-95 group"
            title="Tap to deposit money into wallet"
          >
            <div className="flex flex-col text-right mr-1.5 sm:mr-2">
              <span className="text-[8px] sm:text-[9px] text-amber-400/80 font-mono font-bold leading-none uppercase">WALLET</span>
              <span className="text-xs sm:text-sm font-black font-mono text-amber-300 group-hover:text-amber-200 whitespace-nowrap">
                ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center shadow group-hover:bg-amber-400 transition-colors">
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>

          {/* History Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowHistoryModal(true);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer shadow active:scale-95"
            title="Bet History & Results"
          >
            <History className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Rules Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowRulesModal(true);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer shadow active:scale-95"
            title="Game Rules"
          >
            <HelpCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const muted = soundFx.toggleMute();
              setIsMuted(muted);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer shadow active:scale-95"
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-400" /> : <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN CASINO FELT STAGE (FITS 100% IN FULL SCREEN WITHOUT SCROLLBAR) */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-1.5 sm:p-2.5 flex flex-col justify-between gap-1.5 sm:gap-2 overflow-hidden">
        
        {/* TOP SECTION: DEALER SHOE & JOKER TRUMP CARD */}
        <div className="relative bg-gradient-to-b from-emerald-950/90 via-slate-950 to-slate-950 border border-emerald-500/40 rounded-2xl p-2 sm:p-3 shadow-xl overflow-hidden shrink-0">
          {/* Ambient Felt Lighting Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-20 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-2">
            
            {/* Left: Round Status & Timer Banner */}
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                {/* Circular Timer Ring */}
                <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-xl flex flex-col items-center justify-center font-mono font-black border-2 transition-all ${
                  gamePhase === 'betting'
                    ? countdown <= 4 
                      ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-bounce' 
                      : 'bg-amber-950/90 border-amber-400 text-amber-300'
                    : gamePhase === 'dealing'
                    ? 'bg-purple-950/90 border-purple-400 text-purple-300 animate-pulse'
                    : 'bg-emerald-950/90 border-emerald-400 text-emerald-300'
                }`}>
                  <span className="text-[9px] text-slate-400 font-bold uppercase -mb-0.5 leading-none">
                    {gamePhase === 'betting' ? 'TIME' : gamePhase === 'dealing' ? 'DEAL' : 'WIN'}
                  </span>
                  <span className="text-base sm:text-xl font-black leading-none mt-0.5">
                    {gamePhase === 'betting' ? `${countdown}s` : gamePhase === 'dealing' ? '⚡' : '🏆'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] sm:text-xs font-black font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    gamePhase === 'betting'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : gamePhase === 'dealing'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  }`}>
                    {gamePhase === 'betting' ? '🟢 BETS OPEN' : gamePhase === 'dealing' ? '🟡 DEALING...' : `🔴 ${winningSide?.toUpperCase()} WON`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-mono mt-0.5 line-clamp-1">
                  {gamePhase === 'betting' 
                    ? 'Place chips on Andar or Bahar' 
                    : gamePhase === 'dealing'
                    ? 'Matching card rank decides the winner!'
                    : `Winning match: ${winningCard?.rank} on ${winningSide?.toUpperCase()}`
                  }
                </p>
              </div>
            </div>

            {/* Center: THE JOKER TRUMP CARD */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-[9px] font-black font-mono uppercase tracking-widest text-amber-400 mb-0.5 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" />
                <span>JOKER (TRUMP)</span>
              </span>
              <div className="p-1 sm:p-1.5 bg-slate-900/90 rounded-xl border-2 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.5)] transform hover:scale-105 transition-transform">
                <PlayingCardView
                  card={jokerCard || undefined}
                  size="sm"
                  isFaceDown={!jokerCard}
                />
              </div>
              <span className="text-[9px] text-slate-300 font-mono mt-0.5">
                Target: <strong className="text-amber-300">{jokerCard ? jokerCard.rank : '?'}</strong>
              </span>
            </div>

            {/* Right: Live Table Bet Volume */}
            <div className="hidden xs:flex flex-col items-end gap-0.5 font-mono text-right text-xs shrink-0">
              <div className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-0.5">
                <div className="flex items-center gap-1.5 justify-end text-[10px]">
                  <span className="text-cyan-400 font-bold">ANDAR: ₹{tableBetsAndar.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end text-[10px]">
                  <span className="text-amber-400 font-bold">BAHAR: ₹{tableBetsBahar.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* MIDDLE SECTION: DUAL BETTING SPOTS (ANDAR & BAHAR) & DEALT CARDS TRAYS */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
          
          {/* === ANDAR (INSIDE) BETTING SPOT === */}
          <div
            onClick={() => handlePlaceBet('andar')}
            className={`relative rounded-2xl p-2 sm:p-3 border-2 transition-all flex flex-col justify-between cursor-pointer overflow-hidden ${
              winningSide === 'andar'
                ? 'bg-gradient-to-b from-cyan-950 via-slate-900 to-slate-950 border-cyan-400 ring-4 ring-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.6)]'
                : dealingActiveSide === 'andar'
                ? 'bg-gradient-to-b from-cyan-950/80 via-slate-950 to-slate-950 border-cyan-400 shadow-xl'
                : userBetAndar > 0
                ? 'bg-gradient-to-b from-cyan-950/50 via-slate-950 to-slate-950 border-cyan-500/60 shadow-md'
                : 'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-cyan-500/30 hover:border-cyan-400'
            }`}
          >
            {/* Spot Header */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-md shadow-cyan-400" />
                <h3 className="text-xs sm:text-sm font-black font-mono text-cyan-300 tracking-wider">
                  ANDAR (IN)
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded-full">
                {config.andarMultiplier || 1.95}x
              </span>
            </div>

            {/* Dealt Cards Tray for Andar (Flex Carousel) */}
            <div className="my-1.5 flex-1 flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 scrollbar-thin">
              {andarCards.length === 0 ? (
                <div className="w-full h-full min-h-[50px] flex items-center justify-center text-slate-400 text-[10px] font-mono border border-dashed border-cyan-500/20 rounded-xl">
                  {gamePhase === 'betting' ? 'Tap to bet ANDAR' : 'Waiting cards...'}
                </div>
              ) : (
                andarCards.map((card, idx) => (
                  <PlayingCardView
                    key={`${card.id}_${idx}`}
                    card={card}
                    size="sm"
                    isWinningCard={winningSide === 'andar' && card.rank === jokerCard?.rank && idx === andarCards.length - 1}
                    isNewDealt={idx === andarCards.length - 1}
                  />
                ))
              )}
            </div>

            {/* Bottom Bet Area & User Chips Stack */}
            <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20 shrink-0">
              <div className="text-left font-mono hidden xs:block">
                <span className="text-[8px] text-slate-400 block font-bold leading-none">TOTAL</span>
                <span className="text-[10px] font-black text-cyan-300">
                  ₹{tableBetsAndar.toLocaleString('en-IN')}
                </span>
              </div>

              {/* User Bet Pill */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-xl font-mono border ${
                userBetAndar > 0
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md shadow-cyan-500/40 animate-pulse'
                  : 'bg-slate-900 text-cyan-400 border-cyan-500/30 text-[10px]'
              }`}>
                <span className="text-[8px] uppercase font-bold">MY BET:</span>
                <span className="text-[11px] sm:text-xs font-black">
                  ₹{userBetAndar.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* === BAHAR (OUTSIDE) BETTING SPOT === */}
          <div
            onClick={() => handlePlaceBet('bahar')}
            className={`relative rounded-2xl p-2 sm:p-3 border-2 transition-all flex flex-col justify-between cursor-pointer overflow-hidden ${
              winningSide === 'bahar'
                ? 'bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-amber-400 ring-4 ring-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.6)]'
                : dealingActiveSide === 'bahar'
                ? 'bg-gradient-to-b from-amber-950/80 via-slate-950 to-slate-950 border-amber-400 shadow-xl'
                : userBetBahar > 0
                ? 'bg-gradient-to-b from-amber-950/50 via-slate-950 to-slate-950 border-amber-500/60 shadow-md'
                : 'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-amber-500/30 hover:border-amber-400'
            }`}
          >
            {/* Spot Header */}
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-md shadow-amber-400" />
                <h3 className="text-xs sm:text-sm font-black font-mono text-amber-300 tracking-wider">
                  BAHAR (OUT)
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-full">
                {config.baharMultiplier || 1.95}x
              </span>
            </div>

            {/* Dealt Cards Tray for Bahar (Flex Carousel) */}
            <div className="my-1.5 flex-1 flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 scrollbar-thin">
              {baharCards.length === 0 ? (
                <div className="w-full h-full min-h-[50px] flex items-center justify-center text-slate-400 text-[10px] font-mono border border-dashed border-amber-500/20 rounded-xl">
                  {gamePhase === 'betting' ? 'Tap to bet BAHAR' : 'Waiting cards...'}
                </div>
              ) : (
                baharCards.map((card, idx) => (
                  <PlayingCardView
                    key={`${card.id}_${idx}`}
                    card={card}
                    size="sm"
                    isWinningCard={winningSide === 'bahar' && card.rank === jokerCard?.rank && idx === baharCards.length - 1}
                    isNewDealt={idx === baharCards.length - 1}
                  />
                ))
              )}
            </div>

            {/* Bottom Bet Area & User Chips Stack */}
            <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 shrink-0">
              <div className="text-left font-mono hidden xs:block">
                <span className="text-[8px] text-slate-400 block font-bold leading-none">TOTAL</span>
                <span className="text-[10px] font-black text-amber-300">
                  ₹{tableBetsBahar.toLocaleString('en-IN')}
                </span>
              </div>

              {/* User Bet Pill */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-xl font-mono border ${
                userBetBahar > 0
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md shadow-amber-500/40 animate-pulse'
                  : 'bg-slate-900 text-amber-400 border-amber-500/30 text-[10px]'
              }`}>
                <span className="text-[8px] uppercase font-bold">MY BET:</span>
                <span className="text-[11px] sm:text-xs font-black">
                  ₹{userBetBahar.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION: CHIP SELECTOR, QUICK ACTIONS & LIVE ROADMAP */}
        <div className="space-y-1.5 shrink-0">
          
          {/* Interactive Chips Bar */}
          <div className="p-1.5 sm:p-2 bg-slate-900/95 border border-slate-800 rounded-2xl flex items-center justify-between gap-1.5">
            
            {/* Chips selector */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
              {CHIP_VALUES.map((val) => {
                const isSelected = selectedChip === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedChip(val);
                    }}
                    className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex flex-col items-center justify-center font-mono font-black border-2 transition-all transform cursor-pointer ${
                      isSelected
                        ? 'scale-110 -translate-y-0.5 ring-2 ring-amber-400 shadow-lg z-10'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    } ${
                      val === 10
                        ? 'bg-gradient-to-br from-slate-700 to-slate-900 border-slate-400 text-white'
                        : val === 50
                        ? 'bg-gradient-to-br from-rose-600 to-rose-900 border-rose-300 text-white'
                        : val === 100
                        ? 'bg-gradient-to-br from-blue-600 to-blue-900 border-blue-300 text-white'
                        : val === 500
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-900 border-emerald-300 text-white'
                        : val === 1000
                        ? 'bg-gradient-to-br from-purple-600 to-purple-900 border-purple-300 text-white'
                        : 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-200 text-slate-950'
                    }`}
                  >
                    <span className="text-[6px] leading-none opacity-80">₹</span>
                    <span className="text-[9px] sm:text-[11px] leading-tight font-black">
                      {val >= 1000 ? `${val / 1000}k` : val}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Action Buttons: Clear, Double, Re-Bet */}
            <div className="flex items-center gap-1 font-mono shrink-0">
              <button
                type="button"
                onClick={handleClearBets}
                disabled={gamePhase !== 'betting' || (userBetAndar === 0 && userBetBahar === 0)}
                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-[10px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer"
                title="Clear current placed bets"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden xs:inline">CLEAR</span>
              </button>

              <button
                type="button"
                onClick={handleDoubleBets}
                disabled={gamePhase !== 'betting' || (userBetAndar === 0 && userBetBahar === 0)}
                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-400 font-bold text-[10px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer"
                title="Double placed bets (2X)"
              >
                <Zap className="w-3 h-3" />
                <span>2X</span>
              </button>

              <button
                type="button"
                onClick={handleReBet}
                disabled={gamePhase !== 'betting' || !lastBets}
                className="px-2 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-black text-[10px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow"
                title="Re-bet last round amount"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RE-BET</span>
              </button>
            </div>

          </div>

          {/* Bead Plate / Streak Road Bar */}
          <div className="px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
            {/* Stats percentages */}
            <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
              <div className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>A: {andarPercentage}%</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>B: {baharPercentage}%</span>
              </div>
            </div>

            {/* Bead history circles */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {roadHistory.map((item, idx) => (
                <div
                  key={`${item.id}_${idx}`}
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-black text-[8px] shadow-sm shrink-0 border ${
                    item.winner === 'andar'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-400'
                      : 'bg-amber-950 text-amber-300 border-amber-400'
                  }`}
                  title={`Winner: ${item.winner.toUpperCase()} • Cards: ${item.cardsCount} • Rank: ${item.rank}`}
                >
                  <span>{item.winner === 'andar' ? 'A' : 'B'}</span>
                </div>
              ))}
            </div>

          </div>

        </div>

      </main>

      {/* WIN CELEBRATION MODAL */}
      {showWinCelebration && roundWinAmount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-75 duration-300">
          <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-amber-400 rounded-3xl p-6 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.6)]">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 mx-auto flex items-center justify-center animate-bounce">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-widest block">
                CONGRATULATIONS!
              </span>
              <h3 className="text-2xl sm:text-3xl font-black font-mono text-white">
                {winningSide?.toUpperCase()} WON!
              </h3>
              <p className="text-xs text-slate-300 font-mono">
                Matching Card: <strong className="text-amber-300">{winningCard?.rank}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-amber-500/30">
              <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">
                PAYOUT CREDITED
              </span>
              <span className="text-3xl font-black font-mono text-emerald-400 block mt-0.5">
                +₹{roundWinAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setShowWinCelebration(false);
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-mono font-black text-sm rounded-2xl shadow-lg transition-all cursor-pointer"
            >
              COLLECT & CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* GAME RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden text-white space-y-4 max-h-[90vh] overflow-y-auto font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">ANDAR BAHAR RULES</h3>
              </div>
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowRulesModal(false);
                }}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-amber-400 block">1. The Joker Card (Trump):</strong>
                <span>One card is dealt face-up in the center as the Joker (e.g. 8 of Spades). The rank (8) is the target number for this round.</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-cyan-400 block">2. Andar vs Bahar Betting:</strong>
                <span>You can place your bets on <strong>Andar (Inside)</strong> or <strong>Bahar (Outside)</strong> before the betting countdown timer ends.</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-emerald-400 block">3. Card Dealing & Winning Rule:</strong>
                <span>Cards are dealt one by one alternately to Andar, then Bahar, then Andar... The first card that matches the Joker's rank decides the round! If it falls on Andar, Andar wins. If on Bahar, Bahar wins.</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-purple-400 block">4. Payouts:</strong>
                <span>• Andar Win: {config.andarMultiplier || 1.95}x<br />• Bahar Win: {config.baharMultiplier || 1.95}x</span>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setShowRulesModal(false);
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* BET & ROUND HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-4 max-h-[90vh] flex flex-col font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">MY ANDAR BAHAR BETS</h3>
              </div>
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowHistoryModal(false);
                }}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {myBetsHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No bets recorded yet. Place bets on Andar or Bahar to see history here!
                </div>
              ) : (
                myBetsHistory.map((bet) => (
                  <div
                    key={bet.id}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase border ${
                          bet.side === 'andar' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {bet.side}
                        </span>
                        <span className="text-[10px] text-slate-400">{bet.roundId}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(bet.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-slate-400">Bet: ₹{bet.amount}</span>
                        <span className={`font-black ${bet.status === 'won' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {bet.status === 'won' ? `+₹${bet.wonAmount}` : '-LOSS'}
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold uppercase ${bet.status === 'won' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {bet.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setShowHistoryModal(false);
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
