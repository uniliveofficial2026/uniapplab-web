# FINAL FUNCTION MAP (sealed for real-device QA)

See `FUNCTION-MAP.md` for the full inventory. Summary of critical paths:

| Feature | UI | Domain | Transport | Authority | Provider |
|---|---|---|---|---|---|
| Solo Live | LiveScreen / SoloLiveView | live lifecycle | UniLiveRTC | API room + grants | LiveKit |
| PK | PkLiveOverlay / invite sheets | PK session | reliable control + RTC | API PK challenge | LiveKit |
| Gift | GiftPanel / GiftPlayOverlay | gift settlement | authoritative event lane | wallet RPC | UniLive |
| Call | Call chrome / Messages | call orchestrator | signaling + RTC | call session API | LiveKit |
| Messages | MessagesScreen | messaging | realtime | DB + RLS | Supabase |
| Games | LocalGamePlayer / greedy | game session | Socket.IO WSS | game service | Render |
| Marketplace | ShellMarketplace | commerce ledger | HTTPS API | order RPC | Supabase |

`uiUxChanged=false`. No decorative critical buttons without handlers in mapped surfaces.
