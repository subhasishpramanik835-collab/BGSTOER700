import React, { useState } from 'react';
import { X, CheckCircle2, Building2, AlertCircle, ShieldCheck, ArrowRight, Wallet, Crown } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { VIP_TIERS } from '../utils/vip';
import { logAnalyticsEvent } from '../utils/analytics';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  userVipLevel?: 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum';
  onSubmitWithdrawal: (amount: number, fullName: string, accountNumber: string, ifscCode: string, upiId: string) => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  userVipLevel = 'Bronze',
  onSubmitWithdrawal
}) => {
  const [amount, setAmount] = useState<string>('500');
  const [fullName, setFullName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const vipTier = VIP_TIERS[userVipLevel] || VIP_TIERS['Bronze'];

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt < 300) {
      setErrorMsg('Minimum withdrawal amount is ₹300.');
      return;
    }

    if (parsedAmt > vipTier.dailyWithdrawalLimit) {
      setErrorMsg(`Withdrawal exceeds your ${userVipLevel} VIP daily limit of ₹${vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')}. Upgrade VIP status to unlock higher limits!`);
      return;
    }

    if (parsedAmt > userBalance) {
      setErrorMsg(`Insufficient wallet balance. Available: ₹${userBalance.toLocaleString('en-IN')}`);
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
    logAnalyticsEvent('withdrawal_submission', {
      amount: parsedAmt,
      fullName,
      accountNumberEnd: accountNumber.slice(-4),
      upiId
    });
    onSubmitWithdrawal(parsedAmt, fullName, accountNumber, ifscCode, upiId);
    setShowSuccess(true);
  };

  const handleFinish = () => {
    setShowSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white font-mono">Request Withdrawal</h2>
              <p className="text-[11px] text-emerald-400">Direct Bank Transfer & UPI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Popup */}
        {showSuccess ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white font-mono mb-2">Withdrawal Submitted!</h3>
            <p className="text-emerald-300 font-medium text-sm leading-relaxed max-w-md bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 mb-6">
              Your withdrawal request of <span className="font-extrabold text-white">₹{amount}</span> has been logged successfully and sent to Admin for approval.
            </p>
            <div className="w-full bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-2 font-mono text-slate-300 mb-6">
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
              onClick={handleFinish}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 hover:from-emerald-400 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            
            {/* Wallet Balance Info & VIP Limit */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-300 font-medium">Available Balance:</span>
                </div>
                <span className="font-mono font-extrabold text-amber-300 text-sm">
                  ₹{userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-slate-400">VIP Tier:</span>
                  <span className={`font-black text-[10px] px-2 py-0.2 rounded border ${vipTier.badgeBg}`}>
                    {userVipLevel}
                  </span>
                </div>
                <span className="text-slate-400">
                  Daily Limit: <strong className="text-emerald-400">₹{vipTier.dailyWithdrawalLimit.toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex justify-between">
                <span>Withdrawal Amount (₹) <span className="text-rose-400">*</span></span>
                <span className="text-[10px] text-slate-400 font-normal">Min ₹300</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-amber-400">₹</span>
                <input
                  type="number"
                  min="300"
                  max={userBalance}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount to withdraw"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl pl-8 pr-4 py-2.5 outline-none transition-all"
                />
              </div>
            </div>

            {/* Mandatory Bank Fields */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">
                  Full Name (As per Bank) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name on bank account"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">
                    Account Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Bank Acc No"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs rounded-xl px-3 py-2.5 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">
                    IFSC Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs rounded-xl px-3 py-2.5 outline-none transition-all uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">
                  UPI ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. yourname@upi or mobile@paytm"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95"
            >
              <span>Confirm ₹{amount} Withdrawal</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin Verification Required • Payouts processed within 15-30 mins</span>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
