import { useState } from "react";
import LobbyScreen from "./screens/LobbyScreen";
import RoomScreen from "./screens/RoomScreen";

export default function App() {
  const [screen, setScreen] = useState("lobby"); // 'lobby' | 'room'
  const [userName, setUserName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleJoinedRoom = (name, code) => {
    setUserName(name);
    setRoomCode(code);
    setScreen("room");
  };

  const handleLeaveRoom = () => {
    setScreen("lobby");
    setRoomCode("");
  };

  if (screen === "room" && roomCode) {
    return (
      <RoomScreen
        userName={userName}
        roomCode={roomCode}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return <LobbyScreen onJoined={handleJoinedRoom} />;
}
