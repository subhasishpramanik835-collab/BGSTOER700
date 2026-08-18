import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Zap, RefreshCw, Save, CheckCircle2, AlertTriangle, 
  Crown, Play, Layers, RotateCcw, TrendingUp, DollarSign, Award,
  Users, Eye, Search, Filter, Flame
} from 'lucide-react';
import { DragonTigerConfig, DragonTigerRound, DragonTigerBet, DragonTigerSide, CardRank } from '../../types';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { DEFAULT_DRAGON_TIGER_CONFIG, RANKS } from '../../utils/dragonTiger';
import { soundFx } from '../../utils/audio';

export const AdminDragonTigerManager: React.FC = () => {
  const [config, setConfig] = useState<DragonTigerConfig>(() => {
    try {
      const cached = localStorage.getItem('bg_dragon_tiger_config');
      return cached ? { ...DEFAULT_DRAGON_TIGER_CONFIG, ...JSON.parse(cached) } : DEFAULT_DRAGON_TIGER_CONFIG;
    } catch {
      return DEFAULT_DRAGON_TIGER_CONFIG;
    }
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [recentRounds, setRecentRounds] = useState<DragonTigerRound[]>([]);
  const [recentBets, setRecentBets] = useState<DragonTigerBet[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'config' | 'rounds' | 'bets'>('config');

  // Listen to Firestore config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'dragon_tiger_config', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<DragonTigerConfig>;
        setConfig((prev) => ({ ...prev, ...data }));
      }
    }, (err) => console.warn('Admin Dragon Tiger config listener notice:', err.message));

    // Listen to recent rounds
    const qRounds = query(collection(db, 'dragon_tiger_rounds'), limit(30));
    const unsubRounds = onSnapshot(qRounds, (snap) => {
      const list: DragonTigerRound[] = [];
      snap.forEach((d) => list.push(d.data() as DragonTigerRound));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setRecentRounds(list);
    }, (err) => console.warn('Admin dragon tiger rounds listener notice:', err.message));

    // Listen to recent bets
    const qBets = query(collection(db, 'dragon_tiger_bets'), limit(50));
    const unsubBets = onSnapshot(qBets, (snap) => {
      const list: DragonTigerBet[] = [];
      snap.forEach((d) => list.push(d.data() as DragonTigerBet));
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecentBets(list);
    }, (err) => console.warn('Admin dragon tiger bets listener notice:', err.message));

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
      const payload: DragonTigerConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      };
      await setDoc(doc(db, 'dragon_tiger_config', 'main'), payload, { merge: true });
      localStorage.setItem('bg_dragon_tiger_config', JSON.stringify(payload));
      setSaveSuccess(true);
      soundFx.playCoin();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save Dragon Tiger config:', e);
      alert('Error saving configuration to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Analytics Calculation
  const totalVolume = recentBets.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalPayout = recentBets.reduce((acc, b) => acc + (b.wonAmount || 0), 0);
  const netHouseProfit = totalVolume - totalPayout;
  const houseMargin = totalVolume > 0 ? ((netHouseProfit / totalVolume) * 100).toFixed(1) : '6.4';

  const filteredBets = recentBets.filter((b) => 
    (b.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.roundId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.userId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* HEADER BAR */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-red-950/40 to-slate-900 border border-red-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400">
            <Flame className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-mono tracking-wider text-white">
                DRAGON TIGER CASINO CONTROLLER
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
              Live Dealer Dragon Tiger Management • Payout Multipliers & High-Roller RTP
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'config' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Game Controls
          </button>
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rounds' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Rounds ({recentRounds.length})
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bets' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Player Bets ({recentBets.length})
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">Total Turnover</span>
          <p className="text-base sm:text-xl font-black text-white">₹{totalVolume.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">Player Payouts</span>
          <p className="text-base sm:text-xl font-black text-rose-400">₹{totalPayout.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">Net House Profit</span>
          <p className={`text-base sm:text-xl font-black ${netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netHouseProfit >= 0 ? '+' : ''}₹{netHouseProfit.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase">House Edge Margin</span>
          <p className="text-base sm:text-xl font-black text-amber-400">{houseMargin}%</p>
        </div>
      </div>

      {/* TAB 1: CONFIGURATION CONTROLS */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          
          {/* Master Enable & Basic Limits */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>1. Basic Game Rules & Limits</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Game Active Switch */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Game Status</h4>
                  <p className="text-[10px] text-slate-400">Enable or disable game for all players</p>
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                    config.isEnabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Min Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Min Bet (₹)</label>
                <input
                  type="number"
                  value={config.minBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, minBet: parseInt(e.target.value, 10) || 10 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Max Bet */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Max Bet (₹)</label>
                <input
                  type="number"
                  value={config.maxBet}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxBet: parseInt(e.target.value, 10) || 50000 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              
              {/* Betting Duration */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Betting Timer (Seconds)</label>
                <input
                  type="number"
                  value={config.bettingDurationSeconds}
                  min={10}
                  max={60}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bettingDurationSeconds: parseInt(e.target.value, 10) || 15 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 font-mono">Recommended: 15s (fast action)</p>
              </div>

              {/* Dragon Multiplier */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Dragon Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.dragonMultiplier}
                  onChange={(e) => setConfig((prev) => ({ ...prev, dragonMultiplier: parseFloat(e.target.value) || 2.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 font-mono">Default: 2.0x (1:1 payout)</p>
              </div>

              {/* Tiger Multiplier */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Tiger Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={config.tigerMultiplier}
                  onChange={(e) => setConfig((prev) => ({ ...prev, tigerMultiplier: parseFloat(e.target.value) || 2.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 font-mono">Default: 2.0x (1:1 payout)</p>
              </div>

              {/* Tie Multiplier */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-white font-mono">Tie (和) Multiplier</label>
                <input
                  type="number"
                  step="0.5"
                  value={config.tieMultiplier}
                  onChange={(e) => setConfig((prev) => ({ ...prev, tieMultiplier: parseFloat(e.target.value) || 9.0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 font-mono">Default: 9.0x (8:1 payout)</p>
              </div>

            </div>
          </div>

          {/* RTP & MANUAL OVERRIDES */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-5">
            <h3 className="text-sm font-black font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>2. RTP Engine & Outcome Override</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* RTP Mode Selector */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-white font-mono">RTP Algorithm</label>
                <select
                  value={config.rtpMode}
                  onChange={(e) => setConfig((prev) => ({ ...prev, rtpMode: e.target.value as any }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="fair_rng">Fair Natural RNG (Standard)</option>
                  <option value="house_protect">House Protection (Dynamic Profit)</option>
                  <option value="manual_force_winner">Manual Forced Winner</option>
                </select>
                <p className="text-[9px] text-slate-400">
                  {config.rtpMode === 'fair_rng' && '100% Random dealer card shuffles and deal order.'}
                  {config.rtpMode === 'house_protect' && 'Automatically ensures house safety against unbalanced heavy bets.'}
                  {config.rtpMode === 'manual_force_winner' && 'Always delivers the winner chosen in manual override below.'}
                </p>
              </div>

              {/* Force Next Winner */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-white font-mono">Next Round Winner Override</label>
                <select
                  value={config.manualForceWinner || 'random'}
                  onChange={(e) => setConfig((prev) => ({ ...prev, manualForceWinner: e.target.value as any }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="random">Random (No Override)</option>
                  <option value="dragon">Force Dragon Wins</option>
                  <option value="tiger">Force Tiger Wins</option>
                  <option value="tie">Force Tie (和)</option>
                </select>
              </div>

              {/* Manual Dragon Rank */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-white font-mono">Preset Dragon Card Rank</label>
                <select
                  value={config.manualDragonRank || 'random'}
                  onChange={(e) => setConfig((prev) => ({ ...prev, manualDragonRank: e.target.value as any }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="random">Random Deal</option>
                  {RANKS.map((r) => (
                    <option key={r} value={r}>Rank {r}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Configuration saved successfully!</span>
                </div>
              )}
              <button
                disabled={saving}
                onClick={handleSaveConfig}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Dragon Tiger Settings</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: LIVE ROUNDS HISTORY */}
      {activeTab === 'rounds' && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black font-mono text-white uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-400" />
              <span>Recent Dragon Tiger Rounds</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Showing last {recentRounds.length} rounds</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Round ID</th>
                  <th className="p-3">Dragon Card</th>
                  <th className="p-3">Tiger Card</th>
                  <th className="p-3">Winner</th>
                  <th className="p-3">Total Volume</th>
                  <th className="p-3">Total Payout</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentRounds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No rounds recorded in Firestore yet.
                    </td>
                  </tr>
                ) : (
                  recentRounds.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{r.id}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-red-950 text-red-300 border border-red-800 rounded font-black">
                          {r.dragonCard ? `${r.dragonCard.rank} ${r.dragonCard.suit}` : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-black">
                          {r.tigerCard ? `${r.tigerCard.rank} ${r.tigerCard.suit}` : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          r.winningSide === 'dragon' ? 'bg-red-600 text-white' :
                          r.winningSide === 'tiger' ? 'bg-cyan-600 text-slate-950' :
                          'bg-emerald-600 text-slate-950'
                        }`}>
                          {r.winningSide || 'COMPLETED'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        ₹{((r.totalBetsDragon || 0) + (r.totalBetsTiger || 0) + (r.totalBetsTie || 0)).toLocaleString()}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">
                        ₹{(r.totalPayout || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-500 text-[10px]">
                        {new Date(r.startTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PLAYER BETS LEDGER */}
      {activeTab === 'bets' && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black font-mono text-white uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-red-400" />
              <span>Live Player Bets Ledger</span>
            </h3>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user or round..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Round</th>
                  <th className="p-3">Side</th>
                  <th className="p-3">Bet Amount</th>
                  <th className="p-3">Won Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No player bets matching search found.
                    </td>
                  </tr>
                ) : (
                  filteredBets.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <span className="font-bold text-white">{b.userName}</span>
                        {b.userPhone && <span className="block text-[9px] text-slate-500">{b.userPhone}</span>}
                      </td>
                      <td className="p-3 text-slate-400">{b.roundId}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          b.side === 'dragon' ? 'bg-red-600 text-white' :
                          b.side === 'tiger' ? 'bg-cyan-600 text-slate-950' :
                          'bg-emerald-600 text-slate-950'
                        }`}>
                          {b.side}
                        </span>
                      </td>
                      <td className="p-3 text-white font-bold">₹{b.amount.toLocaleString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">
                        {b.wonAmount ? `+₹${b.wonAmount.toLocaleString()}` : '₹0'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          b.status === 'won' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          b.status === 'tie_push' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[10px]">
                        {new Date(b.timestamp).toLocaleTimeString()}
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
