import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Zap, RefreshCw, Save, CheckCircle2, AlertTriangle, 
  Crown, Play, Layers, RotateCcw, TrendingUp, DollarSign, Award,
  Users, Eye, Search, Filter
} from 'lucide-react';
import { AndarBaharConfig, AndarBaharRound, AndarBaharBet, AndarBaharSide, CardRank } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { DEFAULT_ANDAR_BAHAR_CONFIG, RANKS } from '../../utils/andarBahar';
import { soundFx } from '../../utils/audio';

export const AdminAndarBaharManager: React.FC = () => {
  const [config, setConfig] = useState<AndarBaharConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_andar_bahar_config');
      return cached ? { ...DEFAULT_ANDAR_BAHAR_CONFIG, ...JSON.parse(cached) } : DEFAULT_ANDAR_BAHAR_CONFIG;
    } catch {
      return DEFAULT_ANDAR_BAHAR_CONFIG;
    }
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [recentRounds, setRecentRounds] = useState<AndarBaharRound[]>([]);
  const [recentBets, setRecentBets] = useState<AndarBaharBet[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'config' | 'rounds' | 'bets'>('config');

  // Listen to Firestore config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'andar_bahar_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AndarBaharConfig>;
        setConfig((prev) => ({ ...prev, ...data }));
      }
    }, (err) => console.warn('Admin Andar Bahar config listener notice:', err.message));

    // Listen to recent rounds
    const qRounds = query(collection(db, 'andar_bahar_rounds'), limit(30));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const list: AndarBaharRound[] = [];
      snap.forEach((d) => list.push(d.data() as AndarBaharRound));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setRecentRounds(list);
    }, (err) => console.warn('Admin rounds listener notice:', err.message));

    // Listen to recent bets
    const qBets = query(collection(db, 'andar_bahar_bets'), limit(50));
    const unsubBets = onSnapshot(qBets, (snap) => {
      const list: AndarBaharBet[] = [];
      snap.forEach((d) => list.push(d.data() as AndarBaharBet));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecentBets(list);
    }, (err) => console.warn('Admin bets listener notice:', err.message));

    return () => {
      unsub();
      unsubRounds();
      unsubBets();
    };
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload: AndarBaharConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin'
      };
      await setDoc(doc(db, 'andar_bahar_config', 'main'), payload, { merge: true });
      localStorage.setItem('bg_andar_bahar_config', JSON.stringify(payload));
      setSaveSuccess(true);
      soundFx.playCoin();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save Andar Bahar config:', e);
      alert('Error saving configuration to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Analytics Calculation
  const totalVolume = recentBets.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalPayout = recentBets.reduce((acc, b) => acc + (b.wonAmount || 0), 0);
  const netHouseProfit = totalVolume - totalPayout;
  const houseMargin = totalVolume > 0 ? ((netHouseProfit / totalVolume) * 100).toFixed(1) : '5.2';

  const filteredBets = recentBets.filter((b) => 
    (b.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.roundId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.userId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* HEADER BAR */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-mono tracking-wider text-white">
                ANDAR BAHAR CASINO CONTROLLER
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black border ${
                config.isEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {config.isEnabled ? 'LIVE ACTIVE' : 'MAINTENANCE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live RTP controls, Dealing Speed, Force Winner & Realtime Bet Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'SAVING...' : 'SAVE CONFIGURATION'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-emerald-300 font-mono text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Andar Bahar configuration synced to Firestore in real-time!</span>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">TOTAL BET VOLUME</span>
          <span className="text-lg sm:text-xl font-black font-mono text-white block mt-1">
            ₹{totalVolume.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">TOTAL PAYOUTS</span>
          <span className="text-lg sm:text-xl font-black font-mono text-rose-400 block mt-1">
            ₹{totalPayout.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">NET HOUSE PROFIT</span>
          <span className={`text-lg sm:text-xl font-black font-mono block mt-1 ${netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netHouseProfit >= 0 ? `+₹${netHouseProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(netHouseProfit).toLocaleString('en-IN')}`}
          </span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">HOUSE MARGIN</span>
          <span className="text-lg sm:text-xl font-black font-mono text-amber-400 block mt-1">
            {houseMargin}%
          </span>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 font-mono">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'config' 
              ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          SETTINGS & RTP
        </button>

        <button
          onClick={() => setActiveTab('rounds')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rounds' 
              ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          ROUND HISTORY ({recentRounds.length})
        </button>

        <button
          onClick={() => setActiveTab('bets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'bets' 
              ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' 
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          PLAYER BETS ({recentBets.length})
        </button>
      </div>

      {/* TAB 1: CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          
          {/* Panel 1: Master Controls & Timers */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
            <h3 className="text-sm font-black font-mono text-emerald-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>GAME TIMERS & LIMITS</span>
            </h3>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-xs font-bold font-mono text-white block">Game Master Toggle</span>
                <span className="text-[10px] text-slate-400 font-mono">Enable or disable Andar Bahar for users</span>
              </div>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))}
                className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${
                  config.isEnabled 
                    ? 'bg-emerald-500 text-slate-950 font-black' 
                    : 'bg-rose-500 text-white'
                }`}
              >
                {config.isEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Bet Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-300 font-bold block mb-1">
                  Min Bet Limit (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.minBet}
                  onChange={(e) => setConfig((p) => ({ ...p, minBet: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-300 font-bold block mb-1">
                  Max Bet Limit (₹)
                </label>
                <input
                  type="number"
                  min="100"
                  value={config.maxBet}
                  onChange={(e) => setConfig((p) => ({ ...p, maxBet: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Timers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-300 font-bold block mb-1">
                  Betting Timer (Seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={config.bettingDurationSeconds}
                  onChange={(e) => setConfig((p) => ({ ...p, bettingDurationSeconds: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-300 font-bold block mb-1">
                  Dealing Speed (ms/card)
                </label>
                <select
                  value={config.dealingSpeedMs}
                  onChange={(e) => setConfig((p) => ({ ...p, dealingSpeedMs: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                >
                  <option value={450}>Fast (450ms)</option>
                  <option value={650}>Normal (650ms)</option>
                  <option value={900}>Slow / Cinematic (900ms)</option>
                </select>
              </div>
            </div>

            {/* Payout Multipliers */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[11px] font-mono text-cyan-300 font-bold block mb-1">
                  Andar Multiplier (x)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  value={config.andarMultiplier}
                  onChange={(e) => setConfig((p) => ({ ...p, andarMultiplier: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-cyan-300 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-amber-300 font-bold block mb-1">
                  Bahar Multiplier (x)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  value={config.baharMultiplier}
                  onChange={(e) => setConfig((p) => ({ ...p, baharMultiplier: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

          </div>

          {/* Panel 2: RTP MODE & RESULT RIGGING / FORCE WINNER */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
            <h3 className="text-sm font-black font-mono text-amber-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>RTP MODE & OUTCOME CONTROL</span>
            </h3>

            {/* RTP Mode Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-300 font-bold block">
                Result Distribution Mode
              </label>
              
              <div className="grid grid-cols-1 gap-2">
                <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  config.rtpMode === 'fair_rng' ? 'bg-emerald-950/40 border-emerald-400 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div>
                    <span className="text-xs font-bold block font-mono">1. Fair Cryptographic RNG</span>
                    <span className="text-[10px] opacity-75">Cards dealt with 100% realistic random probability</span>
                  </div>
                  <input
                    type="radio"
                    name="rtpMode"
                    checked={config.rtpMode === 'fair_rng'}
                    onChange={() => setConfig((p) => ({ ...p, rtpMode: 'fair_rng' }))}
                    className="accent-emerald-400"
                  />
                </label>

                <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  config.rtpMode === 'house_protect' ? 'bg-amber-950/40 border-amber-400 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div>
                    <span className="text-xs font-bold block font-mono">2. Smart House Protect (Dynamic RTP)</span>
                    <span className="text-[10px] opacity-75">Auto-balances outcomes to maximize house margin against high bets</span>
                  </div>
                  <input
                    type="radio"
                    name="rtpMode"
                    checked={config.rtpMode === 'house_protect'}
                    onChange={() => setConfig((p) => ({ ...p, rtpMode: 'house_protect' }))}
                    className="accent-amber-400"
                  />
                </label>

                <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  config.rtpMode === 'manual_force_winner' ? 'bg-rose-950/40 border-rose-400 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div>
                    <span className="text-xs font-bold block font-mono">3. Manual Force Winner</span>
                    <span className="text-[10px] opacity-75">Directly force the next round winner to Andar or Bahar</span>
                  </div>
                  <input
                    type="radio"
                    name="rtpMode"
                    checked={config.rtpMode === 'manual_force_winner'}
                    onChange={() => setConfig((p) => ({ ...p, rtpMode: 'manual_force_winner' }))}
                    className="accent-rose-400"
                  />
                </label>
              </div>
            </div>

            {/* Forced Outcome Controls */}
            {config.rtpMode === 'manual_force_winner' && (
              <div className="p-3 bg-slate-950 rounded-2xl border border-rose-500/40 space-y-3 animate-in fade-in">
                <span className="text-[11px] font-mono font-bold text-rose-300 block">
                  Select Forced Winner for Next Round:
                </span>
                
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, manualForceWinner: 'andar' }))}
                    className={`py-2 rounded-xl border font-bold transition-all cursor-pointer ${
                      config.manualForceWinner === 'andar'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    FORCE ANDAR
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, manualForceWinner: 'bahar' }))}
                    className={`py-2 rounded-xl border font-bold transition-all cursor-pointer ${
                      config.manualForceWinner === 'bahar'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    FORCE BAHAR
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, manualForceWinner: 'random' }))}
                    className={`py-2 rounded-xl border font-bold transition-all cursor-pointer ${
                      config.manualForceWinner === 'random' || !config.manualForceWinner
                        ? 'bg-slate-700 text-white border-slate-600 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    RANDOM
                  </button>
                </div>
              </div>
            )}

            {/* Preset Joker Rank */}
            <div>
              <label className="text-[11px] font-mono text-slate-300 font-bold block mb-1">
                Preset Next Joker Card Rank
              </label>
              <select
                value={config.manualJokerRank || 'random'}
                onChange={(e) => setConfig((p) => ({ ...p, manualJokerRank: e.target.value as any }))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:border-emerald-400 focus:outline-none cursor-pointer"
              >
                <option value="random">Random Shuffled Card</option>
                {RANKS.map((r) => (
                  <option key={r} value={r}>Rank {r}</option>
                ))}
              </select>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: ROUND HISTORY */}
      {activeTab === 'rounds' && (
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-3xl overflow-x-auto font-mono text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <th className="pb-3">Round ID</th>
                <th className="pb-3">Joker Card</th>
                <th className="pb-3">Winner</th>
                <th className="pb-3">Total Cards Dealt</th>
                <th className="pb-3">Andar Bets</th>
                <th className="pb-3">Bahar Bets</th>
                <th className="pb-3">Date / Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentRounds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No rounds recorded yet.
                  </td>
                </tr>
              ) : (
                recentRounds.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="py-3 font-bold text-amber-300">{r.id}</td>
                    <td className="py-3">
                      <span className="font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white">
                        {r.jokerCard?.rank} {r.jokerCard?.suit}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase border ${
                        r.winningSide === 'andar' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {r.winningSide}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{r.totalCardsDealt} cards</td>
                    <td className="py-3 text-cyan-400">₹{(r.totalBetsAndar || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 text-amber-400">₹{(r.totalBetsBahar || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 text-slate-400">{new Date(r.startTime || r.createdAt).toLocaleTimeString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PLAYER BETS */}
      {activeTab === 'bets' && (
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user, round ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
            <span className="text-[11px] text-slate-400">
              Showing {filteredBets.length} of {recentBets.length} bets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                  <th className="pb-3">Player</th>
                  <th className="pb-3">Round ID</th>
                  <th className="pb-3">Bet Side</th>
                  <th className="pb-3">Bet Amount</th>
                  <th className="pb-3">Payout</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No player bets match query.
                    </td>
                  </tr>
                ) : (
                  filteredBets.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="py-3 font-bold text-white">{b.userName}</td>
                      <td className="py-3 text-slate-400">{b.roundId}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase border ${
                          b.side === 'andar' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {b.side}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-slate-200">₹{b.amount.toLocaleString('en-IN')}</td>
                      <td className={`py-3 font-black ${b.status === 'won' ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {b.status === 'won' ? `+₹${b.wonAmount}` : '₹0'}
                      </td>
                      <td className="py-3">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          b.status === 'won' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(b.timestamp).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
