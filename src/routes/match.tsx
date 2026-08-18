import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { ArrowLeft, BarChart3, CalendarClock, ChevronRight, Gauge, Radio, Shield, Sparkles, Swords, Trophy, Users, Zap } from "lucide-react";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchMatch, fetchAllMatches, saveMatch, removeMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useNicknames, NicknamesDatalist, NICKNAMES_DATALIST_ID } from "@/lib/nicknames";
import { useMatchesRealtime, LiveBadge } from "@/lib/live";
import { NickLink } from "@/lib/profile-links";
import { BettingModule } from "@/components/BettingModule";

const searchSchema = z.object({ id: "" });
