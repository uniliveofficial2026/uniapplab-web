export type ArenaLeaderboardParticipant = {
  id: string;
  name: string;
  avatar: string;
  score: number;
};

type RoomArenaLeaderboardProps = {
  participants: ArenaLeaderboardParticipant[];
  countdownText: string;
  onOpen: () => void;
};

export function RoomArenaLeaderboard({
  participants,
  countdownText,
  onOpen,
}: RoomArenaLeaderboardProps) {
  return (
    <div
      onClick={onOpen}
      className="party-arena-leaderboard w-full bg-gradient-to-b from-[#321c4e] to-[#0e041c] border border-fuchsia-500/20 rounded-2xl p-2 sm:p-2.5 shadow-md shadow-purple-950/40 relative text-center flex flex-col items-center cursor-pointer hover:border-fuchsia-500/40 transition shrink-0"
      id="room-arena-leaderboard"
    >
      <div className="w-full bg-[#1e40af] rounded-lg py-1 px-1.5 flex justify-between items-center text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
        <span>Arena</span>
        <span className="text-[9px]">↗️</span>
      </div>

      <span className="text-[9px] sm:text-[10px] font-mono text-[#a855f7] mt-1.5 truncate max-w-full px-0.5">
        {participants[0] ? participants[0].name : 'Melodia 🎙️'}
      </span>

      <span className="bg-purple-600 text-white font-extrabold text-[8px] sm:text-[9px] px-2.5 py-0.5 rounded-full mt-1.5 select-none whitespace-nowrap">
        Total Rankings
      </span>

      <span className="text-yellow-400 font-mono text-[8px] sm:text-[9px] mt-1">{countdownText}</span>

      <div className="w-full mt-2 space-y-1.5 text-left text-[9px] sm:text-[10px]">
        {participants[0] && (
          <div className="flex items-center justify-between bg-black/20 rounded-md px-1.5 py-1 gap-1">
            <div className="flex items-center space-x-1.5 min-w-0">
              <img
                src={participants[0].avatar}
                className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full object-cover shrink-0"
                alt=""
              />
              <span className="text-gray-200 truncate font-bold">{participants[0].name}</span>
            </div>
            <span className="text-amber-400 font-black shrink-0 text-[8px] sm:text-[9px]">
              🔥{participants[0].score}
            </span>
          </div>
        )}

        {participants[1] && (
          <div className="flex items-center justify-between bg-black/20 rounded-md px-1.5 py-1 gap-1">
            <div className="flex items-center space-x-1.5 min-w-0">
              <img
                src={participants[1].avatar}
                className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full object-cover shrink-0"
                alt=""
              />
              <span className="text-gray-200 truncate">{participants[1].name}</span>
            </div>
            <span className="text-amber-400 font-bold shrink-0 text-[8px] sm:text-[9px]">
              🔥{participants[1].score}
            </span>
          </div>
        )}

        {participants[2] && (
          <div className="flex items-center justify-between bg-black/10 rounded-md px-1.5 py-1 gap-1">
            <div className="flex items-center space-x-1.5 min-w-0">
              <img
                src={participants[2].avatar}
                className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full object-cover shrink-0"
                alt=""
              />
              <span className="text-gray-400 truncate">{participants[2].name}</span>
            </div>
            <span className="text-amber-400 font-bold opacity-80 shrink-0 text-[8px] sm:text-[9px]">
              🔥{participants[2].score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

type RoomArenaColumnProps = RoomArenaLeaderboardProps;

export function RoomArenaColumn(props: RoomArenaColumnProps) {
  return (
    <div
      className="party-arena-column flex flex-col justify-end items-stretch shrink-0 select-none min-h-0 self-stretch pb-1"
      id="gameday-widgets-column"
    >
      <RoomArenaLeaderboard {...props} />
    </div>
  );
}
