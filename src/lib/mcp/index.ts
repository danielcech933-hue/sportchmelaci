import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfileTool from "./tools/get-my-profile";
import listMatchesTool from "./tools/list-matches";
import getScoreboardTool from "./tools/get-scoreboard";
import listTournamentsTool from "./tools/list-tournaments";
import sendLobbyMessageTool from "./tools/send-lobby-message";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "game-scoreboard-hub",
  title: "Game Scoreboard Hub",
  version: "0.1.0",
  instructions:
    "Tools for the SportChmeláci sports scoreboard community. Read the player's own profile and wallet, list upcoming and finished matches, tournaments, the ELO ranking, and post to the public lobby chat. All tools act as the signed-in player.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfileTool, listMatchesTool, getScoreboardTool, listTournamentsTool, sendLobbyMessageTool],
});
