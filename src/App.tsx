/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Wallet, Dices, Plus, ArrowUpRight, ShieldCheck, ShieldAlert, Flame, Star, CheckCircle2, Disc, Play } from 'lucide-react';
import { User, LotteryDraw, LotteryDrawResult, DepositRequest, WithdrawalRequest, PurchasedTicket, WalletTransaction, NotificationItem, PaymentMethodType, UserSettings, BannerSlide } from './types';
import { loadState, saveState } from './utils/storage';
import { INITIAL_DRAWS, INITIAL_DRAW_RESULTS } from './data/mockData';
import { soundFx } from './utils/audio';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { LotteryCard } from './components/LotteryCard';
import { DepositModal } from './components/DepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { TicketBuyModal } from './components/TicketBuyModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { LuckyWheelModal } from './components/LuckyWheelModal';
import { LiveWinnersTicker } from './components/LiveWinnersTicker';
import { MyTicketsView } from './components/MyTicketsView';
import { ResultsView } from './components/ResultsView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { LiveRoulette } from './components/LiveRoulette';
import { AndarBaharGame } from './components/AndarBaharGame';
import { DragonTigerGame } from './components/DragonTigerGame';
import { LotterySection } from './components/LotterySection';
import { WithdrawalSection } from './components/WithdrawalSection';
import { SuperCarDrawSection } from './components/SuperCarDrawSection';
import { CompactUserDashboardCard } from './components/CompactUserDashboardCard';
import { PromotionalSlider } from './components/PromotionalSlider';
import { SuperCarWinToast, SuperCarWinToastData } from './components/SuperCarWinToast';
import { SuperCarConfig, SuperCarDrawIssue, SuperCarColor, BonusBalanceRules } from './types';
import { DEFAULT_SUPERCAR_CONFIG, getSuperCarInfo, getCurrentSuperCarSchedule, getSlotFromTicket, getWinningCarForSlot, sortChronologicalNewestFirst } from './utils/supercar';
import dragonTigerBannerImg from './assets/images/banner_dragon_tiger_1786806363496.jpg';
import andarBaharBannerImg from './assets/images/banner_andar_bahar_1786806380441.jpg';
import rouletteBannerImg from './assets/images/banner_roulette_1786806396481.jpg';
import { auth, db, testConnection } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { logAnalyticsEvent } from './utils/analytics';
import confetti from 'canvas-confetti';
import { 
  notifyDepositSubmitted, 
  notifyDepositApproved, 
  notifyDepositRejected, 
  notifyWithdrawalSubmitted, 
  notifyWithdrawalApproved, 
  notifyWithdrawalRejected,
  notifyBonusCredited
} from './utils/emailNotifier';

