export interface VipTierInfo {
  level: 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum';
  minPoints: number;
  maxPoints: number;
  color: string;
  bgColor: string;
  badgeBg: string;
  borderColor: string;
  dailyWithdrawalLimit: number;
  weeklyBonusAmount: number;
  perks: string[];
}

export const VIP_TIERS: Record<string, VipTierInfo> = {
  Bronze: {
    level: 'Bronze',
    minPoints: 0,
    maxPoints: 499,
    color: 'text-amber-600',
    bgColor: 'bg-amber-950/40',
    badgeBg: 'bg-amber-700/20 text-amber-500 border-amber-600/40',
    borderColor: 'border-amber-600/40',
    dailyWithdrawalLimit: 10000,
    weeklyBonusAmount: 0,
    perks: ['Standard Withdrawal Limit (₹10,000/day)', '1x VIP Points Rate', 'Standard Support']
  },
  Silver: {
    level: 'Silver',
    minPoints: 500,
    maxPoints: 1999,
    color: 'text-slate-300',
    bgColor: 'bg-slate-800/40',
    badgeBg: 'bg-slate-300/20 text-slate-200 border-slate-400/40',
    borderColor: 'border-slate-400/40',
    dailyWithdrawalLimit: 50000,
    weeklyBonusAmount: 250,
    perks: ['Enhanced Withdrawal Limit (₹50,000/day)', 'Weekly VIP Bonus ₹250', 'Silver VIP Badge', 'Priority Payouts']
  },
  Gold: {
    level: 'Gold',
    minPoints: 2000,
    maxPoints: 9999,
    color: 'text-yellow-400',
    bgColor: 'bg-amber-500/10',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50',
    borderColor: 'border-yellow-500/50',
    dailyWithdrawalLimit: 200000,
    weeklyBonusAmount: 1000,
    perks: ['High Withdrawal Limit (₹2,00,000/day)', 'Weekly VIP Bonus ₹1,000', 'Gold VIP Crown Badge', '24/7 VIP Support Line']
  },
  'VIP Platinum': {
    level: 'VIP Platinum',
    minPoints: 10000,
    maxPoints: Infinity,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/40',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
    borderColor: 'border-cyan-400/50',
    dailyWithdrawalLimit: 1000000,
    weeklyBonusAmount: 5000,
    perks: ['Unlimited Withdrawal Limit (₹10,00,000/day)', 'Weekly Mega Bonus ₹5,000', 'Platinum Crown Badge', 'Personal Account Manager', 'Custom High-Roller Limits']
  }
};

export function calculateVipLevel(points: number): 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum' {
  if (points >= 10000) return 'VIP Platinum';
  if (points >= 2000) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
}

export function getNextTierInfo(points: number): { nextTier: VipTierInfo | null; pointsNeeded: number; progressPercent: number } {
  const currentLevel = calculateVipLevel(points);
  if (currentLevel === 'VIP Platinum') {
    return { nextTier: null, pointsNeeded: 0, progressPercent: 100 };
  }

  const nextLevel = currentLevel === 'Bronze' ? 'Silver' : currentLevel === 'Silver' ? 'Gold' : 'VIP Platinum';
  const nextTier = VIP_TIERS[nextLevel];
  const currentTier = VIP_TIERS[currentLevel];

  const pointsNeeded = nextTier.minPoints - points;
  const totalRange = nextTier.minPoints - currentTier.minPoints;
  const earnedInRange = points - currentTier.minPoints;
  const progressPercent = Math.min(Math.max((earnedInRange / totalRange) * 100, 0), 100);

  return { nextTier, pointsNeeded, progressPercent };
}
