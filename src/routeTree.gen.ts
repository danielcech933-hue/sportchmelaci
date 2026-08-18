/* eslint-disable */
// @ts-nocheck
// Runtime-safe route tree fallback. TanStack will regenerate this file during build.
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AdminRouteImport } from './routes/admin'
import { Route as ArcadeRouteImport } from './routes/arcade'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as BetsRouteImport } from './routes/bets'
import { Route as BettingRouteImport } from './routes/betting'
import { Route as ChatRouteImport } from './routes/chat'
import { Route as GifStudioRouteImport } from './routes/gif-studio'
import { Route as HistoryRouteImport } from './routes/history'
import { Route as LiveRouteImport } from './routes/live'
import { Route as LiveArenaRouteImport } from './routes/live-arena'
import { Route as MatchRouteImport } from './routes/match'
import { Route as MyBetsRouteImport } from './routes/my-bets'
import { Route as PlayerCenterRouteImport } from './routes/player-center'
import { Route as RankingsRouteImport } from './routes/rankings'
import { Route as RecordsRouteImport } from './routes/records'
import { Route as ScheduleRouteImport } from './routes/schedule'
import { Route as SportCenterRouteImport } from './routes/sport-center'
import { Route as TeamsRouteImport } from './routes/teams'
import { Route as TournamentRouteImport } from './routes/tournament'
import { Route as TournamentsRouteImport } from './routes/tournaments'
import { Route as UltimateTeamRouteImport } from './routes/ultimate-team'
import { Route as VenuesRouteImport } from './routes/venues'
import { Route as LeaguesRouteImport } from './routes/leagues'
import { Route as SupportRouteImport } from './routes/support'
import { Route as SlotsRouteImport } from './routes/slots'
import { Route as SlotsIndexRouteImport } from './routes/slots.index'
import { Route as SlotsCupRouteImport } from './routes/slots.chmelovci-cup'
import { Route as SupportReturnRouteImport } from './routes/support/return'
import { Route as ProfileIndexRouteImport } from './routes/profile.index'
import { Route as ProfileIdRouteImport } from './routes/profile.$id'
import { Route as GamesRouteImport } from './routes/games.$game'
import { Route as CaseOpeningRouteImport } from './routes/games.case-opening'
import { Route as McpRouteImport } from './routes/mcp'
import { Route as SitemapRouteImport } from './routes/sitemap[.]xml'

const rootRoute = rootRouteImport
const update = (RouteImport: any, id: string, path: string, parent: any = rootRoute) => RouteImport.update({ id, path, getParentRoute: () => parent } as any)

const IndexRoute = update(IndexRouteImport, '/', '/')
const AdminRoute = update(AdminRouteImport, '/admin', '/admin')
const ArcadeRoute = update(ArcadeRouteImport, '/arcade', '/arcade')
const AuthRoute = update(AuthRouteImport, '/auth', '/auth')
const BetsRoute = update(BetsRouteImport, '/bets', '/bets')
const BettingRoute = update(BettingRouteImport, '/betting', '/betting')
const ChatRoute = update(ChatRouteImport, '/chat', '/chat')
const GifStudioRoute = update(GifStudioRouteImport, '/gif-studio', '/gif-studio')
const HistoryRoute = update(HistoryRouteImport, '/history', '/history')
const LiveRoute = update(LiveRouteImport, '/live', '/live')
const LiveArenaRoute = update(LiveArenaRouteImport, '/live-arena', '/live-arena')
const MatchRoute = update(MatchRouteImport, '/match', '/match')
const MyBetsRoute = update(MyBetsRouteImport, '/my-bets', '/my-bets')
const PlayerCenterRoute = update(PlayerCenterRouteImport, '/player-center', '/player-center')
const RankingsRoute = update(RankingsRouteImport, '/rankings', '/rankings')
const RecordsRoute = update(RecordsRouteImport, '/records', '/records')
const ScheduleRoute = update(ScheduleRouteImport, '/schedule', '/schedule')
const SportCenterRoute = update(SportCenterRouteImport, '/sport-center', '/sport-center')
const TeamsRoute = update(TeamsRouteImport, '/teams', '/teams')
const TournamentRoute = update(TournamentRouteImport, '/tournament', '/tournament')
const TournamentsRoute = update(TournamentsRouteImport, '/tournaments', '/tournaments')
const UltimateTeamRoute = update(UltimateTeamRouteImport, '/ultimate-team', '/ultimate-team')
const VenuesRoute = update(VenuesRouteImport, '/venues', '/venues')
const LeaguesRoute = update(LeaguesRouteImport, '/leagues', '/leagues')
const SupportRoute = update(SupportRouteImport, '/support', '/support')
const SlotsRoute = update(SlotsRouteImport, '/slots', '/slots')
const McpRoute = update(McpRouteImport, '/mcp', '/mcp')
const SitemapRoute = update(SitemapRouteImport, '/sitemap.xml', '/sitemap.xml')
const SlotsIndexRoute = update(SlotsIndexRouteImport, '/slots/', '/', SlotsRoute)
const SlotsCupRoute = update(SlotsCupRouteImport, '/slots/chmelovci-cup', '/chmelovci-cup', SlotsRoute)
const SupportReturnRoute = update(SupportReturnRouteImport, '/support/return', '/return', SupportRoute)
const ProfileIndexRoute = update(ProfileIndexRouteImport, '/profile/', '/profile')
const ProfileIdRoute = update(ProfileIdRouteImport, '/profile/$id', '/profile/$id')
const GamesRoute = update(GamesRouteImport, '/games/$game', '/games/$game')
const CaseOpeningRoute = update(CaseOpeningRouteImport, '/games/case-opening', '/games/case-opening')

const SlotsRouteWithChildren = SlotsRoute._addFileChildren({ SlotsIndexRoute, SlotsCupRoute })
const SupportRouteWithChildren = SupportRoute._addFileChildren({ SupportReturnRoute })

const rootRouteChildren = {
  IndexRoute, AdminRoute, ArcadeRoute, AuthRoute, BetsRoute, BettingRoute, ChatRoute,
  GifStudioRoute, HistoryRoute, LiveRoute, LiveArenaRoute, MatchRoute, MyBetsRoute,
  PlayerCenterRoute, RankingsRoute, RecordsRoute, ScheduleRoute, SportCenterRoute,
  TeamsRoute, TournamentRoute, TournamentsRoute, UltimateTeamRoute, VenuesRoute,
  LeaguesRoute, SupportRoute: SupportRouteWithChildren, SlotsRoute: SlotsRouteWithChildren,
  ProfileIndexRoute, ProfileIdRoute, GamesRoute, CaseOpeningRoute, McpRoute, SitemapRoute,
}

export const routeTree = rootRoute._addFileChildren(rootRouteChildren as any) as any
