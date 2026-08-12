import React from 'react';
import { Coins } from 'lucide-react';

type Props = {
  /** Display amount from business catalog — never computed from visual metadata. */
  amount: number | string;
  className?: string;
  showIcon?: boolean;
};

/**
 * Price chrome only. Parent supplies catalog stars/coins; this does not calculate.
 */
export function UniLivesGiftPrice({
  amount,
  className = 'flex items-center gap-0.5 rounded-full border border-white/5 bg-[#140D26]/85 px-1.5 py-0.5',
  showIcon = true,
}: Props) {
  return (
    <div className={className} data-unilives-gift-price="">
      {showIcon ? <Coins size={9} className="text-yellow-400" aria-hidden /> : null}
      <span className="font-mono text-[9px] font-bold text-white">{amount}</span>
    </div>
  );
}
