import React, { useState } from 'react';
import { Building2, Wallet, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Crown, Trophy, Sparkles } from 'lucide-react';
import { LotteryDraw, User } from '../types';
import { VIP_TIERS } from '../utils/vip';
import { soundFx } from '../utils/audio';

interface WithdrawalSectionProps {
  user: User;
  draws: LotteryDraw[];
  onSubmitWithdrawal: (amount: number, fullName: string, accountNumber: string, ifscCode: string, upiId: string) => void;
}

export const WithdrawalSection: React.FC<WithdrawalSectionProps> = ({
  user,
  draws,
  onSubmitWithdrawal
}) => {
  // Selected lottery or wallet ID. Default is 'main-wallet'
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('main-wallet');
  const [amount, setAmount] = useState<string>('500');
  const [fullName, setFullName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const vipTier = VIP_TIERS[user.vipLevel || 'Bronze'] || VIP_TIERS['Bronze'];

  // Identify selected item details
  const selectedLottery = draws.find(d => d.id === selectedLotteryId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt < 300) {
      setErrorMsg('Minimum withdrawal amount is ₹300.');
      return;
    }

    if (parsedAmt > vipTier.dailyWithdrawalLimit) {
      setErrorMsg(`Withdrawal exceeds your ${user.vipLevel || 'Bronze'} VIP daily limit of ₹${vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')}. Upgrade VIP status to unlock higher limits!`);
      return;
    }

    if (parsedAmt > user.balance) {
      setErrorMsg(`Insufficient wallet balance. Available: ₹${user.balance.toLocaleString('en-IN')}`);
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMsg('Please enter your full bank account holder name.');
      return;
    }

    if (!accountNumber.trim() || accountNumber.length < 8) {
      setErrorMsg('Please enter a valid Bank Account Number.');
      return;
    }

    if (!ifscCode.trim() || ifscCode.length < 4) {
      setErrorMsg('Please enter a valid Bank IFSC Code (e.g. SBIN0001234).');
      return;
    }

    if (!upiId.trim() || !upiId.includes('@')) {
      setErrorMsg('Please enter a valid UPI ID (e.g. name@upi).');
      return;
    }

    soundFx.playCoin();
    onSubmitWithdrawal(parsedAmt, fullName, accountNumber, ifscCode, upiId);
    setShowSuccess(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-5 pb-28 font-sans">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-amber-500/30 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0">
            <Building2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">WITHDRAWAL</h1>
            <p className="text-[11px] text-emerald-400 font-medium">
              Direct Instant Bank Payouts & UPI Transfer
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block uppercase font-mono">Available Wallet</span>
          <span className="text-sm sm:text-base font-black text-amber-300 font-mono">
            ₹{user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* STEP 1: SELECTABLE LOTTERY CARDS / CHIPS */}
      <div className="space-y-2">
        <label className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Select Lottery / Wallet for Payout:</span>
        </label>

        {/* Small Selectable Cards Row / Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Main Wallet Card */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setSelectedLotteryId('main-wallet');
              setShowSuccess(false);
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedLotteryId === 'main-wallet'
                ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold uppercase text-amber-400 flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                Main Balance
              </span>
              {selectedLotteryId === 'main-wallet' && (
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              )}
            </div>
            <span className="text-xs font-black text-white font-mono truncate">All Winnings Payout</span>
            <span className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
              ₹{user.balance.toLocaleString('en-IN')}
            </span>
          </button>

          {/* Lottery Specific Cards */}
          {draws.map((d) => {
            const isSelected = selectedLotteryId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setSelectedLotteryId(d.id);
                  setShowSuccess(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-amber-300 uppercase truncate">
                    {d.category}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </div>
                <span className="text-xs font-black text-white font-mono truncate">{d.title}</span>
                <span className="text-[10px] text-slate-400 font-mono mt-1">
                  1st Prize: <strong className="text-amber-300">₹{d.firstPrize.toLocaleString('en-IN')}</strong>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: DYNAMICALLY LOADED SELECTED FORM ONLY */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
        {showSuccess ? (
          <div className="p-6 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white font-mono mb-1">Withdrawal Request Logged!</h3>
            <p className="text-emerald-300 font-medium text-xs leading-relaxed max-w-md bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 mb-4">
              Withdrawal for <span className="font-extrabold text-white">₹{amount}</span> ({selectedLottery ? selectedLottery.title : 'Main Wallet'}) has been sent to Admin for approval.
            </p>

            <div className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2 font-mono text-slate-300 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-400">Source:</span>
                <span className="font-bold text-amber-400">{selectedLottery ? selectedLottery.title : 'Main Wallet'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Holder:</span>
                <span className="font-bold text-white">{fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bank Account:</span>
                <span className="font-bold text-amber-400">•••• {accountNumber.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UPI ID:</span>
                <span className="font-bold text-cyan-400">{upiId}</span>
              </div>
            </div>

            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl shadow-lg hover:from-emerald-400 transition-all cursor-pointer text-xs"
            >
              Submit Another Request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Context Badge for Selected Lottery */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  Selected: <strong className="text-amber-300">{selectedLottery ? selectedLottery.title : 'Main Wallet Balance'}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>{user.vipLevel || 'Bronze'} VIP</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Amount Selection */}
            <div>
              <label className="text-xs font-mono font-bold text-slate-300 mb-1.5 block">
                Withdrawal Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-amber-400 text-base">
                  ₹
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="300"
                  min="300"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-8 pr-4 py-2.5 text-base font-black text-amber-300 font-mono outline-none"
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex items-center gap-2 mt-2">
                {['300', '500', '1000', '5000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className="flex-1 py-1 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-lg text-xs font-mono font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    +₹{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount(user.balance.toString())}
                  className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-mono font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Bank Details Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-mono font-bold text-slate-300 mb-1 block">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-slate-300 mb-1 block">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 987654321012"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono font-medium text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-slate-300 mb-1 block">
                  Bank IFSC Code
                </label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono font-medium text-white outline-none uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-slate-300 mb-1 block">
                  UPI ID (PhonePe / GPay)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. rahul@ybl"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono font-medium text-white outline-none"
                />
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl font-mono shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>CONFIRM WITHDRAWAL REQUEST</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        )}
      </div>

    </div>
  );
};