export default function App() {
  const [initialState] = useState(() => loadState());

  const [user, setUser] = useState<User>(initialState.user);
  const [draws, setDraws] = useState<LotteryDraw[]>(initialState.draws);
  const [lotteryResults, setLotteryResults] = useState<LotteryDrawResult[]>(INITIAL_DRAW_RESULTS);
  const [deposits, setDeposits] = useState<DepositRequest[]>(initialState.deposits);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(initialState.withdrawals);
  const [tickets, setTickets] = useState<PurchasedTicket[]>(initialState.tickets);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(initialState.transactions);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialState.notifications);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([]);
  const [bonusRules, setBonusRules] = useState<BonusBalanceRules>({
    allowSuperCar: true,
    allowRegularLottery: false,
    allowLiveRoulette: false,
    allowLuckyWheel: false,
    defaultBonusAmount: 100,
    isBonusSystemActive: true,
    bonusNotice: 'বোনাস ব্যালেন্স দিয়ে শুধুমাত্র থ্রী সুপার কার টিকিট কেনা যাবে।'
  });

  // Navigation & Modals UI state
  const [activeTab, setActiveTab] = useState<NavTab | 'settings'>('home');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isLuckyWheelOpen, setIsLuckyWheelOpen] = useState<boolean>(false);
  const [isLiveRouletteOpen, setIsLiveRouletteOpen] = useState<boolean>(false);
  const [isAndarBaharOpen, setIsAndarBaharOpen] = useState<boolean>(false);
  const [isDragonTigerOpen, setIsDragonTigerOpen] = useState<boolean>(false);
  const [buyTicketDraw, setBuyTicketDraw] = useState<LotteryDraw | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // SuperCar States
  const [supercarConfig, setSupercarConfig] = useState<SuperCarConfig>(DEFAULT_SUPERCAR_CONFIG);
  const [supercarCurrentIssue, setSupercarCurrentIssue] = useState<SuperCarDrawIssue | null>(null);
  const [supercarPastDraws, setSupercarPastDraws] = useState<SuperCarDrawIssue[]>(() => {
    try {
      const cached = localStorage.getItem('betguru_supercar_draws');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [superCarWinToast, setSuperCarWinToast] = useState<SuperCarWinToastData | null>(null);
  const notifiedWinTicketIdsRef = React.useRef<Set<string>>(new Set());

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userHasAdminClaim, setUserHasAdminClaim] = useState<boolean>(false);

  // Firestore Persistence Helpers
  const persistUserBalance = async (userId: string, newBalance: number, newBonusBalance?: number, userEmail?: string) => {
    try {
      const updateData: any = { balance: newBalance };
      if (typeof newBonusBalance === 'number') {
        updateData.bonusBalance = newBonusBalance;
      }

      // 1. Primary Doc Update
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, updateData, { merge: true });

      // 2. Email & Alias Multi-Doc Sync
      const emailToUse = (userEmail || user?.email || '').toLowerCase().trim();
      if (emailToUse) {
        const aliasId = `user_${emailToUse.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (aliasId !== userId) {
          await setDoc(doc(db, 'users', aliasId), updateData, { merge: true }).catch(() => {});
        }

        // Query all user documents matching this email to ensure 100% real-time balance parity
        try {
          const qByEmail = query(collection(db, 'users'), where('email', '==', emailToUse));
          const emailSnap = await getDocs(qByEmail);
          emailSnap.forEach((dSnap) => {
            if (dSnap.id !== userId && dSnap.id !== aliasId) {
              setDoc(doc(db, 'users', dSnap.id), updateData, { merge: true }).catch(() => {});
            }
          });
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error persisting balance to Firestore:', err);
    }
  };

  const persistTransaction = async (tx: WalletTransaction) => {
    try {
      const txRef = doc(db, 'transactions', tx.id);
      const sanitizedTx = {
        ...tx,
        createdAt: tx.createdAt || new Date().toISOString()
      };
      await setDoc(txRef, sanitizedTx, { merge: true });
    } catch (err) {
      console.error('Error persisting transaction to Firestore:', err);
    }
  };

  const persistDeposit = async (dep: DepositRequest) => {
    try {
      const depRef = doc(db, 'deposits', dep.id);
      // Ensure screenshotUrl base64 doesn't exceed Firestore document size limit (1MB)
      let sanitizedDep = { 
        ...dep,
        createdAt: dep.createdAt || new Date().toISOString()
      };
      if (sanitizedDep.screenshotUrl && sanitizedDep.screenshotUrl.length > 300000) {
        sanitizedDep.screenshotUrl = 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&q=80';
      }
      await setDoc(depRef, sanitizedDep, { merge: true });
    } catch (err) {
      console.error('Error persisting deposit to Firestore:', err);
    }
  };

  const persistWithdrawal = async (wth: WithdrawalRequest) => {
    try {
      const wthRef = doc(db, 'withdrawals', wth.id);
      const sanitizedWth = {
        ...wth,
        createdAt: wth.createdAt || new Date().toISOString()
      };
      await setDoc(wthRef, sanitizedWth, { merge: true });
    } catch (err) {
      console.error('Error persisting withdrawal to Firestore:', err);
    }
  };

  const persistTicket = async (ticket: PurchasedTicket) => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      const sanitizedTicket = {
        ...ticket,
        createdAt: ticket.createdAt || new Date().toISOString()
      };
      await setDoc(ticketRef, sanitizedTicket, { merge: true });
    } catch (err) {
      console.error('Error persisting ticket to Firestore:', err);
    }
  };

  const persistNotification = async (ntf: NotificationItem) => {
    try {
      const ntfRef = doc(db, 'notifications', ntf.id);
      const sanitizedNtf = {
        ...ntf,
        createdAt: ntf.createdAt || new Date().toISOString()
      };
      await setDoc(ntfRef, sanitizedNtf, { merge: true });
    } catch (err) {
      console.error('Error persisting notification to Firestore:', err);
    }
  };

  // Helper to reset user history states to prevent cross-user cached data leakage
  const resetUserDataState = () => {
    setTransactions([]);
    setDeposits([]);
    setWithdrawals([]);
    setTickets([]);
    setNotifications([]);
  };

  // Initialize Firebase connection test & auth listener
  useEffect(() => {
    testConnection();

    let unsubUser: (() => void) | null = null;
    let unsubTx: (() => void) | null = null;
    let unsubDeposits: (() => void) | null = null;
    let unsubWithdrawals: (() => void) | null = null;
    let unsubTickets: (() => void) | null = null;
    let unsubRoulette: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubUser) { try { unsubUser(); } catch (_) {} unsubUser = null; }
      if (unsubTx) { try { unsubTx(); } catch (_) {} unsubTx = null; }
      if (unsubDeposits) { try { unsubDeposits(); } catch (_) {} unsubDeposits = null; }
      if (unsubWithdrawals) { try { unsubWithdrawals(); } catch (_) {} unsubWithdrawals = null; }
      if (unsubTickets) { try { unsubTickets(); } catch (_) {} unsubTickets = null; }
      if (unsubRoulette) { try { unsubRoulette(); } catch (_) {} unsubRoulette = null; }
      if (unsubNotifications) { try { unsubNotifications(); } catch (_) {} unsubNotifications = null; }
    };

    const attachRealtimeUserListeners = (activeUid: string, claimsAdmin: boolean, userEmail?: string) => {
      cleanupListeners();

      // 1. Real-time user profile & balance listener directly on the active user doc
      const userRef = doc(db, 'users', activeUid);

      unsubUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data() as User;
          setUser((prev) => ({
            ...prev,
            ...uData,
            balance: typeof uData.balance === 'number' ? uData.balance : (prev?.balance ?? 100),
            bonusBalance: typeof uData.bonusBalance === 'number' ? uData.bonusBalance : (prev?.bonusBalance ?? 100)
          }));
        }
      }, (err) => console.warn('Real-time user snapshot notice:', err.message));

      // 2. Real-time Transactions query
      const qTx = query(collection(db, 'transactions'), limit(500));
      unsubTx = onSnapshot(qTx, (txSnap) => {
        if (!txSnap.empty) {
          const allTxs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WalletTransaction));
          if (claimsAdmin) {
            setTransactions(allTxs);
          } else {
            const cleanEmail = (userEmail || '').toLowerCase().trim();
            const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const userFiltered = allTxs.filter((t) =>
              t.userId === activeUid ||
              (cleanEmail && (t.userId === fallbackUid || t.userId === cleanEmail || (t as any).userEmail === cleanEmail))
            );
            setTransactions(userFiltered);
          }
        } else {
          setTransactions([]);
        }
      }, (err) => {
        console.warn('Real-time transactions snapshot notice:', err.message);
      });

      // 3. Real-time Deposit Requests query
      const qDeposits = query(collection(db, 'deposits'), limit(500));
      unsubDeposits = onSnapshot(qDeposits, (snap) => {
        if (!snap.empty) {
          const allDeps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest));
          if (claimsAdmin) {
            setDeposits(allDeps);
          } else {
            const cleanEmail = (userEmail || '').toLowerCase().trim();
            const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const userFiltered = allDeps.filter((d) =>
              d.userId === activeUid ||
              (cleanEmail && (d.userId === fallbackUid || d.userId === cleanEmail || (d as any).userEmail === cleanEmail))
            );
            setDeposits(userFiltered);
          }
        } else {
          setDeposits([]);
        }
      }, (err) => {
        console.warn('Real-time deposits snapshot notice:', err.message);
      });

      // 4. Real-time Withdrawal Requests query
      const qWithdrawals = query(collection(db, 'withdrawals'), limit(500));
      unsubWithdrawals = onSnapshot(qWithdrawals, (snap) => {
        if (!snap.empty) {
          const allWths = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest));
          if (claimsAdmin) {
            setWithdrawals(allWths);
          } else {
            const cleanEmail = (userEmail || '').toLowerCase().trim();
            const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const userFiltered = allWths.filter((w) =>
              w.userId === activeUid ||
              (cleanEmail && (w.userId === fallbackUid || w.userId === cleanEmail || (w as any).userEmail === cleanEmail))
            );
            setWithdrawals(userFiltered);
          }
        } else {
          setWithdrawals([]);
        }
      }, (err) => {
        console.warn('Real-time withdrawals snapshot notice:', err.message);
      });

      // 5. Real-time Lottery Tickets query
      const qTickets = query(collection(db, 'tickets'), limit(500));
      unsubTickets = onSnapshot(qTickets, (ticketSnap) => {
        if (!ticketSnap.empty) {
          const allTickets = ticketSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchasedTicket));
          if (claimsAdmin) {
            setTickets(allTickets);
          } else {
            const cleanEmail = (userEmail || '').toLowerCase().trim();
            const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const userFiltered = allTickets.filter((t) =>
              t.userId === activeUid ||
              (cleanEmail && (t.userId === fallbackUid || t.userId === cleanEmail || (t as any).userEmail === cleanEmail))
            );
            setTickets(userFiltered);
          }
        } else {
          setTickets([]);
        }
      }, (err) => {
        console.warn('Real-time tickets snapshot notice:', err.message);
      });

      // 6. Real-time Notifications query
      const qNotifications = query(collection(db, 'notifications'), limit(100));
      unsubNotifications = onSnapshot(qNotifications, (ntfSnap) => {
        if (!ntfSnap.empty) {
          const allNtfs = ntfSnap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem));
          if (claimsAdmin) {
            setNotifications(allNtfs);
          } else {
            const cleanEmail = (userEmail || '').toLowerCase().trim();
            const userFiltered = allNtfs.filter((n) => n.userId === activeUid || (cleanEmail && (n as any).userEmail === cleanEmail));
            setNotifications(userFiltered);
          }
        } else {
          setNotifications([]);
        }
      }, (err) => {
        console.warn('Real-time notifications snapshot notice:', err.message);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      cleanupListeners();

      if (fbUser) {
        setCurrentUser(fbUser);
        resetUserDataState();

        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const isAdminEmail = fbUser.email?.toLowerCase() === 'subhasishpramanik835@gmail.com' || fbUser.email?.toLowerCase() === 'asishp92@gmail.com';
          
          let claimsAdmin = false;
          try {
            const tokenResult = await fbUser.getIdTokenResult();
            const claims = tokenResult.claims;
            const roleClaim = claims.role || (claims.admin ? 'admin' : claims.super_admin ? 'super_admin' : undefined);
            claimsAdmin = roleClaim === 'admin' || roleClaim === 'super_admin' || claims.admin === true || claims.super_admin === true || isAdminEmail;
          } catch (tokenErr) {
            console.warn('Error reading ID token custom claims:', tokenErr);
            claimsAdmin = isAdminEmail;
          }
          setUserHasAdminClaim(claimsAdmin);

          let userSnap: any = null;
          try {
            userSnap = await getDoc(userRef);
          } catch (offlineErr) {
            console.warn('Firestore user fetch offline or network delay:', offlineErr);
          }

          if (userSnap && userSnap.exists()) {
            const data = userSnap.data() as User;
            const effectiveRole = claimsAdmin ? 'admin' : (data.role === 'admin' ? 'admin' : (isAdminEmail ? 'admin' : (data.role || 'user')));
            const effectiveBalance = (isAdminEmail && (typeof data.balance !== 'number' || data.balance < 6435)) 
              ? 6435.00 
              : (typeof data.balance === 'number' ? data.balance : 6435.00);
            
            const updatedUser: User = {
              ...data,
              id: fbUser.uid,
              name: data.name || fbUser.displayName || (isAdminEmail ? 'Subhasish Pramanik' : 'BETGURU Player'),
              email: fbUser.email || data.email || '',
              avatarUrl: fbUser.photoURL || data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              role: effectiveRole,
              bonusBalance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 100,
              balance: effectiveBalance
            };
            setUser(updatedUser);
            if (effectiveRole === 'admin') {
              setUserHasAdminClaim(true);
            }

            if (data.settings) {
              soundFx.setBgMusicEnabled(data.settings.bgMusicEnabled ?? true);
              soundFx.setSoundEffectsEnabled(data.settings.soundEffectsEnabled ?? true);
              soundFx.setHapticEnabled(data.settings.hapticEnabled ?? true);
            }

            setDoc(userRef, {
              name: updatedUser.name,
              email: updatedUser.email,
              avatarUrl: updatedUser.avatarUrl,
              role: updatedUser.role,
              balance: updatedUser.balance,
              lastLogin: new Date().toISOString()
            }, { merge: true }).catch((err) => console.warn('Deferred user update notice:', err));

            attachRealtimeUserListeners(fbUser.uid, claimsAdmin || effectiveRole === 'admin', updatedUser.email);
          } else {
            // Check if user had a previous doc by email
            let existingDocByEmail: any = null;
            if (fbUser.email) {
              const cleanEmail = fbUser.email.toLowerCase().trim();
              const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
              try {
                const snapFallback = await getDoc(doc(db, 'users', fallbackUid));
                if (snapFallback.exists()) {
                  existingDocByEmail = snapFallback.data();
                }
              } catch (_) {}
            }

            const existingData = existingDocByEmail || {};
            const effectiveRole = claimsAdmin ? 'admin' : (existingData.role === 'admin' ? 'admin' : (isAdminEmail ? 'admin' : (existingData.role || 'user')));
            const effectiveBalance = (isAdminEmail && (typeof existingData.balance !== 'number' || existingData.balance < 6435))
              ? 6435.00
              : (typeof existingData.balance === 'number' ? existingData.balance : 6435.00);

            const newUserDoc: User = {
              id: fbUser.uid,
              name: existingData.name || fbUser.displayName || (isAdminEmail ? 'Subhasish Pramanik' : (fbUser.email?.split('@')[0] || 'BETGURU Player')),
              phone: existingData.phone || fbUser.phoneNumber || '+91 9876543210',
              email: fbUser.email || existingData.email || '',
              avatarUrl: fbUser.photoURL || existingData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              balance: effectiveBalance,
              bonusBalance: typeof existingData.bonusBalance === 'number' ? existingData.bonusBalance : 100,
              totalWon: typeof existingData.totalWon === 'number' ? existingData.totalWon : 18500,
              totalSpent: typeof existingData.totalSpent === 'number' ? existingData.totalSpent : 8200,
              referralCode: existingData.referralCode || `BG${Math.floor(100000 + Math.random() * 900000)}`,
              totalReferrals: typeof existingData.totalReferrals === 'number' ? existingData.totalReferrals : 0,
              lastSpinTime: typeof existingData.lastSpinTime === 'number' ? existingData.lastSpinTime : 0,
              status: existingData.status || 'active',
              role: effectiveRole,
              vipLevel: existingData.vipLevel || 'Gold',
              vipPoints: typeof existingData.vipPoints === 'number' ? existingData.vipPoints : 120,
              regDate: existingData.regDate || new Date().toLocaleDateString('en-IN')
            };
            setUser(newUserDoc);
            if (effectiveRole === 'admin') {
              setUserHasAdminClaim(true);
            }
            setDoc(userRef, newUserDoc, { merge: true }).catch((err) => console.warn('Deferred new user creation notice:', err));

            attachRealtimeUserListeners(fbUser.uid, claimsAdmin || effectiveRole === 'admin', newUserDoc.email);
          }

        } catch (e) {
          console.error('Error syncing user with Firestore:', e);
        }
      } else {
        const directSession = localStorage.getItem('betguru_direct_user_session');
        if (directSession) {
          try {
            const parsed = JSON.parse(directSession);
            if (parsed && parsed.uid) {
              const directUid = parsed.uid;
              resetUserDataState();
              const directRef = doc(db, 'users', directUid);
              const directSnap = await getDoc(directRef);
              if (directSnap.exists()) {
                const uData = directSnap.data() as User;
                const isAdminEmail = (uData.email || '').toLowerCase() === 'subhasishpramanik835@gmail.com' || (uData.email || '').toLowerCase() === 'asishp92@gmail.com' || uData.role === 'admin';
                const effectiveBalance = (isAdminEmail && (typeof uData.balance !== 'number' || uData.balance < 6435))
                  ? 6435.00
                  : (typeof uData.balance === 'number' ? uData.balance : 6435.00);
                const loadedUser: User = {
                  ...uData,
                  id: directUid,
                  role: isAdminEmail ? 'admin' : (uData.role || 'user'),
                  balance: effectiveBalance,
                  bonusBalance: typeof uData.bonusBalance === 'number' ? uData.bonusBalance : 100
                };
                setUser(loadedUser);
                setCurrentUser({ uid: directUid, email: loadedUser.email, displayName: loadedUser.name } as any);
                setUserHasAdminClaim(isAdminEmail);

                attachRealtimeUserListeners(directUid, isAdminEmail, loadedUser.email);
              }
            }
          } catch (e) {
            console.warn('Error reading direct user session:', e);
          }
        } else {
          setCurrentUser(null);
          setUser(null as any);
          resetUserDataState();
        }
      }
      setAuthLoading(false);
    });

    const handleDirectAuthChanged = () => {
      if (!auth.currentUser) {
        const directSession = localStorage.getItem('betguru_direct_user_session');
        if (directSession) {
          try {
            const parsed = JSON.parse(directSession);
            if (parsed && parsed.uid) {
              resetUserDataState();
              getDoc(doc(db, 'users', parsed.uid)).then((snap) => {
                if (snap.exists()) {
                  const uData = snap.data() as User;
                  const isAdminEmail = (uData.email || '').toLowerCase() === 'subhasishpramanik835@gmail.com' || (uData.email || '').toLowerCase() === 'asishp92@gmail.com' || uData.role === 'admin';
                  setUser({
                    ...uData,
                    id: parsed.uid,
                    role: isAdminEmail ? 'admin' : (uData.role || 'user')
                  });
                  setCurrentUser({ uid: parsed.uid, email: uData.email, displayName: uData.name } as any);
                  setUserHasAdminClaim(isAdminEmail);

                  attachRealtimeUserListeners(parsed.uid, isAdminEmail, uData.email);
                }
              });
            }
          } catch (e) {
            console.warn('Direct auth changed listener notice:', e);
          }
        } else {
          setCurrentUser(null);
          setUser(null as any);
          resetUserDataState();
        }
      }
    };

    window.addEventListener('betguru_direct_auth_changed', handleDirectAuthChanged);

    return () => {
      cleanupListeners();
      unsubscribeAuth();
      window.removeEventListener('betguru_direct_auth_changed', handleDirectAuthChanged);
    };
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem('betguru_direct_user_session');
      localStorage.removeItem('betguru_user');
      localStorage.removeItem('betguru_deposits');
      localStorage.removeItem('betguru_withdrawals');
      localStorage.removeItem('betguru_tickets');
      localStorage.removeItem('betguru_transactions');
      localStorage.removeItem('betguru_notifications');
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('SignOut non-blocking error:', err);
      }
      setCurrentUser(null);
      setUser(null as any);
      setUserHasAdminClaim(false);
      setIsAdminMode(false);
      setIsDepositOpen(false);
      setIsWithdrawOpen(false);
      setIsNotificationsOpen(false);
      setActiveTab('lottery');
      setAuthLoading(false);
      resetUserDataState();
      window.dispatchEvent(new Event('betguru_direct_auth_changed'));
    } catch (e) {
      console.error('Error signing out:', e);
      setCurrentUser(null);
      setUser(null as any);
      setAuthLoading(false);
    }
  };

  // Banner Sliders Listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'banner_sliders'), (snap) => {
      const list: BannerSlide[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as BannerSlide);
      });
      list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      setBannerSlides(list);
    }, (err) => console.warn('Banner sliders snapshot notice:', err.message));
    return () => unsub();
  }, []);

  const handleBannerSliderAction = (actionType: string, targetUrl?: string) => {
    if (actionType === 'deposit') {
      setIsDepositOpen(true);
    } else if (actionType === 'supercar') {
      setActiveTab('home');
    } else if (actionType === 'lottery') {
      setActiveTab('lottery');
    } else if (actionType === 'wheel') {
      setIsLuckyWheelOpen(true);
    } else if (actionType === 'roulette') {
      setIsLiveRouletteOpen(true);
    } else if (actionType === 'andar_bahar') {
      setIsAndarBaharOpen(true);
    } else if (actionType === 'dragon_tiger') {
      setIsDragonTigerOpen(true);
    } else if (actionType === 'withdrawal') {
      setActiveTab('withdrawal');
    } else if (actionType === 'custom_url' && targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    saveState({ user, draws, deposits, withdrawals, tickets, transactions, notifications });
  }, [user, draws, deposits, withdrawals, tickets, transactions, notifications]);

  // SuperCar Config, Draws & Bonus Rules Real-time Listeners
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'supercar_config', 'main'), (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data();
        console.log('[App.tsx] Real-time supercar_config updated from Firestore:', remoteData);
        setSupercarConfig((prev) => ({ ...prev, ...remoteData }));
      }
    }, (err) => console.warn('Supercar config listener notice:', err.message));

    const unsubBonusRules = onSnapshot(doc(db, 'system_settings', 'bonus_rules'), (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as Partial<BonusBalanceRules>;
        console.log('[App.tsx] Real-time bonus_rules updated from Firestore:', remoteData);
        setBonusRules((prev) => ({
          ...prev,
          ...remoteData,
          allowSuperCar: remoteData.allowSuperCar !== undefined ? remoteData.allowSuperCar : true
        }));
      }
    }, (err) => console.warn('Bonus rules listener notice:', err.message));

    const qSuperCar = query(collection(db, 'supercar_draws'), limit(1000));
    const unsubDraws = onSnapshot(qSuperCar, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => d.data() as SuperCarDrawIssue);
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) return timeB - timeA;
          return (b.issueId || '').localeCompare(a.issueId || '');
        });
        setSupercarPastDraws(list);
        try {
          localStorage.setItem('betguru_supercar_draws', JSON.stringify(list));
        } catch (_) {}
      } else {
        setSupercarPastDraws([]);
      }
    }, (err) => console.warn('Supercar draws listener notice:', err.message));

    const qLotteryDraws = query(collection(db, 'draws'), limit(50));
    const unsubLotteryDraws = onSnapshot(qLotteryDraws, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDraw));
        // If any of the 4 default draws is missing, auto-seed it to ensure all 4 are always present
        const existingIds = new Set(list.map(d => d.id));
        const missing = INITIAL_DRAWS.filter(d => !existingIds.has(d.id));
        if (missing.length > 0) {
          missing.forEach(mDraw => {
            setDoc(doc(db, 'draws', mDraw.id), mDraw, { merge: true }).catch(() => {});
          });
        }
        setDraws(list.length >= 4 ? list : [...list, ...missing]);
      } else {
        INITIAL_DRAWS.forEach((initDraw) => {
          setDoc(doc(db, 'draws', initDraw.id), initDraw, { merge: true }).catch(() => {});
        });
        setDraws(INITIAL_DRAWS);
      }
    }, (err) => console.warn('Lottery draws listener notice:', err.message));

    const qResults = query(collection(db, 'draw_results'), limit(100));
    const unsubResults = onSnapshot(qResults, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LotteryDrawResult));
        list.sort((a, b) => {
          const tA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.date || 0).getTime();
          const tB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.date || 0).getTime();
          return tB - tA;
        });
        setLotteryResults(list);
      } else {
        INITIAL_DRAW_RESULTS.forEach(r => {
          setDoc(doc(db, 'draw_results', r.id), r, { merge: true }).catch(() => {});
        });
        setLotteryResults(INITIAL_DRAW_RESULTS);
      }
    }, (err) => console.warn('Lottery results listener notice:', err.message));

    return () => {
      unsubConfig();
      unsubBonusRules();
      unsubDraws();
      unsubLotteryDraws();
      unsubResults();
    };
  }, []);

  // Robust boolean check for SuperCar draw section visibility
  const isSuperCarEnabled = supercarConfig?.enabled === undefined
    ? true
    : (supercarConfig.enabled === true || String(supercarConfig.enabled).toLowerCase() === 'true');

  // Forced debug log of supercarConfig upon mount/update to verify Red car image URL
  useEffect(() => {
    const redCarInfo = getSuperCarInfo('red', supercarConfig);
    console.log('[App.tsx] Mount/Update supercarConfig state:', supercarConfig);
    console.log('[App.tsx] supercarConfig.enabled raw:', supercarConfig?.enabled, 'parsed isSuperCarEnabled:', isSuperCarEnabled);
    console.log('[App.tsx] Red Car Image URL:', redCarInfo.image);
    console.log('[App.tsx] Red Car Full Details:', redCarInfo);
  }, [supercarConfig, isSuperCarEnabled]);

  // SuperCar Ticket Purchase Handler (Supports Main Wallet and Bonus Wallet)
  const handleConfirmSuperCarTicketBuy = async (
    carColor: SuperCarColor,
    quantity: number,
    totalCost: number,
    issueId?: string,
    slotNum?: number,
    walletType: 'main' | 'bonus' = 'main'
  ) => {
    const currentUserId = user?.id || 'anonymous';
    const currentBalance = user?.balance || 0;
    const currentBonusBalance = user?.bonusBalance || 0;

    logAnalyticsEvent('ticket_buy', { category: 'Three Super Car Draw', carColor, quantity, totalCost, walletType }, currentUserId, user?.email);

    // Validate Bonus Balance Permissions
    if (walletType === 'bonus') {
      if (bonusRules?.isBonusSystemActive === false || bonusRules?.allowSuperCar === false) {
        alert('বোনাস ব্যালেন্স দিয়ে সুপার কার টিকিট কেনা বর্তমানে এডমিন কর্তৃক বন্ধ রয়েছে। দয়া করে মূল ব্যালেন্স ব্যবহার করুন।');
        return;
      }
      if (currentBonusBalance < totalCost) {
        alert(`অপর্যাপ্ত বোনাস ব্যালেন্স! প্রয়োজন ₹${totalCost}, আছে ₹${currentBonusBalance.toFixed(2)}। মূল ব্যালেন্স ব্যবহার করুন বা ডিপোজিট করুন।`);
        return;
      }
    } else {
      if (currentBalance < totalCost) {
        alert(`Insufficient Wallet Balance! Required ₹${totalCost}, Available ₹${currentBalance.toFixed(2)}. Please deposit funds.`);
        setIsDepositOpen(true);
        return;
      }
    }

    const earnedVipPts = Math.floor(totalCost / 10);
    const updatedVipPts = (user?.vipPoints || 0) + earnedVipPts;

    let newBal = currentBalance;
    let newBonusBal = currentBonusBalance;

    if (walletType === 'bonus') {
      newBonusBal = Math.max(0, currentBonusBalance - totalCost);
      setUser((prev) => ({
        ...prev,
        bonusBalance: newBonusBal,
        vipPoints: updatedVipPts
      }));
      if (user?.id) persistUserBalance(user.id, currentBalance, newBonusBal, user.email);
    } else {
      newBal = Math.max(0, currentBalance - totalCost);
      setUser((prev) => ({
        ...prev,
        balance: newBal,
        vipPoints: updatedVipPts
      }));
      if (user?.id) persistUserBalance(user.id, newBal, currentBonusBalance, user.email);
    }

    const now = new Date();
    const isoDateStr = now.toISOString();
    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const todayDashDate = `${year}-${monthStr}-${dayStr}`;

    let activeSlot = slotNum;
    let activeIssueId = issueId;

    if (!activeSlot || !activeIssueId) {
      const sched = getCurrentSuperCarSchedule(supercarConfig);
      activeSlot = sched.drawIndex;
      activeIssueId = sched.issueId;
    }

    // Calculate slot time label (08:00 AM + (activeSlot - 1)*10 mins)
    const startMins = 8 * 60 + (activeSlot - 1) * 10;
    const h = Math.floor(startMins / 60);
    const m = startMins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    const slotTimeLabel = `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

    const exactTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const batchId = `BATCH-SC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTickets: PurchasedTicket[] = [];
    const pricePerTicket = quantity > 0 ? Math.round(totalCost / quantity) : (supercarConfig.ticketPrice || 100);

    for (let i = 0; i < quantity; i++) {
      const ticketNum = `CAR-${carColor.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const newTicket: PurchasedTicket = {
        id: `TKT-SC-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        batchId: batchId,
        userId: currentUserId,
        drawId: activeIssueId,
        drawTitle: `3 Super Car Draw - ${carColor.toUpperCase()} CAR (Slot #${String(activeSlot).padStart(2, '0')} - ${slotTimeLabel})`,
        category: 'Three Super Car Draw',
        selectedNumbers: [carColor.toUpperCase()],
        ticketNumber: ticketNum,
        price: pricePerTicket,
        purchaseDate: todayDashDate,
        purchaseTime: exactTimeStr,
        drawTime: slotTimeLabel,
        drawDate: todayDashDate,
        createdAt: isoDateStr,
        status: 'active',
        selectedCar: carColor.toLowerCase() as SuperCarColor,
        slotNum: activeSlot,
        walletType: walletType
      };
      newTickets.push(newTicket);
    }

    setTickets((prev) => sortChronologicalNewestFirst([...newTickets, ...prev]));
    newTickets.forEach((t) => persistTicket(t));

    const tx: WalletTransaction = {
      id: `TXN-SUPERCAR-${Date.now().toString().slice(-4)}`,
      userId: currentUserId,
      type: 'ticket_buy',
      amount: -totalCost,
      walletType: walletType,
      description: `Purchased ${quantity}x ${carColor.toUpperCase()} Super Car Ticket(s) (from ${walletType === 'bonus' ? 'Bonus' : 'Main'} Wallet) (+${earnedVipPts} VIP Pts)`,
      status: 'completed',
      date: isoDateStr,
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([tx, ...prev]));
    persistTransaction(tx);

    triggerConfetti();
  };

  // SuperCar Draw Resolved Handler
  const handleSuperCarDrawResolved = async (issueId: string, winningCar: SuperCarColor) => {
    soundFx.playWinFanfare();
    triggerConfetti();

    let totalWonMainAmount = 0;
    let totalWonBonusAmount = 0;
    const multiplier = supercarConfig.prizeMultiplier || 2.8;

    const updatedTickets = tickets.map((t) => {
      if (t.category === 'Three Super Car Draw' && t.status === 'active') {
        const slotInfo = getSlotFromTicket(t, supercarConfig);
        const matchesDraw =
          t.drawId === issueId ||
          slotInfo.issueId === issueId ||
          (t.drawTitle && t.drawTitle.includes(issueId));

        if (matchesDraw) {
          const tCar = (t.selectedCar || t.selectedNumbers?.[0] as string || 'red').toLowerCase();
          if (tCar === winningCar.toLowerCase()) {
            const winAmt = Math.round(t.price * multiplier);
            if (t.walletType === 'bonus') {
              totalWonBonusAmount += winAmt;
            } else {
              totalWonMainAmount += winAmt;
            }
            const updatedT = { ...t, status: 'win' as const, winAmount: winAmt, drawId: issueId };
            persistTicket(updatedT);
            return updatedT;
          } else {
            const updatedT = { ...t, status: 'loss' as const, drawId: issueId };
            persistTicket(updatedT);
            return updatedT;
          }
        }
      }
      return t;
    });

    setTickets(sortChronologicalNewestFirst(updatedTickets));

    if (totalWonMainAmount > 0 || totalWonBonusAmount > 0) {
      setUser((prev) => {
        if (!prev) return prev;
        const newBal = (prev.balance || 0) + totalWonMainAmount;
        const newBonusBal = (prev.bonusBalance || 0) + totalWonBonusAmount;
        if (prev.id) persistUserBalance(prev.id, newBal, newBonusBal, prev.email);
        return {
          ...prev,
          balance: newBal,
          bonusBalance: newBonusBal,
          totalWon: (prev.totalWon || 0) + totalWonMainAmount + totalWonBonusAmount
        };
      });

      if (totalWonMainAmount > 0) {
        const winMainTx: WalletTransaction = {
          id: `TXN-SC-WIN-${Date.now().toString().slice(-4)}`,
          userId: user?.id || 'anonymous',
          type: 'ticket_win',
          amount: totalWonMainAmount,
          walletType: 'main',
          description: `🏆 WON Super Car Draw Jackpot (${winningCar.toUpperCase()} Car Winner!) - Added to Main Wallet`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        };
        setTransactions((prev) => sortChronologicalNewestFirst([winMainTx, ...prev]));
        persistTransaction(winMainTx);
      }

      if (totalWonBonusAmount > 0) {
        const winBonusTx: WalletTransaction = {
          id: `TXN-SC-BONUS-WIN-${Date.now().toString().slice(-4)}`,
          userId: user?.id || 'anonymous',
          type: 'ticket_win',
          amount: totalWonBonusAmount,
          walletType: 'bonus',
          description: `🏆 WON Super Car Draw (${winningCar.toUpperCase()} Car Winner!) - Added to Bonus Wallet`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        };
        setTransactions((prev) => sortChronologicalNewestFirst([winBonusTx, ...prev]));
        persistTransaction(winBonusTx);
      }
    }

    try {
      const drawIssueDoc: SuperCarDrawIssue = {
        id: issueId,
        issueId,
        drawTime: new Date().toLocaleString('en-IN'),
        winningCar,
        status: 'completed'
      };
      await setDoc(doc(db, 'supercar_draws', issueId), drawIssueDoc, { merge: true });
    } catch (err) {
      console.error('Error recording supercar draw result:', err);
    }
  };

  // Continuous Auto-Settlement Engine for Expired Super Car Tickets
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;

    const interval = setInterval(() => {
      const activeSuperCarTickets = tickets.filter(
        (t) => t.category === 'Three Super Car Draw' && t.status === 'active'
      );

      if (activeSuperCarTickets.length === 0) return;

      const nowMs = Date.now();
      let totalNewWonMainAmount = 0;
      let totalNewWonBonusAmount = 0;
      let lastWonCar: SuperCarColor = 'black';
      let hasSettled = false;

      const updated = tickets.map((t) => {
        if (t.category === 'Three Super Car Draw' && t.status === 'active') {
          const slotInfo = getSlotFromTicket(t, supercarConfig);
          // Has draw timer expired for this slot?
          if (nowMs >= slotInfo.drawEndTimeMs) {
            hasSettled = true;
            const winningCar = getWinningCarForSlot(
              slotInfo.slotNum,
              slotInfo.issueId,
              supercarPastDraws,
              supercarConfig
            );

            const playerCar = (t.selectedCar || t.selectedNumbers?.[0] || 'red')
              .toString()
              .toLowerCase() as SuperCarColor;

            const isWinner = playerCar === winningCar.toLowerCase();

            if (isWinner) {
              const multiplier = supercarConfig.prizeMultiplier || 2.8;
              const winAmt = Math.round(t.price * multiplier);
              if (t.walletType === 'bonus') {
                totalNewWonBonusAmount += winAmt;
              } else {
                totalNewWonMainAmount += winAmt;
              }
              lastWonCar = winningCar;

              const updatedT: PurchasedTicket = {
                ...t,
                status: 'win' as const,
                wonAmount: winAmt,
                slotNum: slotInfo.slotNum,
                drawId: slotInfo.issueId
              };
              persistTicket(updatedT);
              return updatedT;
            } else {
              const updatedT: PurchasedTicket = {
                ...t,
                status: 'loss' as const,
                slotNum: slotInfo.slotNum,
                drawId: slotInfo.issueId
              };
              persistTicket(updatedT);
              return updatedT;
            }
          }
        }
        return t;
      });

      if (hasSettled) {
        setTickets(sortChronologicalNewestFirst(updated));

        if (totalNewWonMainAmount > 0 || totalNewWonBonusAmount > 0) {
          setUser((prev) => {
            if (!prev) return prev;
            const newBal = (prev.balance || 0) + totalNewWonMainAmount;
            const newBonusBal = (prev.bonusBalance || 0) + totalNewWonBonusAmount;
            if (prev.id) persistUserBalance(prev.id, newBal, newBonusBal, prev.email);
            return {
              ...prev,
              balance: newBal,
              bonusBalance: newBonusBal,
              totalWon: (prev.totalWon || 0) + totalNewWonMainAmount + totalNewWonBonusAmount
            };
          });

          if (totalNewWonMainAmount > 0) {
            const winTx: WalletTransaction = {
              id: `TXN-SC-WIN-${Date.now().toString().slice(-4)}`,
              userId: user?.id || 'anonymous',
              type: 'ticket_win',
              amount: totalNewWonMainAmount,
              walletType: 'main',
              description: `🏆 Auto Payout: WON Super Car Draw (${lastWonCar.toUpperCase()} Winner!) - Credited to Main Wallet`,
              status: 'completed',
              date: new Date().toLocaleString('en-IN'),
              createdAt: new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([winTx, ...prev]));
            persistTransaction(winTx);
          }

          if (totalNewWonBonusAmount > 0) {
            const bonusWinTx: WalletTransaction = {
              id: `TXN-SC-BONUS-WIN-${Date.now().toString().slice(-4)}`,
              userId: user?.id || 'anonymous',
              type: 'ticket_win',
              amount: totalNewWonBonusAmount,
              walletType: 'bonus',
              description: `🏆 Auto Payout: WON Super Car Draw (${lastWonCar.toUpperCase()} Winner!) - Credited to Bonus Wallet`,
              status: 'completed',
              date: new Date().toLocaleString('en-IN'),
              createdAt: new Date().toISOString()
            };
            setTransactions((prev) => sortChronologicalNewestFirst([bonusWinTx, ...prev]));
            persistTransaction(bonusWinTx);
          }

          try {
            soundFx.playWinFanfare();
            triggerConfetti();
          } catch (_) {}
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [tickets, supercarPastDraws, supercarConfig, user?.id]);

  // Audio mute toggle
  const handleToggleMute = () => {
    const muted = soundFx.toggleMute();
    setIsMuted(muted);
  };

  // Helper to trigger confetti celebrations
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.log('Confetti failed', e);
    }
  };

  // Automated Draw Resolution Timer Check (Runs every 10 sec)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let hasUpdates = false;

      const updatedDraws = draws.map((draw) => {
        if (draw.endTime <= now) {
          hasUpdates = true;
          // Generate winning numbers if not already set
          const digitLen = draw.category === '4D Express' ? 4 : 6;
          const winningDigits = draw.winningNumbers || Array.from({ length: digitLen }, () => Math.floor(Math.random() * 10));

          // Evaluate player tickets for this draw
          tickets.forEach((t) => {
            if (t.drawId === draw.id && t.status === 'active') {
              const selectedStr = (t.selectedNumbers || (t as any).numbers || []).join('');
              const winStr = (winningDigits || []).join('');
              const isWin = selectedStr === winStr;
              const status = isWin ? 'win' : 'loss';
              const wonAmount = isWin ? draw.firstPrize : 0;

              t.status = status;
              t.wonAmount = wonAmount;

              if (isWin) {
                const isBonusWallet = t.walletType === 'bonus';
                // Auto add funds to user wallet (Main vs Bonus according to purchase source)
                setUser((prev) => {
                  if (!prev) return prev;
                  const currentBal = prev.balance || 0;
                  const currentBonus = prev.bonusBalance || 0;
                  const newBal = isBonusWallet ? currentBal : currentBal + wonAmount;
                  const newBonus = isBonusWallet ? currentBonus + wonAmount : currentBonus;
                  if (prev.id) persistUserBalance(prev.id, newBal, newBonus, prev.email);
                  return {
                    ...prev,
                    balance: newBal,
                    bonusBalance: newBonus,
                    totalWon: (prev.totalWon || 0) + wonAmount
                  };
                });

                const currentUserId = user?.id || 'anonymous';

                // Add win transaction
                const winTx: WalletTransaction = {
                  id: `TXN-WIN-${Date.now().toString().slice(-4)}`,
                  userId: currentUserId,
                  type: 'win_payout',
                  amount: wonAmount,
                  walletType: isBonusWallet ? 'bonus' : 'main',
                  description: `Jackpot Win! ${draw.title} (${isBonusWallet ? 'Credited to Bonus Wallet' : 'Credited to Main Wallet'})`,
                  status: 'completed',
                  date: new Date().toLocaleString('en-IN'),
                  createdAt: new Date().toISOString()
                };
                setTransactions((prev) => [winTx, ...prev]);
                persistTransaction(winTx);

                // Add notification
                const winNtf: NotificationItem = {
                  id: `NTF-${Date.now()}`,
                  userId: currentUserId,
                  title: `🎉 JACKPOT WINNER! You Won ₹${wonAmount.toLocaleString('en-IN')}`,
                  message: `Your ticket for ${draw.title} matched all numbers (${winningDigits.join(' ')})! Credited to ${isBonusWallet ? 'Bonus' : 'Main'} Wallet.`,
                  type: 'win',
                  date: 'Just now',
                  read: false
                };
                setNotifications((prev) => [winNtf, ...prev]);
                triggerConfetti();
              }
            }
          });

          // Reset draw countdown for next round
          return {
            ...draw,
            endTime: now + draw.drawDurationMs,
            winningNumbers: winningDigits,
            totalTicketsSold: Math.floor(Math.random() * 200) + 100
          };
        }
        return draw;
      });

      if (hasUpdates) {
        setDraws(updatedDraws);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [draws, tickets, user?.id]);

  // Auto-dismiss non-critical informational notifications after 5 seconds
  useEffect(() => {
    const autoDismissTimer = setInterval(() => {
      const now = Date.now();
      setNotifications((prev) =>
        prev.filter((ntf) => {
          if (ntf.type === 'system' && !ntf.isCritical) {
            const age = now - (ntf.createdAt || now);
            return age < 5000;
          }
          return true;
        })
      );
    }, 1000);

    return () => clearInterval(autoDismissTimer);
  }, []);

  // Handle Deposit Submission
  const handleDepositSubmit = (amount: number, method: PaymentMethodType, utr: string, screenshotUrl: string) => {
    if (user) {
      logAnalyticsEvent('deposit_attempt', { amount, method, utr }, user.id, user.email);
    }

    const newDep: DepositRequest = {
      id: `DEP-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      userName: user?.name || 'User',
      userPhone: user?.phone || '',
      amount,
      method,
      utr,
      screenshotUrl,
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    setDeposits((prev) => sortChronologicalNewestFirst([newDep, ...prev]));
    persistDeposit(newDep);

    // Send real-time SMTP Email notification
    if (user?.email) {
      notifyDepositSubmitted(user.email, user.name || 'User', amount, method, utr).catch((err) =>
        console.warn('Deposit submission email error:', err)
      );
    }

    // Add user notification
    const depNtf: NotificationItem = {
      id: `NTF-${Date.now()}`,
      userId: user?.id || 'anonymous',
      title: '⏳ Deposit Submitted under Verification',
      message: `Your deposit request of ₹${amount} via ${(method || 'UPI').toString().toUpperCase()} (UTR: ${utr}) is under verification.`,
      type: 'deposit',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [depNtf, ...prev]);
  };

  // Handle Admin Approve Deposit
  const handleAdminApproveDeposit = async (depositId: string) => {
    const dep = deposits.find((d) => d.id === depositId);
    if (!dep || dep.status !== 'pending') return;

    const updatedDep: DepositRequest = { ...dep, status: 'approved' };
    setDeposits((prev) =>
      prev.map((d) => (d.id === depositId ? updatedDep : d))
    );
    persistDeposit(updatedDep);

    try {
      // Fetch the target user's current doc from Firestore to get their real balance
      const targetUserRef = doc(db, 'users', dep.userId);
      const targetSnap = await getDoc(targetUserRef);
      let targetUserBal = 0;
      let targetSpinCredits = 0;
      if (targetSnap.exists()) {
        const uData = targetSnap.data();
        targetUserBal = typeof uData?.balance === 'number' ? uData.balance : 0;
        targetSpinCredits = typeof uData?.spinCredits === 'number' ? uData.spinCredits : 0;
      }
      const newBal = targetUserBal + dep.amount;
      const spinsEarned = dep.amount >= 1000 ? Math.floor(dep.amount / 1000) : 0;
      const newSpinCredits = targetSpinCredits + spinsEarned;

      // Update the target user's balance and spin credits in Firestore
      await setDoc(doc(db, 'users', dep.userId), {
        balance: newBal,
        spinCredits: newSpinCredits
      }, { merge: true });

      // Dispatch real-time email notification
      const targetUserEmail = targetSnap.exists() ? (targetSnap.data()?.email || dep.userName) : (user?.email || dep.userName);
      const targetUserName = targetSnap.exists() ? (targetSnap.data()?.name || dep.userName) : dep.userName;
      notifyDepositApproved(targetUserEmail, targetUserName, dep.amount).catch((err) =>
        console.warn('Deposit approved email error:', err)
      );

      // Only update local `user` state if the admin is approving their own deposit
      if (user?.id === dep.userId) {
        setUser((prev) => prev ? ({
          ...prev,
          balance: newBal,
          spinCredits: (prev.spinCredits || 0) + spinsEarned
        }) : prev);
      }
    } catch (err) {
      console.error('Error updating target user balance upon deposit approval:', err);
    }

    // Add transaction & persist
    const depTx: WalletTransaction = {
      id: `TXN-DEP-${Date.now().toString().slice(-4)}`,
      userId: dep.userId,
      type: 'deposit',
      amount: dep.amount,
      description: `Approved Deposit via ${(dep.method || 'UPI').toString().toUpperCase()} (UTR: ${dep.utr})`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([depTx, ...prev]));
    persistTransaction(depTx);

    // Send Notification
    const approveNtf: NotificationItem = {
      id: `NTF-${Date.now()}`,
      userId: dep.userId,
      title: `✅ Deposit Approved (₹${dep.amount})`,
      message: `Your deposit of ₹${dep.amount} has been verified and added to your wallet!`,
      type: 'deposit',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [approveNtf, ...prev]);
    persistNotification(approveNtf);
    triggerConfetti();
  };

  // Handle Admin Reject Deposit
  const handleAdminRejectDeposit = (depositId: string, reason: string) => {
    const dep = deposits.find((d) => d.id === depositId);
    if (dep) {
      const updatedDep: DepositRequest = { ...dep, status: 'rejected', rejectReason: reason };
      setDeposits((prev) =>
        prev.map((d) => (d.id === depositId ? updatedDep : d))
      );
      persistDeposit(updatedDep);

      // Fetch user email for rejection email dispatch
      getDoc(doc(db, 'users', dep.userId)).then((snap) => {
        const targetEmail = snap.exists() ? (snap.data()?.email || dep.userName) : user.email;
        const targetName = snap.exists() ? (snap.data()?.name || dep.userName) : dep.userName;
        notifyDepositRejected(targetEmail, targetName, dep.amount, reason).catch((err) =>
          console.warn('Deposit rejected email error:', err)
        );
      }).catch(() => {
        notifyDepositRejected(user.email, dep.userName, dep.amount, reason).catch(() => {});
      });

      const rejTx: WalletTransaction = {
        id: `TXN-DEP-REJ-${Date.now().toString().slice(-4)}`,
        userId: dep.userId,
        type: 'deposit',
        amount: dep.amount,
        description: `Deposit Rejected: ${reason}`,
        status: 'rejected',
        date: new Date().toLocaleString('en-IN'),
        createdAt: new Date().toISOString()
      };
      setTransactions((prev) => sortChronologicalNewestFirst([rejTx, ...prev]));
      persistTransaction(rejTx);

      const rejectNtf: NotificationItem = {
        id: `NTF-${Date.now()}`,
        userId: dep.userId,
        title: `❌ Deposit Rejected (₹${dep.amount})`,
        message: `Reason: ${reason}. Please re-upload valid UTR / screenshot.`,
        type: 'deposit',
        date: 'Just now',
        read: false
      };
      setNotifications((prev) => [rejectNtf, ...prev]);
      persistNotification(rejectNtf);
    }
  };

  // Handle Withdrawal Submission
  const handleWithdrawSubmit = (amount: number, fullName: string, accountNumber: string, ifscCode: string, upiId: string) => {
    if (user) {
      logAnalyticsEvent('withdrawal_submission', { amount, fullName, accountNumber: `••••${accountNumber.slice(-4)}`, upiId }, user.id, user.email);
    }

    const currentBal = user?.balance || 0;
    const newBal = Math.max(0, currentBal - amount);
    setUser((prev) => prev ? ({
      ...prev,
      balance: newBal
    }) : prev);
    if (user?.id) {
      persistUserBalance(user.id, newBal);
    }

    const newWth: WithdrawalRequest = {
      id: `WTH-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: user?.id || 'anonymous',
      userName: user?.name || 'User',
      userPhone: user?.phone || '',
      amount,
      fullName,
      accountNumber,
      ifscCode,
      upiId,
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    setWithdrawals((prev) => sortChronologicalNewestFirst([newWth, ...prev]));
    persistWithdrawal(newWth);

    // Send real-time withdrawal submission email
    if (user?.email) {
      notifyWithdrawalSubmitted(user.email, user.name || 'User', amount, accountNumber.slice(-4)).catch((err) =>
        console.warn('Withdrawal submission email error:', err)
      );
    }

    // Add wallet ledger tx
    const wthTx: WalletTransaction = {
      id: `TXN-WTH-${Date.now().toString().slice(-4)}`,
      userId: user?.id || 'anonymous',
      type: 'withdrawal',
      amount: -amount,
      description: `Withdrawal Request to A/C ending ${accountNumber.slice(-4)}`,
      status: 'pending',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([wthTx, ...prev]));
    persistTransaction(wthTx);
  };

  // Handle Admin Approve Withdrawal
  const handleAdminApproveWithdrawal = (withdrawalId: string) => {
    const wth = withdrawals.find((w) => w.id === withdrawalId);
    if (wth) {
      const updatedWth: WithdrawalRequest = { ...wth, status: 'approved' };
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === withdrawalId ? updatedWth : w))
      );
      persistWithdrawal(updatedWth);

      // Dispatch real-time withdrawal approval email
      getDoc(doc(db, 'users', wth.userId)).then((snap) => {
        const targetEmail = snap.exists() ? (snap.data()?.email || wth.userName) : (user?.email || wth.userName);
        const targetName = snap.exists() ? (snap.data()?.name || wth.userName) : wth.userName;
        notifyWithdrawalApproved(targetEmail, targetName, wth.amount, wth.accountNumber).catch((err) =>
          console.warn('Withdrawal approved email error:', err)
        );
      }).catch(() => {
        if (user?.email) {
          notifyWithdrawalApproved(user.email, wth.userName, wth.amount, wth.accountNumber).catch(() => {});
        }
      });

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.type === 'withdrawal' && (tx.id.includes(wth.id) || tx.description.includes(wth.accountNumber.slice(-4)))
            ? { ...tx, status: 'completed' }
            : tx
        )
      );

      const approveNtf: NotificationItem = {
        id: `NTF-${Date.now()}`,
        userId: wth.userId,
        title: `✅ Withdrawal Approved (₹${wth.amount})`,
        message: `Your withdrawal of ₹${wth.amount} has been processed to A/C ${wth.accountNumber}.`,
        type: 'withdrawal',
        date: 'Just now',
        read: false
      };
      setNotifications((prev) => [approveNtf, ...prev]);
      persistNotification(approveNtf);
    }
  };

  // Handle Admin Reject Withdrawal
  const handleAdminRejectWithdrawal = async (withdrawalId: string, reason: string) => {
    const wth = withdrawals.find((w) => w.id === withdrawalId);
    if (wth) {
      const updatedWth: WithdrawalRequest = { ...wth, status: 'rejected', rejectReason: reason };
      setWithdrawals((prev) =>
        prev.map((w) => (w.id === withdrawalId ? updatedWth : w))
      );
      persistWithdrawal(updatedWth);

      // Dispatch real-time withdrawal rejection email
      getDoc(doc(db, 'users', wth.userId)).then((snap) => {
        const targetEmail = snap.exists() ? (snap.data()?.email || wth.userName) : (user?.email || wth.userName);
        const targetName = snap.exists() ? (snap.data()?.name || wth.userName) : wth.userName;
        notifyWithdrawalRejected(targetEmail, targetName, wth.amount, reason).catch((err) =>
          console.warn('Withdrawal rejected email error:', err)
        );
      }).catch(() => {
        if (user?.email) {
          notifyWithdrawalRejected(user.email, wth.userName, wth.amount, reason).catch(() => {});
        }
      });

      // Refund user balance in Firestore
      try {
        const targetUserRef = doc(db, 'users', wth.userId);
        const targetSnap = await getDoc(targetUserRef);
        let targetUserBal = 0;
        if (targetSnap.exists()) {
          const uData = targetSnap.data();
          targetUserBal = typeof uData?.balance === 'number' ? uData.balance : 0;
        }
        const newBal = targetUserBal + wth.amount;
        await persistUserBalance(wth.userId, newBal);

        if (user?.id === wth.userId) {
          setUser((prev) => prev ? ({
            ...prev,
            balance: newBal
          }) : prev);
        }
      } catch (err) {
        console.error('Error refunding target user balance upon withdrawal rejection:', err);
      }

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.type === 'withdrawal' && (tx.id.includes(wth.id) || tx.description.includes(wth.accountNumber.slice(-4)))
            ? { ...tx, status: 'rejected', description: `${tx.description} (Rejected: ${reason})` }
            : tx
        )
      );

      const rejectNtf: NotificationItem = {
        id: `NTF-${Date.now()}`,
        userId: wth.userId,
        title: `❌ Withdrawal Rejected (₹${wth.amount})`,
        message: `Your withdrawal of ₹${wth.amount} was rejected. Reason: ${reason}. Amount refunded to wallet.`,
        type: 'withdrawal',
        date: 'Just now',
        read: false
      };
      setNotifications((prev) => [rejectNtf, ...prev]);
      persistNotification(rejectNtf);
    }
  };

  // Handle Ticket Purchase Confirmation (Supports Main Wallet and Bonus Wallet)
  const handleConfirmTicketBuy = (
    draw: LotteryDraw,
    ticketDigitsArray: number[][],
    totalPrice: number,
    walletType: 'main' | 'bonus' = 'main'
  ) => {
    if (user) {
      logAnalyticsEvent('ticket_buy', { gameType: 'lottery', drawId: draw.id, drawTitle: draw.title, ticketCount: ticketDigitsArray.length, totalPrice, walletType }, user.id, user.email);
    }

    if (walletType === 'bonus' && (!bonusRules?.isBonusSystemActive || !bonusRules?.allowRegularLottery)) {
      alert('বোনাস ব্যালেন্স দিয়ে শুধুমাত্র থ্রী সুপার কার টিকিট কেনা যাবে। এই লটারির জন্য মূল ব্যালেন্স ব্যবহার করুন।');
      return;
    }

    // Award VIP Points (1 Point per ₹10 spent)
    const earnedVipPts = Math.floor(totalPrice / 10);

    const currentBal = user?.balance || 0;
    const currentBonus = user?.bonusBalance || 0;

    let newBal = currentBal;
    let newBonus = currentBonus;

    if (walletType === 'bonus') {
      if (currentBonus < totalPrice) {
        alert(`অপর্যাপ্ত বোনাস ব্যালেন্স! প্রয়োজন ₹${totalPrice}, আছে ₹${currentBonus.toFixed(2)}।`);
        return;
      }
      newBonus = Math.max(0, currentBonus - totalPrice);
    } else {
      if (currentBal < totalPrice) {
        alert(`Insufficient Wallet Balance! Required ₹${totalPrice}, Available ₹${currentBal.toFixed(2)}.`);
        setIsDepositOpen(true);
        return;
      }
      newBal = Math.max(0, currentBal - totalPrice);
    }

    setUser((prev) => {
      if (!prev) return prev;
      const newPts = (prev.vipPoints || 120) + earnedVipPts;
      let newLevel = prev.vipLevel;
      if (newPts >= 10000) newLevel = 'VIP Platinum';
      else if (newPts >= 2000) newLevel = 'Gold';
      else if (newPts >= 500) newLevel = 'Silver';

      return {
        ...prev,
        balance: newBal,
        bonusBalance: newBonus,
        totalSpent: (prev.totalSpent || 0) + totalPrice,
        vipPoints: newPts,
        vipLevel: newLevel
      };
    });
    if (user?.id) persistUserBalance(user.id, newBal, newBonus, user.email);

    // Create tickets
    const batchId = `BATCH-LOTTERY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTickets: PurchasedTicket[] = ticketDigitsArray.map((digits) => ({
      id: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      batchId: batchId,
      userId: user?.id || 'anonymous',
      drawId: draw.id,
      drawTitle: draw.title,
      ticketNumber: digits.join(' '),
      selectedNumbers: digits,
      price: draw.ticketPrice,
      purchaseDate: new Date().toLocaleString('en-IN'),
      drawTime: draw.endTime,
      status: 'active',
      walletType: walletType
    }));

    setTickets((prev) => sortChronologicalNewestFirst([...newTickets, ...prev]));
    newTickets.forEach((t) => persistTicket(t));

    // Log transaction
    const tx: WalletTransaction = {
      id: `TXN-BUY-${Date.now().toString().slice(-4)}`,
      userId: user?.id || 'anonymous',
      type: 'ticket_buy',
      amount: -totalPrice,
      walletType: walletType,
      description: `Purchased ${ticketDigitsArray.length} Ticket(s) - ${draw.title} (from ${walletType === 'bonus' ? 'Bonus' : 'Main'} Wallet) (+${earnedVipPts} VIP Pts)`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([tx, ...prev]));
    persistTransaction(tx);

    // Update tickets sold count
    setDraws((prev) =>
      prev.map((d) => (d.id === draw.id ? { ...d, totalTicketsSold: d.totalTicketsSold + ticketDigitsArray.length } : d))
    );

    triggerConfetti();
  };

  // Handle Weekly VIP Bonus Claim
  const handleClaimVipBonus = (bonusAmount: number) => {
    const currentBal = user?.balance || 0;
    const newBal = currentBal + bonusAmount;
    setUser((prev) => prev ? ({
      ...prev,
      balance: newBal
    }) : prev);
    if (user?.id) persistUserBalance(user.id, newBal);

    if (user?.email) {
      notifyBonusCredited(user.email, user.name || 'VIP Member', bonusAmount, `Weekly VIP Club Bonus (${user.vipLevel || 'Member'})`).catch((err) =>
        console.warn('VIP bonus email error:', err)
      );
    }

    const vipTx: WalletTransaction = {
      id: `TXN-VIP-${Date.now().toString().slice(-4)}`,
      userId: user?.id || 'anonymous',
      type: 'vip_bonus',
      amount: bonusAmount,
      description: `Weekly VIP Club Cash Bonus (${user?.vipLevel || 'VIP'})`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([vipTx, ...prev]));
    persistTransaction(vipTx);

    const ntf: NotificationItem = {
      id: `NTF-${Date.now()}`,
      userId: user?.id || 'anonymous',
      title: `👑 Weekly VIP Bonus (₹${bonusAmount})`,
      message: `You claimed your weekly VIP bonus payout of ₹${bonusAmount}!`,
      type: 'win',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [ntf, ...prev]);
    triggerConfetti();
  };

  // Handle Claim Spin Reward
  const handleClaimWheelReward = (rewardAmount: number) => {
    const currentBal = user?.balance || 0;
    const newBal = currentBal + rewardAmount;
    const currentCredits = user?.spinCredits ?? 0;
    const newCredits = Math.max(0, currentCredits - 1);

    setUser((prev) => prev ? ({
      ...prev,
      balance: newBal,
      spinCredits: newCredits,
      lastSpinTime: Date.now()
    }) : prev);

    if (user?.id) {
      setDoc(doc(db, 'users', user.id), {
        balance: newBal,
        spinCredits: newCredits,
        lastSpinTime: Date.now()
      }, { merge: true }).catch((err) => console.warn('Persist spin credit error:', err));
    }

    if (user?.email) {
      notifyBonusCredited(user.email, user.name || 'Player', rewardAmount, 'Daily Lucky Spin Wheel Bonus').catch((err) =>
        console.warn('Wheel bonus email error:', err)
      );
    }

    const wheelTx: WalletTransaction = {
      id: `TXN-WHEEL-${Date.now().toString().slice(-4)}`,
      userId: user?.id || 'anonymous',
      type: 'wheel_bonus',
      amount: rewardAmount,
      description: `Lucky Wheel Bonus Reward`,
      status: 'completed',
      date: new Date().toLocaleString('en-IN'),
      createdAt: new Date().toISOString()
    };
    setTransactions((prev) => sortChronologicalNewestFirst([wheelTx, ...prev]));
    persistTransaction(wheelTx);

    const ntf: NotificationItem = {
      id: `NTF-${Date.now()}`,
      userId: user?.id || 'anonymous',
      title: `🎁 Lucky Wheel Cash Bonus (₹${rewardAmount})`,
      message: `You won ₹${rewardAmount} from the Daily Lucky Wheel!`,
      type: 'win',
      date: 'Just now',
      read: false
    };
    setNotifications((prev) => [ntf, ...prev]);
    triggerConfetti();
  };

  const handleUpdateUserSettings = async (newSettings: UserSettings) => {
    setUser((prev) => ({
      ...prev,
      settings: newSettings
    }));

    soundFx.setBgMusicEnabled(newSettings.bgMusicEnabled ?? true);
    soundFx.setSoundEffectsEnabled(newSettings.soundEffectsEnabled ?? true);
    soundFx.setHapticEnabled(newSettings.hapticEnabled ?? true);

    if (user?.id) {
      try {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, { settings: newSettings }, { merge: true });
      } catch (err) {
        console.error('Error persisting user settings to Firestore:', err);
      }
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const activeTicketsCount = tickets.filter((t) => t.status === 'active').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-0.5 animate-bounce shadow-2xl shadow-amber-500/30">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
        </div>
        <p className="mt-4 text-xs font-mono font-bold text-amber-400 tracking-widest uppercase animate-pulse">
          AUTHENTICATING WITH BETGURU...
        </p>
      </div>
    );
  }

  if (!currentUser || !user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen gold-bg-hd text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col antialiased relative overflow-x-hidden">
      
      {/* Premium HD Gold Ambient Background Lighting */}
      <div className="fixed -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/15 via-yellow-500/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed top-1/2 -left-32 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 -right-32 w-[450px] h-[450px] bg-yellow-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      {/* Top Header */}
      <Header
        balance={user.balance}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenDeposit={() => setIsDepositOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={() => setActiveTab('profile')}
        muted={isMuted}
        onToggleMute={handleToggleMute}
        user={user}
      />

      {/* Live Winners Horizontal Marquee */}
      <LiveWinnersTicker />

      {/* Main View Router */}
      <main className="flex-1">
        {isAdminMode ? (
          userHasAdminClaim || user.role === 'admin' ? (
            <AdminDashboard
              deposits={deposits}
              withdrawals={withdrawals}
              draws={draws}
              tickets={tickets}
              user={user}
              transactions={transactions}
              bannerSlides={bannerSlides}
              hasAdminClaim={userHasAdminClaim}
              onCloseAdmin={() => setIsAdminMode(false)}
              onApproveDeposit={handleAdminApproveDeposit}
              onRejectDeposit={handleAdminRejectDeposit}
              onApproveWithdrawal={handleAdminApproveWithdrawal}
              onRejectWithdrawal={handleAdminRejectWithdrawal}
              onTriggerDrawResult={async (drawId, winningNumbers) => {
                setDraws((prev) =>
                  prev.map((d) => (d.id === drawId ? { ...d, winningNumbers } : d))
                );

                const targetDraw = draws.find(d => d.id === drawId);
                const winStr = (winningNumbers || []).join('');

                // Evaluate tickets
                tickets.forEach(async (t) => {
                  if (t.drawId === drawId && t.status === 'active') {
                    const selectedStr = (t.selectedNumbers || (t as any).numbers || []).join('');
                    const isWin = selectedStr === winStr;
                    const status = isWin ? 'win' : 'loss';
                    const wonAmount = isWin ? (targetDraw?.firstPrize || 100000) : 0;

                    const updatedTicket = { ...t, status, wonAmount };
                    await persistTicket(updatedTicket);

                    if (isWin && wonAmount > 0) {
                      try {
                        const winnerDocRef = doc(db, 'users', t.userId);
                        const winnerSnap = await getDoc(winnerDocRef);
                        if (winnerSnap.exists()) {
                          const wData = winnerSnap.data();
                          const currentBal = typeof wData?.balance === 'number' ? wData.balance : 0;
                          const currentWon = typeof wData?.totalWon === 'number' ? wData.totalWon : 0;
                          await setDoc(winnerDocRef, {
                            balance: currentBal + wonAmount,
                            totalWon: currentWon + wonAmount
                          }, { merge: true });
                        }
                      } catch (err) {
                        console.error('Error crediting lottery win to winner in Firestore:', err);
                      }
                    }
                  }
                });

                if (targetDraw) {
                  try {
                    await setDoc(doc(db, 'draws', drawId), {
                      ...targetDraw,
                      winningNumbers,
                      updatedAt: new Date().toISOString()
                    }, { merge: true });
                  } catch (e) {
                    console.warn('Persist draw notice:', e);
                  }
                }
              }}
              onUpdateUserBalance={(newBalance) => {
                setUser((prev) => ({ ...prev, balance: newBalance }));
                if (user?.id) persistUserBalance(user.id, newBalance);
              }}
              onUpdateUserBonusBalance={(newBonus) => {
                setUser((prev) => ({ ...prev, bonusBalance: newBonus }));
                if (user?.id) persistUserBalance(user.id, user.balance, newBonus);
              }}
              onToggleUserStatus={() => {
                setUser((prev) => ({ ...prev, status: prev.status === 'active' ? 'suspended' : 'active' }));
              }}
              onAddTransaction={(tx) => {
                setTransactions((prev) => [tx, ...prev]);
                persistTransaction(tx);
              }}
            />
          ) : (
            <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900 border-2 border-rose-500/40 rounded-3xl text-center space-y-4 shadow-2xl">
              <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
              <h2 className="text-xl font-black text-white font-mono uppercase">ACCESS DENIED - CUSTOM CLAIM REQUIRED</h2>
              <p className="text-xs text-slate-300 font-mono leading-relaxed">
                Server-side role verification failed. Only accounts with verified <strong>'admin'</strong> or <strong>'super_admin'</strong> Firebase Custom Claims on their Auth Token are authorized to view the admin dashboard or perform sensitive approvals.
              </p>
              <button
                onClick={() => setIsAdminMode(false)}
                className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl font-mono transition-all shadow-lg cursor-pointer"
              >
                RETURN TO APP
              </button>
            </div>
          )
        ) : (
          <>
            {activeTab === 'home' && (
              <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5 pb-28">
                
                {/* PROMOTIONAL BANNER SLIDER (Replaces old compact dashboard card) */}
                <PromotionalSlider
                  slides={bannerSlides}
                  onAction={handleBannerSliderAction}
                />

                {/* LIVE CASINO SHOWCASE HUB (HD Graphic Banners) */}
                <div className="p-3 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-950 to-amber-950/30 border border-amber-500/30 shadow-2xl space-y-3.5 font-mono relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <span>LIVE CASINO ARENA</span>
                          <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                            REAL-TIME
                          </span>
                        </h3>
                        <p className="text-[10px] text-amber-300/80">Play HD Live Dealer Games with Instant Real-Time Payouts</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-0.5">
                    {/* Dragon Tiger HD Visual Banner Card */}
                    <div 
                      onClick={() => {
                        soundFx.playClick();
                        setIsDragonTigerOpen(true);
                      }}
                      className="group relative rounded-2xl border border-red-500/40 hover:border-red-400 bg-slate-950 shadow-xl hover:shadow-red-500/20 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden flex flex-col justify-between min-h-[160px] sm:min-h-[180px]"
                    >
                      {/* HD Background Image */}
                      <img 
                        src={dragonTigerBannerImg} 
                        alt="Dragon Tiger Live Casino" 
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 group-hover:brightness-110 transition-all duration-700 ease-out"
                      />
                      {/* Vignette Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/30 pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-r from-red-950/60 via-transparent to-black/40 pointer-events-none" />

                      {/* Top Badges */}
                      <div className="relative z-10 p-3 flex items-start justify-between">
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-red-500/40 shadow-md">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">LIVE HD</span>
                        </div>
                        <span className="px-2 py-0.5 bg-red-600/80 text-white backdrop-blur-md border border-red-400/50 rounded-lg text-[9px] font-black shadow-md">
                          2.0X & 9X TIE
                        </span>
                      </div>

                      {/* Bottom Banner Info & CTA */}
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                        <div className="flex items-end justify-between">
                          <div>
                            <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                              Dragon Tiger
                            </h4>
                            <p className="text-[10px] text-red-300 font-semibold drop-shadow">Min Bet: ₹10 • Instant Payout</p>
                          </div>
                          <div className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-black rounded-xl border border-red-400/60 shadow-lg flex items-center gap-1 group-hover:shadow-red-500/50 group-hover:scale-105 transition-all">
                            <span>PLAY</span>
                            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Andar Bahar HD Visual Banner Card */}
                    <div 
                      onClick={() => {
                        soundFx.playClick();
                        setIsAndarBaharOpen(true);
                      }}
                      className="group relative rounded-2xl border border-emerald-500/40 hover:border-emerald-400 bg-slate-950 shadow-xl hover:shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden flex flex-col justify-between min-h-[160px] sm:min-h-[180px]"
                    >
                      {/* HD Background Image */}
                      <img 
                        src={andarBaharBannerImg} 
                        alt="Andar Bahar Live Casino" 
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 group-hover:brightness-110 transition-all duration-700 ease-out"
                      />
                      {/* Vignette Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/30 pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/60 via-transparent to-black/40 pointer-events-none" />

                      {/* Top Badges */}
                      <div className="relative z-10 p-3 flex items-start justify-between">
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-emerald-500/40 shadow-md">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">FAIR RNG</span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-600/80 text-white backdrop-blur-md border border-emerald-400/50 rounded-lg text-[9px] font-black shadow-md">
                          2.0X PAYOUT
                        </span>
                      </div>

                      {/* Bottom Banner Info & CTA */}
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                        <div className="flex items-end justify-between">
                          <div>
                            <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                              Andar Bahar
                            </h4>
                            <p className="text-[10px] text-emerald-300 font-semibold drop-shadow">Min Bet: ₹10 • Joker Match</p>
                          </div>
                          <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black rounded-xl border border-emerald-400/60 shadow-lg flex items-center gap-1 group-hover:shadow-emerald-500/50 group-hover:scale-105 transition-all">
                            <span>PLAY</span>
                            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Hindi Lightning Roulette HD Visual Banner Card */}
                    <div 
                      onClick={() => {
                        soundFx.playClick();
                        setIsLiveRouletteOpen(true);
                      }}
                      className="group relative rounded-2xl border border-amber-500/40 hover:border-amber-400 bg-slate-950 shadow-xl hover:shadow-amber-500/20 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden flex flex-col justify-between min-h-[160px] sm:min-h-[180px]"
                    >
                      {/* HD Background Image */}
                      <img 
                        src={rouletteBannerImg} 
                        alt="Hindi Lightning Roulette Live Casino" 
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-108 group-hover:brightness-110 transition-all duration-700 ease-out"
                      />
                      {/* Vignette Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/30 pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-950/60 via-transparent to-black/40 pointer-events-none" />

                      {/* Top Badges */}
                      <div className="relative z-10 p-3 flex items-start justify-between">
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-amber-500/40 shadow-md">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">HINDI LIVE</span>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 backdrop-blur-md border border-amber-400 rounded-lg text-[9px] font-black shadow-md flex items-center gap-1">
                          <span>⚡</span> 500X MULTIPLIERS
                        </span>
                      </div>

                      {/* Bottom Banner Info & CTA */}
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                        <div className="flex items-end justify-between">
                          <div>
                            <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-1.5">
                              <span>⚡</span> Hindi Lightning Roulette
                            </h4>
                            <p className="text-[10px] text-amber-300 font-semibold drop-shadow">Live Hindi Dealer • Min Bet: ₹10 • 500x Win</p>
                          </div>
                          <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[11px] font-black rounded-xl border border-amber-300 shadow-lg flex items-center gap-1 group-hover:shadow-amber-500/50 group-hover:scale-105 transition-all">
                            <span>PLAY</span>
                            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Three Super Car Draw Live Section */}
                {isSuperCarEnabled && (
                  <SuperCarDrawSection
                    userBalance={user.balance}
                    userBonusBalance={user.bonusBalance || 0}
                    bonusRules={bonusRules}
                    config={supercarConfig}
                    currentIssue={supercarCurrentIssue}
                    userTickets={tickets.filter((t) => t.category === 'Three Super Car Draw')}
                    pastDraws={supercarPastDraws}
                    onConfirmBuyTicket={handleConfirmSuperCarTicketBuy}
                    onDrawResolved={handleSuperCarDrawResolved}
                  />
                )}

                {/* Single Combined Compact Lottery Section */}
                <LotterySection
                  draws={draws}
                  results={lotteryResults}
                  onViewResults={() => setActiveTab('results')}
                  onBuyTicket={(selectedDraw) => setBuyTicketDraw(selectedDraw)}
                />

              </div>
            )}

            {activeTab === 'lottery' && (
              <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-6 pb-28">
                <PromotionalSlider slides={bannerSlides} category="lottery" onAction={handleBannerSliderAction} />
                {isSuperCarEnabled && (
                  <SuperCarDrawSection
                    userBalance={user.balance}
                    userBonusBalance={user.bonusBalance || 0}
                    bonusRules={bonusRules}
                    config={supercarConfig}
                    currentIssue={supercarCurrentIssue}
                    userTickets={tickets.filter((t) => t.category === 'Three Super Car Draw')}
                    pastDraws={supercarPastDraws}
                    onConfirmBuyTicket={handleConfirmSuperCarTicketBuy}
                    onDrawResolved={handleSuperCarDrawResolved}
                  />
                )}
                <LotterySection
                  draws={draws}
                  results={lotteryResults}
                  onViewResults={() => setActiveTab('results')}
                  onBuyTicket={(selectedDraw) => setBuyTicketDraw(selectedDraw)}
                />
              </div>
            )}

            {activeTab === 'withdrawal' && (
              <WithdrawalSection
                user={user}
                draws={draws}
                onSubmitWithdrawal={handleWithdrawSubmit}
              />
            )}

            {activeTab === 'tickets' && (
              <MyTicketsView
                tickets={tickets}
                onOpenBuyTicket={() => {
                  setActiveTab('home');
                  setBuyTicketDraw(draws[0]);
                }}
              />
            )}

            {activeTab === 'results' && (
              <ResultsView
                draws={draws}
                lotteryResults={lotteryResults}
                supercarPastDraws={supercarPastDraws}
                supercarConfig={supercarConfig}
                onOpenBuyTicket={(d) => setBuyTicketDraw(d)}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                user={user}
                deposits={deposits}
                withdrawals={withdrawals}
                tickets={tickets}
                transactions={transactions}
                onOpenDeposit={() => setIsDepositOpen(true)}
                onOpenWithdraw={() => setActiveTab('withdrawal')}
                onLogout={handleLogout}
                onClaimVipBonus={handleClaimVipBonus}
                onOpenAdmin={() => setIsAdminMode(true)}
                onUpdateSettings={handleUpdateUserSettings}
                onOpenSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                user={user}
                onUpdateSettings={handleUpdateUserSettings}
                onBack={() => setActiveTab('profile')}
              />
            )}
          </>
        )}
      </main>

      {/* Fixed Responsive Bottom Navigation */}
      <BottomNav
        activeTab={activeTab === 'settings' ? 'profile' : activeTab}
        onSelectTab={(tab) => {
          setIsAdminMode(false);
          if (tab === 'lucky_wheel') {
            setIsLuckyWheelOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        activeTicketsCount={activeTicketsCount}
        onOpenRoulette={() => setIsLiveRouletteOpen(true)}
        onOpenAndarBahar={() => setIsAndarBaharOpen(true)}
        onOpenDragonTiger={() => setIsDragonTigerOpen(true)}
      />

      {/* FULLSCREEN IMMERSIVE LIVE DRAGON TIGER CASINO MODULE */}
      {isDragonTigerOpen && (
        <DragonTigerGame
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            setTransactions((prev) => [tx, ...prev]);
            persistTransaction(tx);
          }}
          onClose={() => setIsDragonTigerOpen(false)}
          onOpenDeposit={() => {
            setIsDragonTigerOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* FULLSCREEN IMMERSIVE LIVE ROULETTE CASINO MODULE */}
      {isLiveRouletteOpen && (
        <LiveRoulette
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            setTransactions((prev) => [tx, ...prev]);
            persistTransaction(tx);
          }}
          onClose={() => setIsLiveRouletteOpen(false)}
          onOpenDeposit={() => {
            setIsLiveRouletteOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* FULLSCREEN IMMERSIVE LIVE ANDAR BAHAR CASINO MODULE */}
      {isAndarBaharOpen && (
        <AndarBaharGame
          user={user}
          onUpdateBalance={(newBalance) => {
            setUser((prev) => {
              const updated = { ...prev, balance: newBalance };
              if (prev?.id) persistUserBalance(prev.id, newBalance, prev.bonusBalance, prev.email);
              return updated;
            });
          }}
          onAddTransaction={(tx) => {
            setTransactions((prev) => [tx, ...prev]);
            persistTransaction(tx);
          }}
          onClose={() => setIsAndarBaharOpen(false)}
          onOpenDeposit={() => {
            setIsAndarBaharOpen(false);
            setIsDepositOpen(true);
          }}
        />
      )}

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        onSubmitDeposit={handleDepositSubmit}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        userBalance={user.balance}
        userVipLevel={user.vipLevel}
        onSubmitWithdrawal={handleWithdrawSubmit}
      />

      {/* Ticket Purchasing Drawer */}
      <TicketBuyModal
        draw={buyTicketDraw}
        userBalance={user.balance}
        userBonusBalance={user.bonusBalance || 0}
        bonusRules={bonusRules}
        onClose={() => setBuyTicketDraw(null)}
        onConfirmPurchase={handleConfirmTicketBuy}
      />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onClearAll={() => {
          setNotifications([]);
        }}
        onRemoveNotification={(id) => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }}
      />

      {/* Daily Lucky Wheel Modal */}
      <LuckyWheelModal
        isOpen={isLuckyWheelOpen}
        onClose={() => setIsLuckyWheelOpen(false)}
        onClaimReward={handleClaimWheelReward}
        userSpinCredits={user.spinCredits || 0}
        onOpenDeposit={() => setIsDepositOpen(true)}
      />



    </div>
  );
}
