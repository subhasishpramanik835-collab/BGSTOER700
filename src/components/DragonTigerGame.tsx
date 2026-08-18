import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Volume2, VolumeX, Sparkles, HelpCircle, History, 
  RotateCcw, Trash2, Zap, CheckCircle2, ChevronRight, Crown, 
  TrendingUp, ShieldCheck, Plus, AlertTriangle, Layers, Award,
  Flame, RefreshCw
} from 'lucide-react';
import { User, WalletTransaction, DragonTigerConfig, DragonTigerRound, DragonTigerBet, PlayingCard, DragonTigerSide } from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  DEFAULT_DRAGON_TIGER_CONFIG, 
  determineDragonTigerWinner, 
  simulateDragonTigerRound, 
  calculateDragonTigerPayout,
  getRankNumericValue
} from '../utils/dragonTiger';
import { PlayingCardView } from './PlayingCardView';
import confetti from 'canvas-confetti';

interface DragonTigerGameProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
}

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

export const DragonTigerGame: React.FC<DragonTigerGameProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit
}) => {
  // Game Configuration State (synced with Firestore)
  const [config, setConfig] = useState<DragonTigerConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_dragon_tiger_config');
      return cached ? { ...DEFAULT_DRAGON_TIGER_CONFIG, ...JSON.parse(cached) } : DEFAULT_DRAGON_TIGER_CONFIG;
    } catch {
      return DEFAULT_DRAGON_TIGER_CONFIG;
    }
  });
  const configRef = useRef<DragonTigerConfig>(config);
  configRef.current = config;

  // Game Lifecycle States
  const [gamePhase, setGamePhase] = useState<'betting' | 'dealing' | 'completed'>('betting');
  const [countdown, setCountdown] = useState<number>(config.bettingDurationSeconds || 15);
  const [roundId, setRoundId] = useState<string>(() => generateRoundId());
  
  // Card states
  const [dragonCard, setDragonCard] = useState<PlayingCard | null>(null);
  const [tigerCard, setTigerCard] = useState<PlayingCard | null>(null);
  const [isDragonCardRevealed, setIsDragonCardRevealed] = useState<boolean>(false);
  const [isTigerCardRevealed, setIsTigerCardRevealed] = useState<boolean>(false);
  const [winningSide, setWinningSide] = useState<DragonTigerSide | null>(null);

  // Betting States
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [userBetDragon, setUserBetDragon] = useState<number>(0);
  const [userBetTiger, setUserBetTiger] = useState<number>(0);
  const [userBetTie, setUserBetTie] = useState<number>(0);
  const [lastBets, setLastBets] = useState<{ dragon: number; tiger: number; tie: number } | null>(null);

  // Synchronous Refs to eliminate any stale closures across setInterval/setTimeout loops
  const userBetDragonRef = useRef<number>(0);
  const userBetTigerRef = useRef<number>(0);
  const userBetTieRef = useRef<number>(0);

  // Simulated Table Bets (Authentic Asian Casino Vibe)
  const [tableBetsDragon, setTableBetsDragon] = useState<number>(3450);
  const [tableBetsTiger, setTableBetsTiger] = useState<number>(4120);
  const [tableBetsTie, setTableBetsTie] = useState<number>(850);
  const [tablePlayersCount, setTablePlayersCount] = useState<number>(48);

  // User Win/Result popup
  const [roundWinAmount, setRoundWinAmount] = useState<number | null>(null);
  const [showWinCelebration, setShowWinCelebration] = useState<boolean>(false);

  // UI Modals
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Road history / Bead plate
  const [roadHistory, setRoadHistory] = useState<{ id: string; winner: DragonTigerSide; dragonRank: string; tigerRank: string }[]>([
    { id: '1', winner: 'dragon', dragonRank: 'K', tigerRank: '7' },
    { id: '2', winner: 'tiger', dragonRank: '4', tigerRank: '9' },
    { id: '3', winner: 'dragon', dragonRank: 'A', tigerRank: '3' },
    { id: '4', winner: 'tiger', dragonRank: '8', tigerRank: 'Q' },
    { id: '5', winner: 'tie', dragonRank: 'J', tigerRank: 'J' },
    { id: '6', winner: 'dragon', dragonRank: '10', tigerRank: '5' },
    { id: '7', winner: 'dragon', dragonRank: 'Q', tigerRank: '6' },
    { id: '8', winner: 'tiger', dragonRank: '2', tigerRank: 'K' },
    { id: '9', winner: 'tiger', dragonRank: '7', tigerRank: '8' },
    { id: '10', winner: 'dragon', dragonRank: 'K', tigerRank: 'J' },
  ]);

  // User's bet records
  const [myBetsHistory, setMyBetsHistory] = useState<DragonTigerBet[]>(() => {
    try {
      const cached = localStorage.getItem(`bg_dt_my_bets_${user.id}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  function generateRoundId(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `DT-${dateStr}-${rand}`;
  }

  // User balance ref to maintain authoritative latest balance during gameplay without race conditions
  const balanceRef = useRef<number>(user.balance);
  useEffect(() => {
    // Only sync from external user prop if no active bets are currently placed on table AND in betting phase
    if (userBetDragonRef.current === 0 && userBetTigerRef.current === 0 && userBetTieRef.current === 0 && gamePhase === 'betting') {
      balanceRef.current = typeof user.balance === 'number' ? user.balance : 0;
    }
  }, [user.balance, gamePhase]);

  // 1. Listen to Realtime Config from Firestore collection `game_settings`
  useEffect(() => {
    // Primary: centralized game_settings collection
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'dragon_tiger'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setConfig((prev) => {
          const next: DragonTigerConfig = {
            ...prev,
            isEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isEnabled,
            minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
            dragonMultiplier: data.multiplierPrimary !== undefined ? data.multiplierPrimary : (data.dragonMultiplier || prev.dragonMultiplier),
            tigerMultiplier: data.multiplierSecondary !== undefined ? data.multiplierSecondary : (data.tigerMultiplier || prev.tigerMultiplier),
            tieMultiplier: data.tieMultiplier !== undefined ? data.tieMultiplier : (data.tieMultiplier || prev.tieMultiplier),
            rtpMode: data.rtpMode === 'house_protect' ? 'house_protect' : data.rtpMode === 'manual_force' ? 'manual_force_winner' : (data.rtpMode || prev.rtpMode),
          };
          try {
            localStorage.setItem('bg_dragon_tiger_config', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }, (err) => console.warn('Dragon Tiger game_settings listener notice:', err.message));

    // Fallback: legacy config doc
    const unsubLegacy = onSnapshot(doc(db, 'dragon_tiger_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<DragonTigerConfig>;
        setConfig((prev) => {
          const next = { ...prev, ...data };
          try {
            localStorage.setItem('bg_dragon_tiger_config', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }, (err) => console.warn('Dragon Tiger config listener notice:', err.message));

    return () => {
      unsubGameSettings();
      unsubLegacy();
    };
  }, []);

  // 2. Initialize First Round on mount
  useEffect(() => {
    startNewBettingRound();
  }, []);

  // Setup a new betting round
  const startNewBettingRound = () => {
    setDragonCard(null);
    setTigerCard(null);
    setIsDragonCardRevealed(false);
    setIsTigerCardRevealed(false);
    setWinningSide(null);
    setRoundWinAmount(null);
    setShowWinCelebration(false);

    // Reset user bets refs and state for new round
    userBetDragonRef.current = 0;
    userBetTigerRef.current = 0;
    userBetTieRef.current = 0;
    setUserBetDragon(0);
    setUserBetTiger(0);
    setUserBetTie(0);

    // Randomize initial table live bets
    setTableBetsDragon(Math.floor(2000 + Math.random() * 5000));
    setTableBetsTiger(Math.floor(2000 + Math.random() * 5000));
    setTableBetsTie(Math.floor(400 + Math.random() * 1500));
    setTablePlayersCount(Math.floor(35 + Math.random() * 30));

    const nextRoundId = generateRoundId();
    setRoundId(nextRoundId);
    setCountdown(configRef.current.bettingDurationSeconds || 15);
    setGamePhase('betting');
  };

  // 3. Countdown Timer Loop
  useEffect(() => {
    if (gamePhase !== 'betting') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleBettingClosed();
          return 0;
        }

        // Play countdown click
        if (prev <= 4) {
          soundFx.playSpinTick();
        }

        // Live table bet fluctuations
        if (Math.random() > 0.4) {
          setTableBetsDragon((d) => d + (Math.random() > 0.5 ? 100 : 200));
        }
        if (Math.random() > 0.4) {
          setTableBetsTiger((t) => t + (Math.random() > 0.5 ? 100 : 200));
        }
        if (Math.random() > 0.7) {
          setTableBetsTie((tie) => tie + 50);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase]);

  // 4. Betting Closed -> Lock Bets and Start Dealing Sequence
  const handleBettingClosed = () => {
    soundFx.playBetsClosed();
    setGamePhase('dealing');

    // Capture exact bet snapshot from synchronous refs to eliminate any stale closures
    const activeBetsSnapshot = {
      dragon: userBetDragonRef.current,
      tiger: userBetTigerRef.current,
      tie: userBetTieRef.current,
    };

    // Save active bets for re-bet button
    if (activeBetsSnapshot.dragon > 0 || activeBetsSnapshot.tiger > 0 || activeBetsSnapshot.tie > 0) {
      setLastBets(activeBetsSnapshot);
    }

    // Simulate outcome using RTP engine
    const totalDragonBets = tableBetsDragon + activeBetsSnapshot.dragon;
    const totalTigerBets = tableBetsTiger + activeBetsSnapshot.tiger;
    const totalTieBets = tableBetsTie + activeBetsSnapshot.tie;

    const outcome = simulateDragonTigerRound(
      configRef.current,
      totalDragonBets,
      totalTigerBets,
      totalTieBets
    );

    setDragonCard(outcome.dragonCard);
    setTigerCard(outcome.tigerCard);

    // Step-by-step card dealing animation
    setTimeout(() => {
      soundFx.playChipSelect(); // Card dealt sound
    }, 300);

    setTimeout(() => {
      setIsDragonCardRevealed(true);
      soundFx.playWinCoin(); // Card flip
    }, 1000);

    setTimeout(() => {
      soundFx.playChipSelect();
    }, 1700);

    setTimeout(() => {
      setIsTigerCardRevealed(true);
      soundFx.playWinCoin();
    }, 2400);

    setTimeout(() => {
      setWinningSide(outcome.winningSide);
      resolveRoundOutcome(outcome.winningSide, outcome.dragonCard, outcome.tigerCard, activeBetsSnapshot);
    }, 3100);
  };

  // 5. Resolve Round Outcome & User Balance Payouts
  const resolveRoundOutcome = async (
    winner: DragonTigerSide,
    dCard: PlayingCard,
    tCard: PlayingCard,
    activeBets: { dragon: number; tiger: number; tie: number }
  ) => {
    setGamePhase('completed');

    // Audio fanfare based on winning side
    if (winner === 'dragon') {
      soundFx.playDragonRoar();
    } else if (winner === 'tiger') {
      soundFx.playTigerRoar();
    } else {
      soundFx.playTieGong();
    }

    // Calculate total winnings for user using exact snapshot
    let totalWin = 0;
    const betsToProcess: { side: DragonTigerSide; amount: number }[] = [
      { side: 'dragon' as DragonTigerSide, amount: activeBets.dragon },
      { side: 'tiger' as DragonTigerSide, amount: activeBets.tiger },
      { side: 'tie' as DragonTigerSide, amount: activeBets.tie },
    ].filter((b) => b.amount > 0);

    const betRecords: DragonTigerBet[] = [];

    betsToProcess.forEach((b) => {
      const payoutRes = calculateDragonTigerPayout(b, winner, configRef.current);
      totalWin += payoutRes.wonAmount;

      const record: DragonTigerBet = {
        id: `dt_bet_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        roundId,
        userId: user.id,
        userName: user.name,
        userPhone: user.phone,
        side: b.side,
        amount: b.amount,
        payoutMultiplier: b.side === 'tie' ? (configRef.current.tieMultiplier || 9.0) : 2.0,
        wonAmount: payoutRes.wonAmount,
        status: payoutRes.status,
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
      };
      betRecords.push(record);
    });

    // Update road history
    setRoadHistory((prev) => [
      {
        id: Date.now().toString(),
        winner,
        dragonRank: dCard.rank,
        tigerRank: tCard.rank,
      },
      ...prev.slice(0, 24),
    ]);

    // If user won money
    if (totalWin > 0) {
      soundFx.playWinFanfare();
      setRoundWinAmount(totalWin);
      setShowWinCelebration(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Calculate latest balance from balanceRef to prevent stale closure
      const currentBal = balanceRef.current;
      const newBal = currentBal + totalWin;
      balanceRef.current = newBal;

      // Auto-credit user wallet balance with winning payout
      onUpdateBalance(newBal);

      // Create transaction in Firestore and app state
      const tx: WalletTransaction = {
        id: `TX-DT-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: user.id,
        type: 'dragon_tiger_win',
        amount: totalWin,
        description: `Dragon Tiger Win - ${winner.toUpperCase()} (${roundId})`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      };
      onAddTransaction(tx);
    } else if (betsToProcess.length > 0) {
      soundFx.playLossSound();
      setRoundWinAmount(0);
      // Ensure deducted balance is permanently locked in state
      onUpdateBalance(balanceRef.current);
    }

    // Save bet history locally & Firestore
    if (betRecords.length > 0) {
      setMyBetsHistory((prev) => {
        const updated = [...betRecords, ...prev].slice(0, 50);
        try {
          localStorage.setItem(`bg_dt_my_bets_${user.id}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Async write to Firestore
      try {
        for (const bet of betRecords) {
          await setDoc(doc(db, 'dragon_tiger_bets', bet.id), bet);
        }
      } catch (err) {
        console.warn('Failed to save Dragon Tiger bet to Firestore:', err);
      }
    }

    // Save completed round to Firestore
    try {
      const roundDoc: DragonTigerRound = {
        id: roundId,
        roundNumber: parseInt(roundId.split('-')[2] || '1001', 10),
        dragonCard: dCard,
        tigerCard: tCard,
        winningSide: winner,
        status: 'completed',
        startTime: Date.now() - ((configRef.current.bettingDurationSeconds || 15) * 1000),
        endTime: Date.now(),
        totalBetsDragon: tableBetsDragon + activeBets.dragon,
        totalBetsTiger: tableBetsTiger + activeBets.tiger,
        totalBetsTie: tableBetsTie + activeBets.tie,
        totalPayout: totalWin,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'dragon_tiger_rounds', roundId), roundDoc);
    } catch (err) {
      console.warn('Failed to save Dragon Tiger round:', err);
    }

    // Auto restart new round after 6.5 seconds
    setTimeout(() => {
      startNewBettingRound();
    }, 6500);
  };

  // 6. User Places Bet on a Side
  const handlePlaceBet = (side: DragonTigerSide) => {
    if (gamePhase !== 'betting') {
      soundFx.playError();
      return;
    }

    if (countdown <= 0) {
      soundFx.playError();
      return;
    }

    const minBet = config.minBet || 10;
    const maxBet = config.maxBet || 50000;

    if (selectedChip < minBet) {
      alert(`Minimum bet is ₹${minBet}`);
      return;
    }

    const currentBal = balanceRef.current;
    if (currentBal < selectedChip) {
      soundFx.playError();
      alert('Insufficient wallet balance! Please deposit to continue.');
      onOpenDeposit();
      return;
    }

    // Check individual side max bet limit
    const currentBetOnSide = side === 'dragon' ? userBetDragonRef.current : side === 'tiger' ? userBetTigerRef.current : userBetTieRef.current;
    if (currentBetOnSide + selectedChip > maxBet) {
      alert(`Maximum bet per side is ₹${maxBet.toLocaleString()}`);
      return;
    }

    // Deduct chip amount from balance
    const newBal = Math.max(0, currentBal - selectedChip);
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    // Record bet transaction in app state and Firestore
    const betTx: WalletTransaction = {
      id: `TX-DT-BET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: user.id,
      type: 'dragon_tiger_bet',
      amount: selectedChip,
      description: `Dragon Tiger Bet on ${side.toUpperCase()} (${roundId})`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };
    onAddTransaction(betTx);

    // Play chip placement sound
    soundFx.playChipPlacement();

    if (side === 'dragon') {
      userBetDragonRef.current += selectedChip;
      setUserBetDragon((prev) => prev + selectedChip);
      setTableBetsDragon((prev) => prev + selectedChip);
    } else if (side === 'tiger') {
      userBetTigerRef.current += selectedChip;
      setUserBetTiger((prev) => prev + selectedChip);
      setTableBetsTiger((prev) => prev + selectedChip);
    } else if (side === 'tie') {
      userBetTieRef.current += selectedChip;
      setUserBetTie((prev) => prev + selectedChip);
      setTableBetsTie((prev) => prev + selectedChip);
    }

    logAnalyticsEvent('dragon_tiger_bet_placed', {
      side,
      amount: selectedChip,
      roundId,
    });
  };

  // 7. Clear Current Round Bets
  const handleClearBets = () => {
    if (gamePhase !== 'betting') return;
    const totalPlaced = userBetDragonRef.current + userBetTigerRef.current + userBetTieRef.current;
    if (totalPlaced <= 0) return;

    soundFx.playClick();
    const currentBal = balanceRef.current;
    const newBal = currentBal + totalPlaced;
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    setTableBetsDragon((prev) => Math.max(0, prev - userBetDragonRef.current));
    setTableBetsTiger((prev) => Math.max(0, prev - userBetTigerRef.current));
    setTableBetsTie((prev) => Math.max(0, prev - userBetTieRef.current));

    userBetDragonRef.current = 0;
    userBetTigerRef.current = 0;
    userBetTieRef.current = 0;
    setUserBetDragon(0);
    setUserBetTiger(0);
    setUserBetTie(0);
  };

  // 8. Double Current Bets (2X)
  const handleDoubleBets = () => {
    if (gamePhase !== 'betting') return;
    const totalPlaced = userBetDragonRef.current + userBetTigerRef.current + userBetTieRef.current;
    if (totalPlaced <= 0) return;

    const currentBal = balanceRef.current;
    if (currentBal < totalPlaced) {
      soundFx.playError();
      alert('Insufficient balance to double your bets!');
      return;
    }

    soundFx.playCoin();
    const newBal = Math.max(0, currentBal - totalPlaced);
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    setTableBetsDragon((prev) => prev + userBetDragonRef.current);
    setTableBetsTiger((prev) => prev + userBetTigerRef.current);
    setTableBetsTie((prev) => prev + userBetTieRef.current);

    userBetDragonRef.current *= 2;
    userBetTigerRef.current *= 2;
    userBetTieRef.current *= 2;

    setUserBetDragon(userBetDragonRef.current);
    setUserBetTiger(userBetTigerRef.current);
    setUserBetTie(userBetTieRef.current);
  };

  // 9. Re-Bet (Repeat Last Round Bets)
  const handleReBet = () => {
    if (gamePhase !== 'betting' || !lastBets) return;
    const totalToPlace = lastBets.dragon + lastBets.tiger + lastBets.tie;
    if (totalToPlace <= 0) return;

    const currentBal = balanceRef.current;
    if (currentBal < totalToPlace) {
      soundFx.playError();
      alert('Insufficient balance to repeat previous bets!');
      return;
    }

    soundFx.playCoin();
    const newBal = Math.max(0, currentBal - totalToPlace);
    balanceRef.current = newBal;
    onUpdateBalance(newBal);

    userBetDragonRef.current = lastBets.dragon;
    userBetTigerRef.current = lastBets.tiger;
    userBetTieRef.current = lastBets.tie;

    setUserBetDragon(lastBets.dragon);
    setUserBetTiger(lastBets.tiger);
    setUserBetTie(lastBets.tie);

    setTableBetsDragon((prev) => prev + lastBets.dragon);
    setTableBetsTiger((prev) => prev + lastBets.tiger);
    setTableBetsTie((prev) => prev + lastBets.tie);
  };

  // Calculate Win Percentages for Bead Road
  const dragonWinsCount = roadHistory.filter((r) => r.winner === 'dragon').length;
  const tigerWinsCount = roadHistory.filter((r) => r.winner === 'tiger').length;
  const tieWinsCount = roadHistory.filter((r) => r.winner === 'tie').length;
  const totalCount = roadHistory.length || 1;

  const dragonPct = Math.round((dragonWinsCount / totalCount) * 100);
  const tigerPct = Math.round((tigerWinsCount / totalCount) * 100);
  const tiePct = Math.round((tieWinsCount / totalCount) * 100);

  const totalUserBets = userBetDragon + userBetTiger + userBetTie;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col font-sans overflow-hidden select-none animate-in fade-in duration-300">
      
      {/* 1. TOP CASINO NAVIGATION HEADER */}
      <header className="h-14 sm:h-16 px-3 sm:px-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/30 flex items-center justify-between shadow-2xl z-30">
        
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Exit Casino"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 via-amber-600 to-yellow-500 p-0.5 shadow-lg shadow-red-500/20 flex items-center justify-center">
              <span className="text-xl">🐉</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black font-mono tracking-wider text-white uppercase flex items-center gap-1">
                  <span>DRAGON TIGER</span>
                  <span className="text-[10px] text-amber-400 font-serif">龙虎斗</span>
                </h1>
                <span className="px-1.5 py-0.2 bg-rose-600/90 text-white text-[8px] font-black rounded uppercase animate-pulse">
                  LIVE HD
                </span>
              </div>
              <p className="text-[10px] text-amber-400 font-mono flex items-center gap-1.5">
                <span>{roundId}</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400">● {tablePlayersCount} Online</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Wallet Balance, Sounds, Modals */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Realtime Wallet Balance Pill */}
          <div className="flex items-center bg-slate-900/90 border border-amber-500/40 rounded-2xl pl-2.5 pr-1 py-1 shadow-inner">
            <div className="flex flex-col text-right mr-1.5">
              <span className="text-[8px] text-slate-400 font-mono uppercase leading-tight">Balance</span>
              <span className="text-xs sm:text-sm font-black font-mono text-amber-400 leading-tight">
                ₹{(user.balance || 0).toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenDeposit();
              }}
              className="w-7 h-7 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black flex items-center justify-center hover:scale-105 transition-transform shadow-md cursor-pointer"
              title="Add Money"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              const muted = soundFx.toggleMute();
              setIsMuted(muted);
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted 
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' 
                : 'bg-slate-900 border-slate-700 hover:border-amber-400 text-amber-400'
            }`}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Rules Modal Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowRulesModal(true);
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Game Rules & Payouts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Bet History Modal Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setShowHistoryModal(true);
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer relative"
            title="My Bets History"
          >
            <History className="w-4 h-4" />
            {myBetsHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN CASINO ARENA & FELT (FLEX CONTAINER) */}
      <main className="flex-1 flex flex-col justify-between overflow-y-auto px-2 sm:px-4 py-2 sm:py-3 space-y-2.5 sm:space-y-4 max-w-4xl mx-auto w-full">

        {/* STATUS BAR & COUNTDOWN TIMER */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-900/90 via-slate-900/90 to-slate-900/90 border border-amber-500/20 rounded-2xl shadow-xl font-mono">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              gamePhase === 'betting' 
                ? 'bg-emerald-400 animate-ping' 
                : gamePhase === 'dealing' 
                ? 'bg-amber-400 animate-spin' 
                : 'bg-yellow-400'
            }`} />
            <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-white">
              {gamePhase === 'betting' && `PLACE YOUR BETS (${countdown}s)`}
              {gamePhase === 'dealing' && 'BETS LOCKED • DEALING CARDS...'}
              {gamePhase === 'completed' && (
                winningSide === 'dragon' ? '🔥 DRAGON WINS THE ROUND!' :
                winningSide === 'tiger' ? '⚡ TIGER WINS THE ROUND!' :
                '✨ IT IS A TIE (和)!'
              )}
            </span>
          </div>

          {/* Circular Countdown Progress Badge */}
          {gamePhase === 'betting' ? (
            <div className={`px-2.5 py-1 rounded-xl font-black text-xs sm:text-sm border flex items-center gap-1.5 shadow-md ${
              countdown <= 4 
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-bounce' 
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{countdown} SEC</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase">
              {gamePhase === 'dealing' ? 'DEALING...' : 'NEW ROUND IN 6s'}
            </div>
          )}
        </div>

        {/* 3. THE LIVE DRAGON VS TIGER BATTLE ARENA */}
        <div className="relative rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/40 p-3 sm:p-5 shadow-2xl overflow-hidden">
          
          {/* Subtle Ambient Background Watermarks */}
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-9xl opacity-5 pointer-events-none select-none">
            🐉
          </div>
          <div className="absolute -right-10 top-1/2 -translate-y-1/2 text-9xl opacity-5 pointer-events-none select-none">
            🐅
          </div>

          <div className="grid grid-cols-3 items-center gap-2 sm:gap-4 relative z-10">
            
            {/* LEFT: DRAGON (龙) CARD ZONE */}
            <div className={`flex flex-col items-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 ${
              winningSide === 'dragon' 
                ? 'bg-gradient-to-b from-red-950/90 via-red-900/60 to-slate-950 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-105 ring-2 ring-red-400' 
                : 'bg-slate-900/60 border-red-500/30 hover:border-red-500/50'
            }`}>
              {/* Dragon Crest */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xl sm:text-2xl">🐉</span>
                <span className="text-sm sm:text-base font-black font-mono tracking-widest text-red-400 uppercase">
                  DRAGON
                </span>
              </div>

              {/* Card Container */}
              <div className="my-1 sm:my-2 min-h-[100px] sm:min-h-[140px] flex items-center justify-center">
                {dragonCard ? (
                  <PlayingCardView
                    card={dragonCard}
                    isFaceDown={!isDragonCardRevealed}
                    isWinningCard={winningSide === 'dragon'}
                    size="lg"
                    isNewDealt={true}
                  />
                ) : (
                  <div className="w-22 h-30 sm:w-26 sm:h-36 rounded-2xl border-2 border-dashed border-red-500/40 bg-red-950/20 flex flex-col items-center justify-center text-red-400/60 font-mono text-xs">
                    <Crown className="w-6 h-6 mb-1 opacity-50" />
                    <span>DRAGON</span>
                  </div>
                )}
              </div>

              {/* Card Rank Readout */}
              <div className="mt-2 text-center">
                <span className="text-[10px] sm:text-xs font-mono font-bold text-red-300">
                  {isDragonCardRevealed && dragonCard 
                    ? `RANK: ${dragonCard.rank} (${getRankNumericValue(dragonCard.rank)} PTS)` 
                    : 'PAYS 1:1'}
                </span>
              </div>
            </div>

            {/* CENTER: VS & TIE DISPLAY */}
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-black font-mono text-sm sm:text-lg border-2 shadow-2xl transition-all ${
                winningSide === 'tie'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-400 border-yellow-300 text-slate-950 animate-bounce scale-110 shadow-emerald-500/50'
                  : 'bg-slate-900 border-amber-500/50 text-amber-400 shadow-black'
              }`}>
                {winningSide === 'tie' ? 'TIE!' : 'VS'}
              </div>

              <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl font-mono text-[9px] sm:text-[10px] text-amber-300 font-bold">
                TIE PAYS 8:1
              </div>

              {/* Instant Win Banner if completed */}
              {gamePhase === 'completed' && roundWinAmount !== null && (
                <div className={`animate-in zoom-in-75 p-2 rounded-2xl font-mono font-black text-center border shadow-xl ${
                  roundWinAmount > 0 
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300' 
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}>
                  <p className="text-[9px] uppercase">
                    {roundWinAmount > 0 ? '🏆 YOU WON!' : 'ROUND OVER'}
                  </p>
                  <p className="text-xs sm:text-sm text-amber-400">
                    {roundWinAmount > 0 ? `+₹${roundWinAmount.toLocaleString()}` : 'BETTER LUCK NEXT'}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: TIGER (虎) CARD ZONE */}
            <div className={`flex flex-col items-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 ${
              winningSide === 'tiger' 
                ? 'bg-gradient-to-b from-cyan-950/90 via-cyan-900/60 to-slate-950 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)] scale-105 ring-2 ring-cyan-300' 
                : 'bg-slate-900/60 border-cyan-500/30 hover:border-cyan-500/50'
            }`}>
              {/* Tiger Crest */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xl sm:text-2xl">🐅</span>
                <span className="text-sm sm:text-base font-black font-mono tracking-widest text-cyan-400 uppercase">
                  TIGER
                </span>
              </div>

              {/* Card Container */}
              <div className="my-1 sm:my-2 min-h-[100px] sm:min-h-[140px] flex items-center justify-center">
                {tigerCard ? (
                  <PlayingCardView
                    card={tigerCard}
                    isFaceDown={!isTigerCardRevealed}
                    isWinningCard={winningSide === 'tiger'}
                    size="lg"
                    isNewDealt={true}
                  />
                ) : (
                  <div className="w-22 h-30 sm:w-26 sm:h-36 rounded-2xl border-2 border-dashed border-cyan-500/40 bg-cyan-950/20 flex flex-col items-center justify-center text-cyan-400/60 font-mono text-xs">
                    <Crown className="w-6 h-6 mb-1 opacity-50" />
                    <span>TIGER</span>
                  </div>
                )}
              </div>

              {/* Card Rank Readout */}
              <div className="mt-2 text-center">
                <span className="text-[10px] sm:text-xs font-mono font-bold text-cyan-300">
                  {isTigerCardRevealed && tigerCard 
                    ? `RANK: ${tigerCard.rank} (${getRankNumericValue(tigerCard.rank)} PTS)` 
                    : 'PAYS 1:1'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* 4. THREE MAIN BETTING FELT ZONES (DRAGON / TIE / TIGER) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          
          {/* DRAGON BET BUTTON */}
          <button
            disabled={gamePhase !== 'betting'}
            onClick={() => handlePlaceBet('dragon')}
            className={`group relative p-3 sm:p-4 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer shadow-lg min-h-[95px] sm:min-h-[110px] ${
              gamePhase === 'betting' 
                ? 'hover:scale-[1.03] active:scale-95 bg-gradient-to-b from-red-950/80 via-slate-900 to-red-950/80 border-red-500/60 hover:border-red-400' 
                : 'opacity-80 bg-slate-900 border-slate-800'
            } ${winningSide === 'dragon' ? 'ring-4 ring-red-400 border-red-400 bg-red-950/90' : ''}`}
          >
            <div className="w-full flex items-center justify-between font-mono text-[9px] sm:text-[10px]">
              <span className="text-red-400 font-black">2.0X PAYOUT</span>
              <span className="text-slate-400">₹{tableBetsDragon.toLocaleString()}</span>
            </div>

            <div className="my-1 flex items-center gap-1.5">
              <span className="text-lg sm:text-xl">🐉</span>
              <span className="text-base sm:text-xl font-black font-mono tracking-wider text-red-400 group-hover:text-red-300">
                DRAGON
              </span>
            </div>

            {/* Placed Chip Badge */}
            {userBetDragon > 0 ? (
              <div className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-black text-xs border border-red-400 shadow-md animate-in zoom-in">
                ₹{userBetDragon.toLocaleString()}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Tap to Bet</span>
            )}
          </button>

          {/* TIE BET BUTTON */}
          <button
            disabled={gamePhase !== 'betting'}
            onClick={() => handlePlaceBet('tie')}
            className={`group relative p-3 sm:p-4 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer shadow-lg min-h-[95px] sm:min-h-[110px] ${
              gamePhase === 'betting' 
                ? 'hover:scale-[1.03] active:scale-95 bg-gradient-to-b from-emerald-950/80 via-slate-900 to-emerald-950/80 border-emerald-500/60 hover:border-emerald-400' 
                : 'opacity-80 bg-slate-900 border-slate-800'
            } ${winningSide === 'tie' ? 'ring-4 ring-emerald-400 border-emerald-400 bg-emerald-950/90' : ''}`}
          >
            <div className="w-full flex items-center justify-between font-mono text-[9px] sm:text-[10px]">
              <span className="text-emerald-400 font-black">9.0X (8:1)</span>
              <span className="text-slate-400">₹{tableBetsTie.toLocaleString()}</span>
            </div>

            <div className="my-1 flex items-center gap-1.5">
              <span className="text-lg sm:text-xl">✨</span>
              <span className="text-base sm:text-xl font-black font-mono tracking-wider text-emerald-400 group-hover:text-emerald-300">
                TIE (和)
              </span>
            </div>

            {/* Placed Chip Badge */}
            {userBetTie > 0 ? (
              <div className="px-2 py-0.5 rounded-full bg-emerald-600 text-slate-950 font-mono font-black text-xs border border-emerald-300 shadow-md animate-in zoom-in">
                ₹{userBetTie.toLocaleString()}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Tap to Bet</span>
            )}
          </button>

          {/* TIGER BET BUTTON */}
          <button
            disabled={gamePhase !== 'betting'}
            onClick={() => handlePlaceBet('tiger')}
            className={`group relative p-3 sm:p-4 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer shadow-lg min-h-[95px] sm:min-h-[110px] ${
              gamePhase === 'betting' 
                ? 'hover:scale-[1.03] active:scale-95 bg-gradient-to-b from-cyan-950/80 via-slate-900 to-cyan-950/80 border-cyan-500/60 hover:border-cyan-400' 
                : 'opacity-80 bg-slate-900 border-slate-800'
            } ${winningSide === 'tiger' ? 'ring-4 ring-cyan-400 border-cyan-400 bg-cyan-950/90' : ''}`}
          >
            <div className="w-full flex items-center justify-between font-mono text-[9px] sm:text-[10px]">
              <span className="text-cyan-400 font-black">2.0X PAYOUT</span>
              <span className="text-slate-400">₹{tableBetsTiger.toLocaleString()}</span>
            </div>

            <div className="my-1 flex items-center gap-1.5">
              <span className="text-lg sm:text-xl">🐅</span>
              <span className="text-base sm:text-xl font-black font-mono tracking-wider text-cyan-400 group-hover:text-cyan-300">
                TIGER
              </span>
            </div>

            {/* Placed Chip Badge */}
            {userBetTiger > 0 ? (
              <div className="px-2 py-0.5 rounded-full bg-cyan-600 text-slate-950 font-mono font-black text-xs border border-cyan-300 shadow-md animate-in zoom-in">
                ₹{userBetTiger.toLocaleString()}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Tap to Bet</span>
            )}
          </button>

        </div>

        {/* 5. CERAMIC CASINO CHIP SELECTOR */}
        <div className="p-2.5 sm:p-3 bg-slate-900/90 border border-amber-500/30 rounded-2xl shadow-xl flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 no-scrollbar flex-1">
            {CHIP_VALUES.map((val) => {
              const isSelected = selectedChip === val;
              const chipBg = 
                val === 10 ? 'from-blue-600 to-blue-900 border-blue-400 text-white' :
                val === 50 ? 'from-emerald-600 to-emerald-900 border-emerald-400 text-white' :
                val === 100 ? 'from-red-600 to-red-900 border-red-400 text-white' :
                val === 500 ? 'from-purple-600 to-purple-900 border-purple-400 text-white' :
                val === 1000 ? 'from-amber-500 to-yellow-600 border-amber-300 text-slate-950 font-black' :
                'from-slate-900 to-black border-amber-400 text-amber-400';

              return (
                <button
                  key={val}
                  onClick={() => {
                    soundFx.playChipSelect();
                    setSelectedChip(val);
                  }}
                  className={`relative flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 bg-gradient-to-b flex items-center justify-center font-mono text-[10px] sm:text-xs font-black shadow-md transition-all cursor-pointer ${chipBg} ${
                    isSelected 
                      ? 'scale-115 ring-2 ring-amber-400 -translate-y-1 shadow-[0_0_12px_rgba(245,158,11,0.8)]' 
                      : 'opacity-85 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  ₹{val >= 1000 ? `${val/1000}K` : val}
                </button>
              );
            })}
          </div>

          {/* Quick Action Control Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 pl-2 border-l border-slate-700">
            {/* Clear Bets */}
            <button
              disabled={gamePhase !== 'betting' || totalUserBets <= 0}
              onClick={handleClearBets}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 disabled:opacity-40 transition-all cursor-pointer"
              title="Clear Bets"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Double Bets (2X) */}
            <button
              disabled={gamePhase !== 'betting' || totalUserBets <= 0}
              onClick={handleDoubleBets}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 hover:border-amber-400 disabled:opacity-40 font-mono text-xs font-black transition-all cursor-pointer"
              title="Double Bets (2x)"
            >
              2X
            </button>

            {/* Re-Bet (Repeat Last Round) */}
            <button
              disabled={gamePhase !== 'betting' || !lastBets}
              onClick={handleReBet}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 hover:border-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
              title="Repeat Last Bet"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6. BEAD ROAD / TREND HISTORY ROADMAP */}
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>ROADMAP & TRENDS</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-red-400 font-bold">D: {dragonPct}%</span>
              <span className="text-cyan-400 font-bold">T: {tigerPct}%</span>
              <span className="text-emerald-400 font-bold">Tie: {tiePct}%</span>
            </div>
          </div>

          {/* Bead Badges Grid */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
            {roadHistory.map((item, idx) => (
              <div
                key={idx}
                className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-black border shadow-sm ${
                  item.winner === 'dragon' 
                    ? 'bg-red-600 text-white border-red-400 shadow-red-500/40' 
                    : item.winner === 'tiger' 
                    ? 'bg-cyan-600 text-slate-950 border-cyan-300 shadow-cyan-500/40' 
                    : 'bg-emerald-600 text-slate-950 border-emerald-300 shadow-emerald-500/40'
                }`}
                title={`Round ${item.id}: ${item.winner.toUpperCase()} (${item.dragonRank} vs ${item.tigerRank})`}
              >
                {item.winner === 'dragon' ? 'D' : item.winner === 'tiger' ? 'T' : '和'}
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* 7. RULES & PAYOUT MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 max-w-md w-full shadow-2xl font-mono space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                <span>🐉 DRAGON TIGER RULES</span>
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <h4 className="text-amber-400 font-bold">1. Game Objective</h4>
                <p>Dragon Tiger is a fast-paced live two-card casino game. One card is dealt to Dragon and one to Tiger. The side with the highest card rank wins!</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <h4 className="text-amber-400 font-bold">2. Card Rank Values</h4>
                <p className="text-slate-200 font-black">Ace (1 - Lowest) → 2, 3, 4, 5, 6, 7, 8, 9, 10, J (11), Q (12), K (13 - Highest).</p>
                <p className="text-[11px] text-slate-400">Card suits (♠ ♥ ♣ ♦) have no bearing on the rank hierarchy.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <h4 className="text-amber-400 font-bold">3. Payout Multipliers</h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-200">
                  <li><strong className="text-red-400">Dragon:</strong> Pays 1:1 (2.0x total return).</li>
                  <li><strong className="text-cyan-400">Tiger:</strong> Pays 1:1 (2.0x total return).</li>
                  <li><strong className="text-emerald-400">Tie (和):</strong> Pays 8:1 (9.0x total return) when both cards have the exact same rank.</li>
                  <li><strong className="text-amber-400">Tie Push Rule:</strong> If the result is a Tie, 50% of your Dragon/Tiger bet is refunded!</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black uppercase shadow-lg cursor-pointer"
            >
              GOT IT, LET'S PLAY
            </button>
          </div>
        </div>
      )}

      {/* 8. BET HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-5 max-w-lg w-full shadow-2xl font-mono space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <span>MY DRAGON TIGER BETS</span>
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {myBetsHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No Dragon Tiger bets placed yet in this session. Place your first bet on Dragon or Tiger!
                </div>
              ) : (
                myBetsHistory.map((bet) => (
                  <div
                    key={bet.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                      bet.status === 'won' 
                        ? 'bg-emerald-950/40 border-emerald-500/30' 
                        : bet.status === 'tie_push'
                        ? 'bg-amber-950/40 border-amber-500/30'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          bet.side === 'dragon' ? 'bg-red-600 text-white' :
                          bet.side === 'tiger' ? 'bg-cyan-600 text-slate-950' :
                          'bg-emerald-600 text-slate-950'
                        }`}>
                          {bet.side}
                        </span>
                        <span className="text-slate-300 font-bold">₹{bet.amount.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {bet.roundId} • {new Date(bet.timestamp).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="text-right">
                      {bet.status === 'won' ? (
                        <span className="text-emerald-400 font-black">+₹{(bet.wonAmount || 0).toLocaleString()}</span>
                      ) : bet.status === 'tie_push' ? (
                        <span className="text-amber-400 font-black">REFUND ₹{(bet.wonAmount || 0).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-500 font-bold">-₹{bet.amount.toLocaleString()}</span>
                      )}
                      <p className={`text-[9px] font-black uppercase ${
                        bet.status === 'won' ? 'text-emerald-400' :
                        bet.status === 'tie_push' ? 'text-amber-400' :
                        'text-rose-400'
                      }`}>
                        {bet.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
