import React, { useState } from "react";
import { Header } from "../components/Header";
import { Users, Music, Video, Zap, Mic2, MessageCircle, Send, Plus } from "lucide-react";
import Webcam from "react-webcam";
import { Link, useNavigate } from "react-router-dom";
import { SavedRoomsList } from "../components/SavedRoomsList";
import { RoomHostLabel } from "../components/RoomHostLabel";

export function Party() {
  const [activeTab, setActiveTab] = useState<"rooms" | "concerts">("rooms");
  const navigate = useNavigate();

  const rooms = [
    { id: 1, name: "K-Pop Fridays 🎶", host: "melody_star", participants: 12, max: 20, tags: ["K-Pop", "Duets"] },
    { id: 2, name: "Weekend Chill Vibes", host: "jazzmaster_p", participants: 5, max: 10, tags: ["Jazz", "Acoustic"] },
    { id: 3, name: "90s Rock Anthems", host: "rocker_01", participants: 18, max: 50, tags: ["Rock", "Classic"] },
  ];

  const concerts = [
    { id: 1, artist: "The Midnight Singers", date: "Tonight, 8:00 PM", tickets: "500+", cover: "https://images.unsplash.com/photo-1540039155732-68c8c08bca07?w=500" },
    { id: 2, artist: "Pop Diva Exclusive", date: "Tomorrow, 9:00 PM", tickets: "1.2k+", cover: "https://images.unsplash.com/photo-1493225457124-a1a2a5f56468?w=500" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 text-gray-100 overflow-y-auto pb-20 scrollbar-hide">
      <Header title="Party & VR" />
      
      <div className="p-4 space-y-6">
        <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800 relative z-10">
            <button 
              onClick={() => setActiveTab('rooms')} 
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex justify-center items-center space-x-1 ${activeTab === 'rooms' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              <Users size={14} className={activeTab === 'rooms' ? "text-purple-200" : ""} /><span>Karaoke Rooms</span>
            </button>
            <button 
              onClick={() => setActiveTab('concerts')} 
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex justify-center items-center space-x-1 ${activeTab === 'concerts' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              <Zap size={14} className={activeTab === 'concerts' ? "text-blue-200" : ""} /><span>Live Concerts</span>
            </button>
        </div>

        {activeTab === 'rooms' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-3xl p-5 relative overflow-hidden shadow-2xl border border-purple-500/30">
               <div className="absolute top-0 right-0 p-4 opacity-50"><Mic2 size={64}/></div>
               <h3 className="font-bold text-xl mb-1 flex items-center space-x-2 relative z-10"><span>Create a Room</span></h3>
               <p className="text-xs text-purple-200 mb-4 max-w-[200px] relative z-10">Host a private or public karaoke session with friends and fans.</p>
               <button 
                 onClick={() => navigate('/room/create')}
                 className="bg-white text-purple-900 font-bold text-xs px-5 py-2 rounded-full flex items-center space-x-2 relative z-10 shadow-lg hover:bg-gray-100 transition"
               >
                  <Plus size={16} /> <span>Start Room</span>
               </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-widest pl-1">Saved Rooms</h3>
              <SavedRoomsList
                variant="party"
                onOpenRoom={(roomId) => navigate(`/room/${roomId}`)}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-widest pl-1">Active Rooms</h3>
              <div className="grid grid-cols-1 gap-3">
                {rooms.map((room) => (
                  <Link to={`/room/${room.id}`} key={room.id} className="bg-gray-900 border border-gray-800 p-4 rounded-3xl flex justify-between items-center hover:bg-gray-800 transition cursor-pointer block">
                    <div>
                      <h4 className="font-bold text-white mb-1 text-sm">{room.name}</h4>
                      <p className="text-[10px] text-gray-500 flex items-center space-x-1 mb-2">
                        <RoomHostLabel
                          roomId={String(room.id)}
                          storedHostName={room.host}
                          className="font-medium text-gray-300"
                        />
                        <span>•</span>
                        <Users size={10} className="inline mr-0.5" /> {room.participants}/{room.max}
                      </p>
                      <div className="flex space-x-1">
                        {room.tags.map(tag => (
                          <span key={tag} className="text-[9px] bg-gray-800 text-purple-400 px-2 py-0.5 rounded-full border border-gray-700">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <button className="h-8 w-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center hover:bg-purple-600 hover:text-white transition shrink-0">
                       <Zap size={14} />
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'concerts' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <h3 className="text-sm font-bold text-gray-400 mb-1 uppercase tracking-widest pl-1">Virtual Concerts</h3>
            <p className="text-xs text-gray-500 mb-4 pl-1">Immersive VR-ready live performances.</p>

            <div className="space-y-4">
              {concerts.map((concert) => (
                <div key={concert.id} className="relative rounded-3xl overflow-hidden group">
                   <img src={concert.cover} className="w-full h-48 object-cover group-hover:scale-105 transition duration-500" alt="concert" />
                   <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent"></div>
                   <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded flex items-center space-x-1">
                      <Video size={12} /><span>VR Ready</span>
                   </div>
                   <div className="absolute bottom-4 left-4 right-4">
                      <h4 className="font-black text-2xl mb-1 text-white">{concert.artist}</h4>
                      <div className="flex justify-between items-end">
                         <div>
                            <p className="text-xs text-gray-300 font-bold bg-black/60 backdrop-blur inline-block px-2 py-1 rounded text-blue-400 border border-blue-900/50">{concert.date}</p>
                         </div>
                         <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition">
                            Get Ticket
                         </button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
