import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, X, Volume2, VolumeX, Sparkles, RefreshCw, Trophy, 
  RotateCcw, Zap, DollarSign, ChevronRight, ShieldCheck, Play, HelpCircle,
  History, BarChart2, CheckCircle2, Eye, LayoutGrid, Radio, Bookmark
} from 'lucide-react';
import { User, WalletTransaction, RouletteConfig } from '../types';
import { soundFx } from '../utils/audio';
import { logAnalyticsEvent } from '../utils/analytics';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';

interface LiveRouletteProps {
  user: User;
  onUpdateBalance: (newBalance: number) => void;
  onAddTransaction: (tx: WalletTransaction) => void;
  onClose: () => void;
  onOpenDeposit: () => void;
}

export interface RoundHistoryItem {
  id: string;
  roundId: string;
  number: number;
  color: 'green' | 'red' | 'black';
  parity: 'even' | 'odd' | 'zero';
  range: '1-18' | '19-36' | 'zero';
  dozen: '1st 12' | '2nd 12' | '3rd 12' | 'zero';
  column: 'Col 1' | 'Col 2' | 'Col 3' | 'zero';
  multiplier?: number;
  timestamp: string;
}

export interface UserBetHistoryItem {
  id: string;
  timestamp: string;
  dateKey: string;
  gameName: string;
  betAmount: number;
  resultAmount: number;
  roundId: string;
  winningNumber?: number;
  multiplier?: number;
}

// European Roulette Numbers in Wheel Order
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

const CHIP_VALUES = [10, 50, 100, 500, 1000, 5000];

type BetType = 
  | { kind: 'number'; value: number }
  | { kind: 'color'; value: 'red' | 'black' }
  | { kind: 'parity'; value: 'even' | 'odd' }
  | { kind: 'range'; value: '1-18' | '19-36' }
  | { kind: 'dozen'; value: '1st12' | '2nd12' | '3rd12' }
  | { kind: 'column'; value: 'col1' | 'col2' | 'col3' };

interface PlacedBet {
  id: string;
  type: BetType;
  label: string;
  amount: number;
}

export interface LightningMultiplier {
  number: number;
  multiplier: number;
}

