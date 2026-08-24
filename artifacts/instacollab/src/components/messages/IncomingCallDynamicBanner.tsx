import { Phone, PhoneOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatCallKind } from '../../lib/chat/chatCallKit';
import {
  CallBrand,
  CallInfoCard,
  CallRingingAvatar,
  CallRingingWave,
  CreatorIdentity,
  EncryptionPill,
  SecondaryCallActions,
} from './CallApprovedChrome';
import './call-approved-ui.css';

type IncomingCallDynamicBannerProps = {
  callKind: ChatCallKind;
  callerName: string;
  callerAvatarUrl?: string;
  subtitle: string;
  callerMetric?: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onMessage?: () => void;
  onRemind?: () => void;
};

export function IncomingCallDynamicBanner({
  callKind,
  callerName,
  callerAvatarUrl,
  subtitle,
  callerMetric,
  onAccept,
  onDecline,
  onMessage,
  onRemind,
}: IncomingCallDynamicBannerProps) {
  const label = callKind === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call';

  return (
    <motion.div
      className="call-approved-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${label} from ${callerName}`}
      data-ui-id="call.incoming.v1"
    >
      <div className="call-approved-mobile-shell call-approved-incoming-body">
        <CallBrand callLabel={label} />

        <CallRingingAvatar avatarUrl={callerAvatarUrl} alt={callerName} ringing />
        <CreatorIdentity name={callerName} verified metric={callerMetric} large />
        <CallRingingWave />
        <span className="rounded-full border border-violet-400/45 px-4 py-1.5 text-sm text-violet-200">
          ☆ Popular Creator
        </span>

        <CallInfoCard icon={<span aria-hidden>🎧</span>}>
          <div>
            <strong>{callerName} is calling you.</strong>
            <div className="mt-1 text-sm text-white/65">{subtitle || 'Join the conversation.'}</div>
          </div>
        </CallInfoCard>

        <SecondaryCallActions
          onMessage={onMessage || (() => window.dispatchEvent(new CustomEvent('unilive-call-message-request')))}
          onRemind={onRemind || (() => window.dispatchEvent(new CustomEvent('unilive-call-reminder-request')))}
        />

        <div className="call-approved-primary-pair">
          <button type="button" className="call-approved-primary-action" onClick={onDecline} data-ui-id="call.incoming.decline">
            <span className="circle red"><PhoneOff className="h-8 w-8" /></span>
            <strong>Decline</strong>
            <span className="text-white/45">Swipe down</span>
          </button>
          <button type="button" className="call-approved-primary-action" onClick={onAccept} data-ui-id="call.incoming.accept">
            <span className="circle green"><Phone className="h-8 w-8" /></span>
            <strong>Accept</strong>
            <span className="text-white/45">Swipe up</span>
          </button>
        </div>

        <EncryptionPill />
      </div>
    </motion.div>
  );
}
