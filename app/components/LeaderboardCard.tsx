import Image from "next/image";
import { Crown } from "lucide-react";
import { Player } from "../types/player";

interface LeaderboardCardProps {
  player: Player & { rank: number };
}

const LeaderboardCard = ({ player }: LeaderboardCardProps) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Image
            src={player.rank === 1 && player.king_photo ? player.king_photo : player.photo}
            alt={player.name}
            width={48}
            height={48}
            className="rounded-full"
          />
          {player.rank === 1 && (
            <div className="absolute -top-2 -right-2">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
          )}
        </div>
        <div>
          <h3 className="font-semibold">{player.name}</h3>
          <p className="text-sm text-gray-500">Rating: {player.rating.toFixed(1)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-lg">{player.rank}</p>
        <p className="text-sm text-gray-500">{player.games_played} games</p>
      </div>
    </div>
  );
};

export default LeaderboardCard; 