export const LiveRoulette: React.FC<LiveRouletteProps> = ({
  user,
  onUpdateBalance,
  onAddTransaction,
  onClose,
  onOpenDeposit
}) => {
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedBet[]>([]);
  const [gamePhase, setGamePhase] = useState<'betting' | 'lightning' | 'spinning' | 'settled'>('betting');
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [isResultRevealed, setIsResultRevealed] = useState<boolean>(false);
  const [userWonAmount, setUserWonAmount] = useState<number>(0);
  
  // Recent Results Tape at top
  const [recentHistory, setRecentHistory] = useState<{ number: number; multiplier?: number }[]>([
    { number: 14 }, { number: 25 }, { number: 20 }, { number: 32 }, { number: 32 },
    { number: 6 }, { number: 5 }, { number: 32 }, { number: 30 }, { number: 20 },
    { number: 9 }, { number: 24 }, { number: 12 }, { number: 33, multiplier: 500 }
  ]);

  const [fullHistory, setFullHistory] = useState<RoundHistoryItem[]>([
    { id: '1', roundId: 'BG-HLR-395560', number: 14, color: 'red', parity: 'even', range: '1-18', dozen: '2nd 12', column: 'Col 2', timestamp: '12:04:12' },
    { id: '2', roundId: 'BG-HLR-395559', number: 25, color: 'red', parity: 'odd', range: '19-36', dozen: '3rd 12', column: 'Col 1', timestamp: '12:03:46' },
    { id: '3', roundId: 'BG-HLR-395558', number: 20, color: 'black', parity: 'even', range: '19-36', dozen: '2nd 12', column: 'Col 2', timestamp: '12:03:20' },
    { id: '4', roundId: 'BG-HLR-395557', number: 32, color: 'red', parity: 'even', range: '19-36', dozen: '3rd 12', column: 'Col 2', timestamp: '12:02:54' },
    { id: '5', roundId: 'BG-HLR-395556', number: 33, color: 'black', parity: 'odd', range: '19-36', dozen: '3rd 12', column: 'Col 3', multiplier: 500, timestamp: '12:02:28' }
  ]);

  // User Bet History Drawer
  const [showGameHistory, setShowGameHistory] = useState<boolean>(false);
  const [userBetHistory, setUserBetHistory] = useState<UserBetHistoryItem[]>(() => {
    try {
      const cached = localStorage.getItem(`bg_roulette_history_${user.id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    
    return [
      { id: 'h1', timestamp: '23:33:14', dateKey: 'TUESDAY 28 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 40, resultAmount: -40, roundId: 'HLR-395560', winningNumber: 14 },
      { id: 'h2', timestamp: '23:32:25', dateKey: 'TUESDAY 28 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 440, resultAmount: -440, roundId: 'HLR-395559', winningNumber: 25 },
      { id: 'h3', timestamp: '23:31:39', dateKey: 'TUESDAY 28 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 300, resultAmount: -120, roundId: 'HLR-395558', winningNumber: 20 },
      { id: 'h4', timestamp: '23:30:53', dateKey: 'TUESDAY 28 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 140, resultAmount: 460, roundId: 'HLR-395557', winningNumber: 32 },
      { id: 'h5', timestamp: '05:11:30', dateKey: 'FRIDAY 3 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 60, resultAmount: -60, roundId: 'HLR-394210', winningNumber: 6 },
      { id: 'h6', timestamp: '05:10:41', dateKey: 'FRIDAY 3 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 300, resultAmount: -300, roundId: 'HLR-394209', winningNumber: 5 },
      { id: 'h7', timestamp: '05:09:58', dateKey: 'FRIDAY 3 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 300, resultAmount: -300, roundId: 'HLR-394208', winningNumber: 32 },
      { id: 'h8', timestamp: '05:09:14', dateKey: 'FRIDAY 3 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 180, resultAmount: 220, roundId: 'HLR-394207', winningNumber: 30 },
      { id: 'h9', timestamp: '05:07:40', dateKey: 'FRIDAY 3 JULY', gameName: 'Hindi Lightning Roulette', betAmount: 320, resultAmount: -320, roundId: 'HLR-394206', winningNumber: 20 }
    ];
  });

  const [showHistoryOverlay, setShowHistoryOverlay] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [roundId, setRoundId] = useState<string>(() => `HLR-${Math.floor(100000 + Math.random() * 900000)}`);
  const [countdown, setCountdown] = useState<number>(18);
  const [betsLocked, setBetsLocked] = useState<boolean>(false);
  const [dealerMessage, setDealerMessage] = useState<string>('Saanvi: Namaste! Welcome to Hindi Lightning Roulette!');

  // Wheel Animation States
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [ballAngle, setBallAngle] = useState<number>(0);
  const [ballRadius, setBallRadius] = useState<number>(100);
  const [lightningNumbers, setLightningNumbers] = useState<LightningMultiplier[]>([
    { number: 8, multiplier: 100 },
    { number: 30, multiplier: 50 },
    { number: 32, multiplier: 50 }
  ]);

  // Real-time Roulette Configuration from Admin
  const [rouletteConfig, setRouletteConfig] = useState<RouletteConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_roulette_config');
      if (cached) {
        return {
          rtpPercentage: 97.3,
          houseEdgePercentage: 2.7,
          rtpMode: 'european_standard',
          manualNextNumber: 16,
          manualNextNumberActive: false,
          minBet: 20,
          maxBet: 10000000,
          isRouletteEnabled: true,
          ...JSON.parse(cached)
        };
      }
    } catch (e) {}
    return {
      rtpPercentage: 97.3,
      houseEdgePercentage: 2.7,
      rtpMode: 'european_standard',
      manualNextNumber: 16,
      manualNextNumberActive: false,
      minBet: 20,
      maxBet: 10000000,
      isRouletteEnabled: true
    };
  });
  const rouletteConfigRef = useRef<RouletteConfig>(rouletteConfig);
  rouletteConfigRef.current = rouletteConfig;

  useEffect(() => {
    const unsubGameSettings = onSnapshot(doc(db, 'game_settings', 'roulette'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setRouletteConfig((prev) => {
          const next: RouletteConfig = {
            ...prev,
            rtpPercentage: typeof data.rtpPercentage === 'number' ? data.rtpPercentage : prev.rtpPercentage,
            houseEdgePercentage: typeof data.houseEdgePercentage === 'number' ? data.houseEdgePercentage : prev.houseEdgePercentage,
            rtpMode: data.rtpMode === 'fair_rng' ? 'european_standard' : data.rtpMode === 'house_protect' ? 'house_protection' : (data.rtpMode || prev.rtpMode),
            isRouletteEnabled: data.isEnabled !== undefined ? data.isEnabled : prev.isRouletteEnabled,
            minBet: data.minBet !== undefined ? data.minBet : prev.minBet,
            maxBet: data.maxBet !== undefined ? data.maxBet : prev.maxBet,
          };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }, (err) => console.warn('LiveRoulette game_settings sync error:', err.message));

    const unsub = onSnapshot(doc(db, 'roulette_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RouletteConfig>;
        setRouletteConfig((prev) => {
          const next = { ...prev, ...data };
          try {
            localStorage.setItem('bg_roulette_config', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
    }, (err) => console.warn('LiveRoulette config sync error:', err.message));

    return () => {
      unsubGameSettings();
      unsub();
    };
  }, []);

  const totalBetAmount = bets.reduce((sum, b) => sum + b.amount, 0);

  const betsRef = useRef<PlacedBet[]>([]);
  betsRef.current = bets;

  const userBalanceRef = useRef<number>(user.balance);
  userBalanceRef.current = user.balance;

  const activeSpeechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Complete Hindi Voice Announcement that NEVER gets prematurely cancelled
  const announceHindiVoice = (hindiText: string, onFinish?: () => void) => {
    if (isMuted) {
      if (onFinish) onFinish();
      return;
    }
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(hindiText);
        utterance.rate = 0.92;
        utterance.pitch = 1.05;
        
        const voices = window.speechSynthesis.getVoices();
        const hiVoice = voices.find(v => v.lang.includes('hi') || v.name.includes('Hindi') || v.lang.includes('en-IN'));
        if (hiVoice) {
          utterance.voice = hiVoice;
        }
        utterance.lang = 'hi-IN';

        utterance.onend = () => {
          activeSpeechUtteranceRef.current = null;
          if (onFinish) onFinish();
        };
        utterance.onerror = () => {
          activeSpeechUtteranceRef.current = null;
          if (onFinish) onFinish();
        };

        activeSpeechUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        if (onFinish) onFinish();
      }
    } catch (e) {
      console.warn('Speech synthesis error', e);
      if (onFinish) onFinish();
    }
  };

  // Synchronized Deterministic Win Number
  const getSyncedWinNumber = (roundSeed: number): number => {
    const x = Math.sin(roundSeed * 9999 + 12345) * 10000;
    const rand = Math.abs(x - Math.floor(x));
    return WHEEL_NUMBERS[Math.floor(rand * WHEEL_NUMBERS.length)];
  };

  // Synchronized Deterministic Lightning Multipliers (50x - 500x)
  const getSyncedLightningMultipliers = (roundSeed: number): LightningMultiplier[] => {
    const multipliersList = [50, 100, 200, 300, 400, 500];
    const results: LightningMultiplier[] = [];
    const chosen = new Set<number>();
    const count = 3;

    for (let i = 0; i < count; i++) {
      const pseudoRand = Math.abs(Math.sin(roundSeed * 8831 + i * 4919) * 10000);
      const frac = pseudoRand - Math.floor(pseudoRand);
      const num = Math.floor(frac * 37);
      if (!chosen.has(num)) {
        chosen.add(num);
        const multFrac = Math.abs(Math.sin(roundSeed * 1237 + i * 997) * 10000);
        const multIdx = Math.floor((multFrac - Math.floor(multFrac)) * multipliersList.length);
        results.push({ number: num, multiplier: multipliersList[multIdx] });
      }
    }
    return results.length >= 2 ? results : [
      { number: 8, multiplier: 100 },
      { number: 30, multiplier: 50 },
      { number: 32, multiplier: 50 }
    ];
  };

  const getResolvedWinNumber = (roundSeed: number): number => {
    const currentCfg = rouletteConfigRef.current;
    if (
      currentCfg.manualNextNumberActive && 
      typeof currentCfg.manualNextNumber === 'number' && 
      currentCfg.manualNextNumber >= 0 && 
      currentCfg.manualNextNumber <= 36
    ) {
      return currentCfg.manualNextNumber;
    }
    return getSyncedWinNumber(roundSeed);
  };

  // State-Driven Sequential Game Controller (Guarantees Voice Finishes Before Next Countdown)
  const startBettingPhase = () => {
    const nextRoundSeed = Date.now();
    const nextRoundId = `HLR-${Math.floor(100000 + Math.random() * 900000)}`;
    setRoundId(nextRoundId);
    setBets([]);
    setUserWonAmount(0);
    setWinningNumber(null);
    setIsResultRevealed(false);
    setBetsLocked(false);
    setGamePhase('betting');
    setCountdown(18);

    const lucky = getSyncedLightningMultipliers(nextRoundSeed);
    setLightningNumbers(lucky);

    const greeting = `Saanvi: Namaste ${user.name || 'Player'}! Apne bets lagayein, samay shuru ho chuka hai!`;
    setDealerMessage(greeting);
    announceHindiVoice(`Namaste ${user.name || ''}! Apne bets lagayein!`);
  };

  // Betting Countdown Timer
  useEffect(() => {
    if (gamePhase !== 'betting') return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
        soundFx.playCountdownTick();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown reached 0 -> Start Spin Sequence
      setBetsLocked(true);
      executeSpinSequence();
    }
  }, [countdown, gamePhase]);

  // Full Cinematic Wheel Pop-up, Lightning Strike, Ball Spin & Voice Presentation
  const executeSpinSequence = () => {
    setGamePhase('lightning');
    setDealerMessage('Saanvi: Bets band ho chuke hain! Bijli girne wali hai!');
    announceHindiVoice('Bets band ho chuke hain! Shukriya!');

    soundFx.playSpinWhoosh();
    soundFx.playClick();

    const currentPlacedBets = [...betsRef.current];
    const betTotal = currentPlacedBets.reduce((s, b) => s + b.amount, 0);

    let currentBal = userBalanceRef.current;
    if (betTotal > 0) {
      logAnalyticsEvent('game_start', { gameType: 'roulette', roundId, betTotal, betCount: currentPlacedBets.length }, user.id, user.email);
      currentBal = Math.max(0, currentBal - betTotal);
      onUpdateBalance(currentBal);
      onAddTransaction({
        id: `TX-BET-${Date.now()}`,
        userId: user.id,
        type: 'roulette_bet',
        amount: -betTotal,
        description: `Bets placed on Hindi Lightning Roulette #${roundId}`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString()
      });
      setLastBets(currentPlacedBets);
    }

    const roundSeed = Date.now();
    const targetWinNum = getResolvedWinNumber(roundSeed);

    // After 2.2s lightning cards reveal, transition to full rotating wheel spin
    setTimeout(() => {
      setGamePhase('spinning');
      setDealerMessage('Saanvi: Gend ghum rahi hai, dekhte hain kaun sa number aata hai...');

      const targetPocketIndex = WHEEL_NUMBERS.indexOf(targetWinNum);
      const pocketDeg = 360 / 37;
      const targetPocketAngleOnWheel = targetPocketIndex * pocketDeg + (pocketDeg / 2);

      const extraRotations = 5;
      const targetWheelRotation = wheelRotation + (360 * extraRotations) + (360 - (targetPocketAngleOnWheel % 360));

      const startTime = performance.now();
      const duration = 6000;
      const startWheelRot = wheelRotation;
      let bounceCount = 0;

      const animateFrame = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const currentWheelRot = startWheelRot + (targetWheelRotation - startWheelRot) * easeOut;
        setWheelRotation(currentWheelRot);

        const ballSpins = 7 * (1 - easeOut);
        const currentBallAngle = (currentWheelRot + targetPocketAngleOnWheel + (ballSpins * 360)) % 360;
        setBallAngle(currentBallAngle);

        if (progress > 0.65) {
          const dropP = (progress - 0.65) / 0.35;
          const smoothDrop = Math.pow(dropP, 2);
          const bounce = Math.abs(Math.sin(dropP * Math.PI * 3.5)) * (1 - dropP) * 12;
          setBallRadius(115 - (25 * smoothDrop) + bounce);

          const currentBounce = Math.floor(dropP * 3.5);
          if (currentBounce > bounceCount) {
            bounceCount = currentBounce;
            soundFx.playBallClick();
          }
        } else {
          setBallRadius(115);
        }

        if (progress < 1) {
          requestAnimationFrame(animateFrame);
        } else {
          // Ball Landed into Pocket
          setBallRadius(90);
          setWinningNumber(targetWinNum);
          soundFx.playCoin();

          // Settle the outcome
          setTimeout(() => {
            handleRoundSettlement(targetWinNum, currentPlacedBets, currentBal, betTotal);
          }, 800);
        }
      };

      requestAnimationFrame(animateFrame);
    }, 2200);
  };

  const handleRoundSettlement = (
    targetWinNum: number, 
    currentPlacedBets: PlacedBet[], 
    currentBal: number, 
    betTotal: number
  ) => {
    setIsResultRevealed(true);
    setGamePhase('settled');

    const color = getNumberColor(targetWinNum);
    const parity = targetWinNum === 0 ? 'zero' : (targetWinNum % 2 === 0 ? 'even' : 'odd');
    const range = targetWinNum === 0 ? 'zero' : (targetWinNum <= 18 ? '1-18' : '19-36');
    const dozen = targetWinNum === 0 ? 'zero' : (targetWinNum <= 12 ? '1st 12' : targetWinNum <= 24 ? '2nd 12' : '3rd 12');
    const column = targetWinNum === 0 ? 'zero' : (targetWinNum % 3 === 1 ? 'Col 1' : targetWinNum % 3 === 2 ? 'Col 2' : 'Col 3');

    const luckyHit = lightningNumbers.find(l => l.number === targetWinNum);
    const multiplier = luckyHit ? luckyHit.multiplier : undefined;

    // Update recent history
    setRecentHistory(prev => [{ number: targetWinNum, multiplier }, ...prev].slice(0, 14));
    const newHistItem: RoundHistoryItem = {
      id: `${Date.now()}`,
      roundId,
      number: targetWinNum,
      color,
      parity,
      range,
      dozen,
      column,
      multiplier,
      timestamp: new Date().toLocaleTimeString('en-IN')
    };
    setFullHistory(prev => [newHistItem, ...prev.slice(0, 19)]);

    // Evaluate user winnings
    let totalWin = 0;
    const isEven = targetWinNum !== 0 && targetWinNum % 2 === 0;
    const isOdd = targetWinNum !== 0 && targetWinNum % 2 !== 0;
    const straightMultiplier = luckyHit ? luckyHit.multiplier : 36;

    currentPlacedBets.forEach((bet) => {
      if (bet.type.kind === 'number' && bet.type.value === targetWinNum) {
        totalWin += bet.amount * straightMultiplier;
      } else if (bet.type.kind === 'color' && bet.type.value === color) {
        totalWin += bet.amount * 2;
      } else if (bet.type.kind === 'parity') {
        if ((bet.type.value === 'even' && isEven) || (bet.type.value === 'odd' && isOdd)) {
          totalWin += bet.amount * 2;
        }
      } else if (bet.type.kind === 'range') {
        if (
          (bet.type.value === '1-18' && targetWinNum >= 1 && targetWinNum <= 18) ||
          (bet.type.value === '19-36' && targetWinNum >= 19 && targetWinNum <= 36)
        ) {
          totalWin += bet.amount * 2;
        }
      } else if (bet.type.kind === 'dozen') {
        if (
          (bet.type.value === '1st12' && targetWinNum >= 1 && targetWinNum <= 12) ||
          (bet.type.value === '2nd12' && targetWinNum >= 13 && targetWinNum <= 24) ||
          (bet.type.value === '3rd12' && targetWinNum >= 25 && targetWinNum <= 36)
        ) {
          totalWin += bet.amount * 3;
        }
      } else if (bet.type.kind === 'column') {
        if (
          (bet.type.value === 'col1' && targetWinNum > 0 && targetWinNum % 3 === 1) ||
          (bet.type.value === 'col2' && targetWinNum > 0 && targetWinNum % 3 === 2) ||
          (bet.type.value === 'col3' && targetWinNum > 0 && targetWinNum % 3 === 0)
        ) {
          totalWin += bet.amount * 3;
        }
      }
    });

    setUserWonAmount(totalWin);

    // Save to Firestore
    try {
      setDoc(doc(db, 'roulette_rounds', roundId), {
        roundId,
        winningNumber: targetWinNum,
        color,
        parity,
        range,
        dozen,
        column,
        lightningNumbers,
        multiplier: multiplier || 36,
        settledAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    } catch (_) {}

    // Record User Bet History Entry
    if (betTotal > 0) {
      const today = new Date();
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const dateStr = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`;
      const timeStr = today.toTimeString().split(' ')[0];

      const resultAmt = totalWin > 0 ? totalWin : -betTotal;
      const newHistoryEntry: UserBetHistoryItem = {
        id: `BH-${Date.now()}`,
        timestamp: timeStr,
        dateKey: dateStr,
        gameName: 'Hindi Lightning Roulette',
        betAmount: betTotal,
        resultAmount: resultAmt,
        roundId,
        winningNumber: targetWinNum,
        multiplier
      };

      setUserBetHistory((prev) => {
        const updated = [newHistoryEntry, ...prev];
        try {
          localStorage.setItem(`bg_roulette_history_${user.id}`, JSON.stringify(updated.slice(0, 50)));
        } catch (_) {}
        return updated;
      });

      try {
        setDoc(doc(db, 'users', user.id, 'roulette_history', newHistoryEntry.id), newHistoryEntry, { merge: true }).catch(() => {});
      } catch (_) {}
    }

    // Complete Uninterrupted Spoken Hindi Announcement with User Name & Win Amount
    const colorHindi = color === 'green' ? 'Zero Green' : color === 'red' ? 'Laal Red' : 'Kaala Black';
    const parityHindi = targetWinNum === 0 ? '' : (targetWinNum % 2 === 0 ? 'Even' : 'Odd');
    const rangeHindi = targetWinNum === 0 ? '' : (targetWinNum <= 18 ? 'Low 1 se 18' : 'High 19 se 36');
    const multHindi = luckyHit ? `, aur lightning multiplier ${luckyHit.multiplier}x!` : '!';

    let speechText = '';
    const userName = user.name || 'Player';

    if (totalWin > 0) {
      soundFx.playCheer();
      soundFx.playWinFanfare();
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 } });

      onUpdateBalance(currentBal + totalWin);
      onAddTransaction({
        id: `TX-WIN-${Date.now()}`,
        userId: user.id,
        type: 'roulette_win',
        amount: totalWin,
        description: `Won ₹${totalWin} on Hindi Lightning Roulette #${roundId} (Number ${targetWinNum})`,
        status: 'completed',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString()
      });

      setDealerMessage(`Saanvi: Winning number ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}, ${range}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}! Badhai ho ${userName}, aapne ₹${totalWin} jeete hain!`);
      speechText = `Winning number hai ${targetWinNum}, ${colorHindi}, ${parityHindi}, ${rangeHindi}${multHindi} Badhai ho ${userName}! Aapne ${totalWin} rupaye jeete hain!`;
    } else {
      setDealerMessage(`Saanvi: Winning number ${targetWinNum} (${color.toUpperCase()}, ${parity.toUpperCase()}, ${range}) ${luckyHit ? `⚡${luckyHit.multiplier}x` : ''}. Agle round ke liye tayyar ho jayein!`);
      speechText = `Winning number hai ${targetWinNum}, ${colorHindi}, ${parityHindi}, ${rangeHindi}${multHindi} Agle round ke liye tayyar ho jayein!`;
    }

    // Announce the complete speech without cutting off, and ONLY restart betting after voice finishes
    announceHindiVoice(speechText, () => {
      setTimeout(() => {
        startBettingPhase();
      }, 2500);
    });

    // Fallback timer in case speech synthesis is blocked or disabled in browser
    setTimeout(() => {
      if (gamePhase === 'settled') {
        startBettingPhase();
      }
    }, 9000);
  };

  const getNumberColor = (num: number): 'green' | 'red' | 'black' => {
    if (num === 0) return 'green';
    return RED_NUMBERS.has(num) ? 'red' : 'black';
  };

  const handlePlaceBet = (type: BetType, label: string) => {
    if (gamePhase !== 'betting' || betsLocked) {
      soundFx.playClick();
      return;
    }

    if (rouletteConfig.isRouletteEnabled === false) {
      alert('The Live Roulette table is currently undergoing scheduled maintenance. Please try again shortly.');
      return;
    }

    if (totalBetAmount + selectedChip > (rouletteConfig.maxBet || 10000000)) {
      alert(`Maximum bet limit per round is ₹${(rouletteConfig.maxBet || 10000000).toLocaleString('en-IN')}.`);
      return;
    }

    if (user.balance < totalBetAmount + selectedChip) {
      soundFx.playClick();
      alert('Insufficient wallet balance! Please deposit funds to place this bet.');
      return;
    }

    soundFx.playCoin();

    const existingIndex = bets.findIndex(b => JSON.stringify(b.type) === JSON.stringify(type));
    if (existingIndex >= 0) {
      const updated = [...bets];
      updated[existingIndex].amount += selectedChip;
      setBets(updated);
    } else {
      const newBet: PlacedBet = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        label,
        amount: selectedChip
      };
      setBets([...bets, newBet]);
    }
  };

  const handleClearBets = () => {
    if (gamePhase !== 'betting' || betsLocked) return;
    soundFx.playClick();
    setBets([]);
  };

  const handleDoubleBets = () => {
    if (gamePhase !== 'betting' || betsLocked || bets.length === 0) return;
    const currentTotal = totalBetAmount;
    if (user.balance < currentTotal * 2) {
      alert('Insufficient balance to double current bets!');
      return;
    }
    soundFx.playCoin();
    setBets(bets.map(b => ({ ...b, amount: b.amount * 2 })));
  };

  const handleRepeatBets = () => {
    if (gamePhase !== 'betting' || betsLocked || lastBets.length === 0) return;
    const lastTotal = lastBets.reduce((sum, b) => sum + b.amount, 0);
    if (user.balance < lastTotal) {
      alert('Insufficient balance to repeat last bets!');
      return;
    }
    soundFx.playCoin();
    setBets([...lastBets]);
  };

  const getBetAmountForSpot = (type: BetType) => {
    const bet = bets.find(b => JSON.stringify(b.type) === JSON.stringify(type));
    return bet ? bet.amount : 0;
  };

  const getSurroundingWheelNumbers = (target: number) => {
    const idx = WHEEL_NUMBERS.indexOf(target);
    if (idx === -1) return { prev: 24, current: 16, next: 33 };
    const prevIdx = (idx - 1 + WHEEL_NUMBERS.length) % WHEEL_NUMBERS.length;
    const nextIdx = (idx + 1) % WHEEL_NUMBERS.length;
    return {
      prev: WHEEL_NUMBERS[prevIdx],
      current: target,
      next: WHEEL_NUMBERS[nextIdx]
    };
  };

  const activeSurrounding = winningNumber !== null 
    ? getSurroundingWheelNumbers(winningNumber)
    : getSurroundingWheelNumbers(16);

  // Group User Bet History by Date
  const groupedBetHistory = userBetHistory.reduce((acc, item) => {
    const group = acc.find(g => g.dateKey === item.dateKey);
    if (group) {
      group.items.push(item);
      group.totalBet += item.betAmount;
      group.totalResult += item.resultAmount;
    } else {
      acc.push({
        dateKey: item.dateKey,
        totalBet: item.betAmount,
        totalResult: item.resultAmount,
        items: [item]
      });
    }
    return acc;
  }, [] as { dateKey: string; totalBet: number; totalResult: number; items: UserBetHistoryItem[] }[]);

  return (
    <div className="fixed inset-0 z-50 bg-[#090b10] text-slate-100 flex flex-col h-[100dvh] max-h-screen overflow-hidden font-sans select-none">
      
      {/* 1. TOP COMPACT HEADER */}
      <div className="h-10 sm:h-11 bg-black/95 border-b border-amber-500/30 px-2 sm:px-3 flex items-center justify-between shrink-0 z-30 font-mono">
        
        {/* Left: Back Button */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { soundFx.playClick(); onClose(); }}
            className="flex items-center gap-1 text-slate-300 hover:text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Back</span>
          </button>
        </div>

        {/* Center: Currency & Direct Deposit Button */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[8px] text-slate-400 block leading-none">INR</span>
            <span className="text-xs sm:text-sm font-black text-amber-300">
              ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={() => { soundFx.playClick(); onOpenDeposit(); }}
            className="px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Deposit
          </button>
        </div>

        {/* Right: Sound, Game History Button & Stats */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { soundFx.playClick(); setShowGameHistory(true); }}
            className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-400 hover:bg-amber-500/40 flex items-center justify-center cursor-pointer shadow active:scale-95"
            title="Game History"
          >
            <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
          </button>

          <button
            onClick={() => setIsMuted(soundFx.toggleMute())}
            className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            title="Mute/Unmute"
          >
            {isMuted ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
          </button>

          <button
            onClick={() => { soundFx.playClick(); setShowHistoryOverlay(true); }}
            className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 text-amber-400 hover:text-amber-300 flex items-center justify-center cursor-pointer"
            title="Statistics"
          >
            <BarChart2 className="w-3 h-3" />
          </button>
        </div>

      </div>

      {/* 2. RECENT RESULTS STREAM TAPE */}
      <div className="h-7 bg-[#0c0f17] border-b border-amber-500/20 px-2 py-0.5 flex items-center justify-between gap-1 overflow-x-auto shrink-0 font-mono select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          {recentHistory.map((item, idx) => {
            const col = getNumberColor(item.number);
            const isNewest = idx === 0;
            return (
              <div
                key={`${item.number}_${idx}`}
                className={`relative shrink-0 flex items-center justify-center font-bold text-[10px] sm:text-xs transition-all ${
                  item.multiplier
                    ? 'px-1.5 py-0.2 rounded bg-gradient-to-b from-amber-500 to-amber-700 border border-amber-300 text-white shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    : isNewest
                    ? 'w-5 h-5 rounded font-black ring-1 ring-amber-400 shadow-md'
                    : 'w-5 h-5 rounded opacity-90'
                } ${
                  item.multiplier ? '' :
                  col === 'green' ? 'bg-emerald-700 text-white' :
                  col === 'red' ? 'bg-rose-700 text-white' :
                  'bg-slate-950 border border-slate-800 text-white'
                }`}
              >
                <span>{item.number}</span>
                {item.multiplier && (
                  <span className="text-[7px] ml-0.5 font-black leading-none text-yellow-200">
                    {item.multiplier}x
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { soundFx.playClick(); setShowHistoryOverlay(true); }}
          className="w-5 h-5 rounded bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center shrink-0"
        >
          <BarChart2 className="w-3 h-3" />
        </button>
      </div>

      {/* 3. MAIN LIVE STAGE AREA */}
      <div className="relative flex-1 min-h-0 bg-gradient-to-b from-[#05070c] via-[#090b12] to-[#040508] overflow-hidden flex flex-col justify-between p-1">
        
        {/* UPPER STAGE: STUDIO AMBIENCE & LOTUS PEDESTAL */}
        <div className="relative w-full h-[125px] xs:h-[140px] sm:h-[160px] md:h-[180px] shrink-0 overflow-hidden flex items-center justify-center">
          
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/25 via-slate-950 to-black pointer-events-none" />

          {/* 3 Large Hanging Gold Frames at Studio Wall */}
          <div className="absolute top-1 w-full max-w-xs px-2 flex items-center justify-center gap-1.5 sm:gap-2.5 z-10">
            {lightningNumbers.map((l) => (
              <div
                key={l.number}
                className="w-16 sm:w-20 h-16 sm:h-20 rounded-lg border border-amber-400/80 bg-gradient-to-b from-amber-950/90 via-black to-amber-950/90 p-1 flex flex-col items-center justify-between shadow-[0_0_12px_rgba(245,158,11,0.5)]"
              >
                <div className="w-full flex-1 flex items-center justify-center">
                  <span className={`text-xl sm:text-2xl font-black font-mono drop-shadow-[0_0_8px_#f59e0b] ${
                    getNumberColor(l.number) === 'red' ? 'text-rose-400' : l.number === 0 ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {l.number}
                  </span>
                </div>

                <div className="w-full py-0.2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black font-mono text-[9px] sm:text-[10px] rounded text-center tracking-tight">
                  {l.multiplier}x
                </div>
              </div>
            ))}
          </div>

          {/* Center Live Pedestal with Golden Lotus Wheel Centerpiece */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 relative flex items-center justify-center animate-lotus-glow">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_#f59e0b]">
                <g fill="#d97706" stroke="#fbbf24" strokeWidth="1">
                  <path d="M50 15 C45 35, 45 45, 50 65 C55 45, 55 35, 50 15 Z" />
                  <path d="M35 22 C35 40, 42 50, 50 65 C42 45, 25 35, 35 22 Z" />
                  <path d="M65 22 C65 40, 58 50, 50 65 C58 45, 75 35, 65 22 Z" />
                  <path d="M22 35 C28 50, 38 58, 50 65 C35 55, 15 45, 22 35 Z" />
                  <path d="M78 35 C72 50, 62 58, 50 65 C65 55, 85 45, 78 35 Z" />
                </g>
                <circle cx="50" cy="55" r="7" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
                <circle cx="50" cy="55" r="3" fill="#dc2626" />
              </svg>
            </div>
            <div className="w-28 sm:w-36 h-3.5 bg-gradient-to-r from-amber-950 via-amber-700 to-amber-950 rounded-full border border-amber-400" />
          </div>

          {/* Live Indian Dealer Saanvi Badge & Countdown */}
          <div className="absolute bottom-1 right-2 bg-black/70 backdrop-blur-md border border-amber-500/40 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300">Host Saanvi</span>
            {gamePhase === 'betting' && (
              <span className="text-[9px] font-mono font-black text-rose-400 bg-black/80 px-1 rounded">
                ⏱ {countdown}s
              </span>
            )}
          </div>

        </div>

        {/* 4. COMPACT VERTICAL BETTING TABLE */}
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-1 max-w-md mx-auto w-full">
          
          <div className="relative bg-[#0c0f16]/95 border border-amber-500/40 rounded-xl p-1 shadow-xl flex items-stretch gap-0.5">
            
            {/* Left 1: Outside Bets */}
            <div className="flex flex-col justify-between w-8 sm:w-10 gap-0.5 font-mono font-bold text-[8px] sm:text-[9px]">
              {[
                { type: { kind: 'range', value: '1-18' }, label: '1-18' },
                { type: { kind: 'parity', value: 'even' }, label: 'EVEN' },
                { type: { kind: 'color', value: 'red' }, label: '♦ RED', isRed: true },
                { type: { kind: 'color', value: 'black' }, label: '♦ BLK', isBlack: true },
                { type: { kind: 'parity', value: 'odd' }, label: 'ODD' },
                { type: { kind: 'range', value: '19-36' }, label: '19-36' }
              ].map((b, i) => {
                const betAmt = getBetAmountForSpot(b.type as BetType);
                return (
                  <button
                    key={i}
                    onClick={() => handlePlaceBet(b.type as BetType, b.label)}
                    className={`flex-1 min-h-[19px] sm:min-h-[22px] rounded border flex items-center justify-center relative cursor-pointer active:scale-95 transition-all ${
                      b.isRed ? 'bg-rose-900/70 border-rose-600 text-rose-300' :
                      b.isBlack ? 'bg-slate-950 border-slate-700 text-white' :
                      'bg-slate-900/80 border-slate-700 text-slate-300'
                    } ${betAmt > 0 ? 'ring-1 ring-amber-400' : ''}`}
                  >
                    <span className="leading-tight">{b.label}</span>
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-0.5 rounded-full">
                        ₹{betAmt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Left 2: Dozen Bets */}
            <div className="flex flex-col justify-between w-7 sm:w-9 gap-0.5 font-mono font-bold text-[8px] sm:text-[9px]">
              {[
                { key: '1st12', label: '1st 12' },
                { key: '2nd12', label: '2nd 12' },
                { key: '3rd12', label: '3rd 12' }
              ].map((d) => {
                const betAmt = getBetAmountForSpot({ kind: 'dozen', value: d.key as any });
                return (
                  <button
                    key={d.key}
                    onClick={() => handlePlaceBet({ kind: 'dozen', value: d.key as any }, d.label)}
                    className={`flex-1 min-h-[40px] sm:min-h-[46px] bg-slate-900/90 border border-amber-500/30 text-amber-300 rounded flex items-center justify-center relative cursor-pointer active:scale-95 transition-all ${
                      betAmt > 0 ? 'ring-1 ring-amber-400' : ''
                    }`}
                  >
                    <span className="rotate-[-90deg] whitespace-nowrap text-[8px]">{d.label}</span>
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-0.5 rounded-full">
                        ₹{betAmt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Center Grid: Single 0 on Top + 12 Rows of 3 Numbers + Column Bets at Bottom */}
            <div className="flex-1 flex flex-col gap-0.5">
              
              {/* ZERO (0) TOP BAR */}
              {(() => {
                const zeroLucky = lightningNumbers.find(l => l.number === 0);
                const betAmt = getBetAmountForSpot({ kind: 'number', value: 0 });
                return (
                  <div className="relative">
                    <button
                      onClick={() => handlePlaceBet({ kind: 'number', value: 0 }, '0')}
                      className={`w-full h-5 sm:h-6 rounded border font-mono font-black text-[11px] sm:text-xs flex items-center justify-center relative cursor-pointer active:scale-95 transition-all ${
                        zeroLucky
                          ? 'animate-lightning-strike bg-gradient-to-r from-amber-950 via-emerald-800 to-amber-950 border-amber-300 text-yellow-300'
                          : 'bg-emerald-800 hover:bg-emerald-700 border-emerald-500 text-white'
                      } ${betAmt > 0 ? 'ring-1 ring-amber-400' : ''}`}
                    >
                      <span>0</span>
                      {zeroLucky && (
                        <span className="absolute -top-1.5 right-2 bg-amber-400 text-slate-950 font-black text-[7px] px-1 rounded-full">
                          ⚡{zeroLucky.multiplier}x
                        </span>
                      )}
                      {betAmt > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-0.5 rounded-full">
                          ₹{betAmt}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* 12 ROWS X 3 COLUMNS VERTICAL MATRIX */}
              <div className="grid grid-cols-3 gap-0.5">
                {[
                  [1, 2, 3],
                  [4, 5, 6],
                  [7, 8, 9],
                  [10, 11, 12],
                  [13, 14, 15],
                  [16, 17, 18],
                  [19, 20, 21],
                  [22, 23, 24],
                  [25, 26, 27],
                  [28, 29, 30],
                  [31, 32, 33],
                  [34, 35, 36]
                ].map((row, rIdx) => (
                  <React.Fragment key={rIdx}>
                    {row.map((num) => {
                      const col = getNumberColor(num);
                      const betAmt = getBetAmountForSpot({ kind: 'number', value: num });
                      const luckyHit = lightningNumbers.find(l => l.number === num);
                      return (
                        <div key={num} className="relative flex items-stretch">
                          <button
                            onClick={() => handlePlaceBet({ kind: 'number', value: num }, `${num}`)}
                            className={`w-full h-4.5 sm:h-5.5 rounded border font-mono font-bold text-[10px] sm:text-xs flex items-center justify-center relative cursor-pointer active:scale-95 transition-all ${
                              luckyHit
                                ? 'animate-lightning-strike bg-gradient-to-b from-amber-950 via-slate-900 to-amber-950 border-amber-400 text-yellow-300'
                                : col === 'red'
                                ? 'bg-rose-700 hover:bg-rose-600 border-rose-500/60 text-white'
                                : 'bg-slate-950 hover:bg-slate-900 border-slate-700 text-white'
                            } ${betAmt > 0 ? 'ring-1 ring-amber-400' : ''}`}
                          >
                            <span>{num}</span>
                            {luckyHit && (
                              <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[6px] sm:text-[7px] px-0.5 rounded-full whitespace-nowrap z-40">
                                ⚡{luckyHit.multiplier}x
                              </span>
                            )}
                            {betAmt > 0 && (
                              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-0.5 rounded-full">
                                ₹{betAmt}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* COLUMN BETS AT BOTTOM */}
              <div className="grid grid-cols-3 gap-0.5">
                {['col1', 'col2', 'col3'].map((cKey) => {
                  const betAmt = getBetAmountForSpot({ kind: 'column', value: cKey as any });
                  return (
                    <button
                      key={cKey}
                      onClick={() => handlePlaceBet({ kind: 'column', value: cKey as any }, '2:1 Col')}
                      className={`h-5 bg-slate-900 border border-amber-500/40 text-amber-300 font-mono font-bold text-[9px] rounded flex items-center justify-center relative cursor-pointer active:scale-95 ${
                        betAmt > 0 ? 'ring-1 ring-amber-400' : ''
                      }`}
                    >
                      <span>2:1</span>
                      {betAmt > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[7px] font-black px-0.5 rounded-full">
                          ₹{betAmt}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Right Side Floating Controls */}
            <div className="flex flex-col justify-around w-8 sm:w-9 gap-0.5 font-mono text-[8px]">
              <button
                onClick={handleClearBets}
                disabled={gamePhase !== 'betting' || betsLocked || bets.length === 0}
                className="flex-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex flex-col items-center justify-center p-0.5 active:scale-90 disabled:opacity-40 cursor-pointer"
                title="Undo / Clear"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="text-[7px] mt-0.2">UNDO</span>
              </button>

              <button
                onClick={handleDoubleBets}
                disabled={gamePhase !== 'betting' || betsLocked || bets.length === 0}
                className="flex-1 rounded bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-400 flex flex-col items-center justify-center p-0.5 active:scale-90 disabled:opacity-40 cursor-pointer"
                title="2X Double Bets"
              >
                <span className="font-black text-[10px]">x2</span>
                <span className="text-[7px]">DOUBLE</span>
              </button>

              <button
                onClick={handleRepeatBets}
                disabled={gamePhase !== 'betting' || betsLocked || lastBets.length === 0}
                className="flex-1 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-400 flex flex-col items-center justify-center p-0.5 active:scale-90 disabled:opacity-40 cursor-pointer"
                title="Repeat Last Bet"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="text-[7px] mt-0.2">REPEAT</span>
              </button>
            </div>

          </div>

          {/* 5. DEALER TICKER + GAME LIMITS BAR */}
          <div className="flex flex-col gap-0.5 font-mono text-[10px] shrink-0">
            <div className="px-2 py-0.5 bg-black/85 border border-amber-500/30 rounded-lg text-amber-300 text-[10px] truncate flex items-center justify-between">
              <span className="truncate">{dealerMessage}</span>
              <span className="text-slate-400 text-[8px] shrink-0 ml-1">● LIVE</span>
            </div>

            <div className="flex items-center justify-between px-1 text-[9px] text-slate-300">
              <div>
                <span>Total Bet </span>
                <strong className="text-amber-400">₹{totalBetAmount}</strong>
              </div>
              <div className="text-slate-400 text-[8px]">
                Hindi Lightning Roulette ₹20 - 10,000,000
              </div>
            </div>
          </div>

          {/* 6. CHIPS BAR AT BOTTOM */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 pb-0.5 shrink-0">
            {CHIP_VALUES.map((val) => {
              const isSelected = selectedChip === val;
              const chipColor = 
                val === 10 ? 'bg-gradient-to-tr from-amber-600 to-orange-500 border-amber-300 text-white' :
                val === 50 ? 'bg-gradient-to-tr from-sky-600 to-blue-600 border-sky-300 text-white' :
                val === 100 ? 'bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 border-yellow-200 text-slate-950 font-black' :
                val === 500 ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 border-purple-300 text-white' :
                val === 1000 ? 'bg-gradient-to-tr from-rose-600 to-red-600 border-rose-300 text-white' :
                'bg-gradient-to-tr from-emerald-600 to-teal-600 border-emerald-300 text-white';

              return (
                <button
                  key={val}
                  onClick={() => { soundFx.playClick(); setSelectedChip(val); }}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-mono font-black text-[9px] sm:text-[10px] flex items-center justify-center border shadow-md transition-all active:scale-90 cursor-pointer ${chipColor} ${
                    isSelected ? 'ring-2 ring-amber-400 scale-110 z-10 shadow-[0_0_8px_#f59e0b]' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <span>₹{val >= 1000 ? `${val / 1000}k` : val}</span>
                </button>
              );
            })}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 7. CINEMATIC FULL-SCREEN POP-UP ROULETTE WHEEL ON COUNTDOWN END (NEW REQUIREMENT) */}
      {/* ========================================================================= */}
      {(gamePhase === 'lightning' || gamePhase === 'spinning' || gamePhase === 'settled') && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 animate-in fade-in duration-300 font-mono">
          
          {/* Top Status Header in Pop-up */}
          <div className="w-full max-w-lg flex items-center justify-between bg-black/60 border border-amber-500/30 px-3 py-1.5 rounded-xl z-20">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-black text-amber-300">HINDI LIGHTNING LIVE</span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">{roundId}</span>
          </div>

          {/* Center Stage: Rotating 3D Wheel & Lightning Cards */}
          <div className="relative w-full max-w-md flex-1 flex flex-col items-center justify-center my-2">
            
            {/* Hanging Lucky Lightning Multiplier Cards */}
            <div className="flex items-center justify-center gap-2 mb-3 z-20">
              {lightningNumbers.map((l) => (
                <div
                  key={l.number}
                  className="w-18 sm:w-22 h-18 sm:h-22 rounded-xl border-2 border-amber-400 bg-gradient-to-b from-amber-950 via-slate-950 to-amber-950 p-1 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.7)] animate-gold-card"
                >
                  <div className="w-full flex-1 flex items-center justify-center">
                    <span className={`text-2xl sm:text-3xl font-black ${
                      getNumberColor(l.number) === 'red' ? 'text-rose-400' : l.number === 0 ? 'text-emerald-400' : 'text-white'
                    }`}>
                      {l.number}
                    </span>
                  </div>
                  <div className="w-full py-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] sm:text-xs rounded text-center">
                    {l.multiplier}x
                  </div>
                </div>
              ))}
            </div>

            {/* Big Realistic 3D Rotating Roulette Wheel */}
            <div className="relative w-56 h-56 xs:w-64 xs:h-64 sm:w-76 sm:h-76 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-950 via-yellow-900 to-amber-950 border-4 border-amber-500/60 shadow-[0_0_40px_rgba(245,158,11,0.5)] p-2">
                <div className="w-full h-full rounded-full bg-slate-900 border-2 border-yellow-500/60 relative overflow-hidden flex items-center justify-center">
                  
                  {/* Rotating Wheel Graphic */}
                  <div
                    className="w-full h-full rounded-full relative transition-transform duration-75 ease-out"
                    style={{ transform: `rotate(${wheelRotation}deg)` }}
                  >
                    <svg className="w-full h-full" viewBox="0 0 300 300">
                      <circle cx="150" cy="150" r="145" fill="#0f172a" stroke="#d97706" strokeWidth="2" />
                      
                      {WHEEL_NUMBERS.map((num, i) => {
                        const angle = (i * 360) / 37;
                        const nextAngle = ((i + 1) * 360) / 37;
                        const rad1 = (angle * Math.PI) / 180;
                        const rad2 = (nextAngle * Math.PI) / 180;
                        
                        const x1 = 150 + 140 * Math.sin(rad1);
                        const y1 = 150 - 140 * Math.cos(rad1);
                        const x2 = 150 + 140 * Math.sin(rad2);
                        const y2 = 150 - 140 * Math.cos(rad2);

                        const col = getNumberColor(num);
                        const fill = col === 'green' ? '#059669' : col === 'red' ? '#dc2626' : '#1e293b';

                        const midRad = ((angle + (360 / 37) / 2) * Math.PI) / 180;
                        const tx = 150 + 115 * Math.sin(midRad);
                        const ty = 150 - 115 * Math.cos(midRad);

                        return (
                          <g key={num}>
                            <path
                              d={`M 150 150 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`}
                              fill={fill}
                              stroke="#fbbf24"
                              strokeWidth="0.5"
                            />
                            <text
                              x={tx}
                              y={ty}
                              fill="#ffffff"
                              fontSize="9"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                              dominantBaseline="central"
                              transform={`rotate(${angle + 360 / 74}, ${tx}, ${ty})`}
                            >
                              {num}
                            </text>
                          </g>
                        );
                      })}

                      {/* Center Golden Lotus Turret */}
                      <circle cx="150" cy="150" r="45" fill="url(#brassGoldPop)" stroke="#fbbf24" strokeWidth="2" />
                      <circle cx="150" cy="150" r="18" fill="#b45309" stroke="#fef08a" strokeWidth="1.5" />
                      <circle cx="150" cy="150" r="6" fill="#dc2626" />

                      <defs>
                        <radialGradient id="brassGoldPop" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#fef08a" />
                          <stop offset="60%" stopColor="#d97706" />
                          <stop offset="100%" stopColor="#78350f" />
                        </radialGradient>
                      </defs>
                    </svg>
                  </div>

                  {/* Animated Marble Ball */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 300 300">
                    <circle
                      cx={150 + ballRadius * Math.sin((ballAngle * Math.PI) / 180)}
                      cy={150 - ballRadius * Math.cos((ballAngle * Math.PI) / 180)}
                      r="6"
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      filter="drop-shadow(0 2px 5px rgba(0,0,0,0.9))"
                    />
                  </svg>

                </div>
              </div>

              {/* OVERLAY: WINNING POCKET ZOOM & CELEBRATION BOX */}
              {isResultRevealed && winningNumber !== null && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-winner-zoom rounded-full">
                  <div className="flex items-center gap-2 bg-black/90 p-2 rounded-2xl border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,1)]">
                    <div className="w-10 h-12 flex items-center justify-center text-base font-bold text-slate-400 opacity-60">
                      {activeSurrounding.prev}
                    </div>

                    <div className={`w-14 h-16 rounded-xl flex flex-col items-center justify-center text-3xl font-black text-white border-2 border-white shadow-2xl ${
                      getNumberColor(activeSurrounding.current) === 'green' ? 'bg-emerald-600' :
                      getNumberColor(activeSurrounding.current) === 'red' ? 'bg-rose-600' : 'bg-slate-950'
                    }`}>
                      <span>{activeSurrounding.current}</span>
                    </div>

                    <div className="w-10 h-12 flex items-center justify-center text-base font-bold text-slate-400 opacity-60">
                      {activeSurrounding.next}
                    </div>
                  </div>

                  {/* Winning Details Badge (Color / Odd / Even / Multiplier) */}
                  <div className="mt-2 text-center">
                    <span className="text-xs font-black text-amber-300 uppercase tracking-widest block drop-shadow">
                      {getNumberColor(winningNumber).toUpperCase()} • {winningNumber === 0 ? 'ZERO' : winningNumber % 2 === 0 ? 'EVEN' : 'ODD'}
                    </span>
                    {lightningNumbers.find(l => l.number === winningNumber) && (
                      <span className="text-sm font-black text-yellow-300 animate-pulse block">
                        ⚡ {lightningNumbers.find(l => l.number === winningNumber)?.multiplier}x MULTIPLIER!
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Victory banner if User Won */}
            {isResultRevealed && userWonAmount > 0 && (
              <div className="mt-3 px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-center shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-bounce z-40">
                <span className="text-xs uppercase block tracking-wider font-bold">🎉 WINNER {user.name || 'YOU'}! 🎉</span>
                <span className="text-lg sm:text-xl">YOU WON ₹{userWonAmount.toLocaleString('en-IN')}</span>
              </div>
            )}

          </div>

          {/* Bottom Live Subtitle Ticker in Pop-up */}
          <div className="w-full max-w-lg bg-black/85 border border-amber-500/40 rounded-xl p-2.5 text-center text-amber-300 text-xs shadow-lg z-20">
            <p className="font-bold leading-relaxed">{dealerMessage}</p>
          </div>

        </div>
      )}

      {/* 8. USER GAME HISTORY BOTTOM DRAWER / MODAL */}
      {showGameHistory && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#121620] border-t border-amber-500/40 rounded-t-3xl w-full max-w-xl mx-auto h-[80vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-2 mb-1 shrink-0" />

            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-black/40">
              <button
                onClick={() => setShowGameHistory(false)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <h3 className="font-black text-white text-base">Game History</h3>
              </div>

              <button
                onClick={() => setShowGameHistory(false)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-2 border-b border-slate-800/80 bg-black/20 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="w-1/2"></div>
              <div className="w-1/4 text-right">BET</div>
              <div className="w-1/4 text-right">RESULT</div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-4">
              {groupedBetHistory.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1 pt-1">
                  
                  <div className="px-3 py-1.5 bg-slate-900/60 rounded-lg flex items-center justify-between text-xs font-black text-slate-300">
                    <span className="text-[11px] text-slate-400">{group.dateKey}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-white">₹{group.totalBet}</span>
                      <span className={group.totalResult >= 0 ? 'text-emerald-400' : 'text-slate-300'}>
                        {group.totalResult >= 0 ? `₹${group.totalResult}` : `-₹${Math.abs(group.totalResult)}`}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/30">
                    {group.items.map((item) => {
                      const isWin = item.resultAmount > 0;
                      return (
                        <div key={item.id} className="px-3 py-2 flex items-center justify-between hover:bg-slate-800/20 text-xs">
                          <div className="flex items-center gap-3 w-1/2 truncate">
                            <span className="text-slate-400 text-[11px]">{item.timestamp}</span>
                            <span className="text-white font-medium truncate text-[11px] sm:text-xs">{item.gameName}</span>
                          </div>

                          <div className="w-1/4 text-right font-bold text-slate-300 text-xs">
                            ₹{item.betAmount}
                          </div>

                          <div className={`w-1/4 text-right font-black text-xs ${
                            isWin ? 'text-emerald-400' : 'text-slate-300'
                          }`}>
                            {isWin ? `₹${item.resultAmount}` : `-₹${Math.abs(item.resultAmount)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* 9. ROUND STATS MODAL */}
      {showHistoryOverlay && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">HINDI LIGHTNING ROULETTE STATS</h3>
              </div>
              <button
                onClick={() => setShowHistoryOverlay(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950/40 border-b border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-rose-950/40 border border-rose-500/30 p-2 rounded-xl">
                <span className="text-rose-400 font-bold block text-[10px]">RED</span>
                <span className="text-lg font-black text-white">48%</span>
              </div>
              <div className="bg-slate-950 border border-slate-700 p-2 rounded-xl">
                <span className="text-slate-400 font-bold block text-[10px]">BLACK</span>
                <span className="text-lg font-black text-white">49%</span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xl">
                <span className="text-emerald-400 font-bold block text-[10px]">ZERO</span>
                <span className="text-lg font-black text-white">3%</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                    <th className="pb-2">ROUND</th>
                    <th className="pb-2">NUMBER</th>
                    <th className="pb-2">COLOR</th>
                    <th className="pb-2">MULTIPLIER</th>
                    <th className="pb-2 text-right">TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-slate-800/60 text-slate-200">
                  {fullHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 text-slate-400">{h.roundId}</td>
                      <td className="py-2 font-bold">{h.number}</td>
                      <td className="py-2 uppercase text-[10px]">{h.color}</td>
                      <td className="py-2 text-amber-400 font-bold">{h.multiplier ? `${h.multiplier}x ⚡` : '36x'}</td>
                      <td className="py-2 text-right text-slate-400 text-[10px]">{h.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
