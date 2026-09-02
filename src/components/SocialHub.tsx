import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Camera, ChevronLeft, ChevronRight, Heart, ImagePlus, LoaderCircle, MessageCircle, MoreHorizontal, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type SocialStory = {
  id: string;
  user_id: string;
  author_nickname: string;
  media_url: string;
  storage_path: string | null;
  caption: string | null;
  expires_at: string;
  created_at: string;
};

type SocialPost = {
  id: string;
  user_id: string;
  author_nickname: string;
  body: string;
  image_url: string | null;
  storage_path: string | null;
  match_id: string | null;
  created_at: string;
  likes: number;
  liked_by_me: boolean;
  comments?: SocialComment[];
};

type SocialComment = {
  id: string;
  post_id: string;
  user_id: string;
  author_nickname: string;
  body: string;
  created_at: string;
};

type Props = { compact?: boolean; profileUserId?: string };
type StoryGroup = { userId: string; nickname: string; stories: SocialStory[] };
type StoryViewerState = { stories: SocialStory[]; index: number };

const db = supabase as any;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const mediaPathFromUrl = (url: string | null) => {
  if (!url) return null;
  const marker = "/storage/v1/object/public/social-media/";
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
};

const formatTime = (value: string) => {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "právě teď";
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  return new Date(value).toLocaleDateString("cs-CZ");
};

export function SocialHub({ compact = false, profileUserId }: Props) {
  const { user, nickname } = useAuth();
  const [stories, setStories] = useState<SocialStory[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [storyViewer, setStoryViewer] = useState<StoryViewerState | null>(null);
  const [mediaViewer, setMediaViewer] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading((current) => current && posts.length === 0);
      const now = new Date().toISOString();
      const storyQuery = await db
        .from("social_stories")
        .select("id,user_id,author_nickname,media_url,storage_path,caption,expires_at,created_at")
        .gt("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(36);

      let postQuery = db
        .from("social_posts")
        .select("id,user_id,author_nickname,body,image_url,storage_path,match_id,created_at")
        .order("created_at", { ascending: false });

      if (profileUserId) {
        postQuery = postQuery.eq("user_id", profileUserId).limit(40);
      } else {
        postQuery = postQuery.limit(compact ? 6 : 24);
      }

      const { data: postData, error: postError } = await postQuery;
      if (postError) throw postError;
      if (storyQuery.error) throw storyQuery.error;

      const loaded = (postData ?? []) as Omit<SocialPost, "likes" | "liked_by_me" | "comments">[];
      const postIds = loaded.map((post) => post.id);

      let likesRows: Array<{ post_id: string; user_id: string }> = [];
      if (postIds.length) {
        const likesQuery = await db.from("social_post_likes").select("post_id,user_id").in("post_id", postIds);
        if (likesQuery.error) throw likesQuery.error;
        likesRows = (likesQuery.data ?? []) as Array<{ post_id: string; user_id: string }>;
      }

      const likesByPost = new Map<string, number>();
      const likedByMe = new Set<string>();
      for (const row of likesRows) {
        likesByPost.set(row.post_id, (likesByPost.get(row.post_id) ?? 0) + 1);
        if (row.user_id === user?.id) likedByMe.add(row.post_id);
      }

      const commentsByPost = new Map<string, SocialComment[]>();
      if (postIds.length) {
        const commentsQuery = await db.from("social_comments").select("id,post_id,user_id,author_nickname,body,created_at").in("post_id", postIds).order("created_at", { ascending: true });
        if (commentsQuery.error) throw commentsQuery.error;
        for (const comment of (commentsQuery.data ?? []) as SocialComment[]) {
          const list = commentsByPost.get(comment.post_id) ?? [];
          list.push(comment);
          commentsByPost.set(comment.post_id, list);
        }
      }

      const hydrated: SocialPost[] = loaded.map((post) => ({
        ...post,
        likes: likesByPost.get(post.id) ?? 0,
        liked_by_me: likedByMe.has(post.id),
        comments: commentsByPost.get(post.id) ?? [],
      }));

      setStories((storyQuery.data ?? []) as SocialStory[]);
      setPosts(hydrated);
    } catch (error) {
      console.error("Social load failed", error);
      toast.error("Sociální feed se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [profileUserId, compact, user?.id]);

  const storyGroups = useMemo<StoryGroup[]>(() => {
    const byUser = new Map<string, StoryGroup>();
    for (const story of stories) {
      const group = byUser.get(story.user_id) ?? { userId: story.user_id, nickname: story.author_nickname, stories: [] };
      group.stories.push(story);
      byUser.set(story.user_id, group);
    }
    return [...byUser.values()];
  }, [stories]);

  const meStoryGroup = useMemo(() => storyGroups.find((group) => group.userId === user?.id), [storyGroups, user?.id]);

  const uploadAsset = async (asset: File) => {
    if (!user) throw new Error("Přihlas se.");
    if (!asset.type.startsWith("image/")) throw new Error("Použij obrázek.");
    if (asset.size > MAX_IMAGE_SIZE) throw new Error("Maximální velikost je 10 MB.");
    const ext = asset.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("social-media").upload(path, asset, { upsert: false, contentType: asset.type });
    if (error) throw error;
    const mediaUrl = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
    return { path, mediaUrl };
  };

  const publishPost = async () => {
    if (!user || (!body.trim() && !file) || uploading) return;
    let uploadedPath: string | null = null;
    try {
      setUploading(true);
      if (file && (file.size > MAX_IMAGE_SIZE || !file.type.startsWith("image/"))) throw new Error("Použij obrázek do 10 MB.");
      const uploaded = file ? await uploadAsset(file) : null;
      uploadedPath = uploaded?.path ?? null;
      const { error } = await db.from("social_posts").insert({ user_id: user.id, author_nickname: nickname || "Hráč", body: body.trim(), image_url: uploaded?.mediaUrl ?? null, storage_path: uploaded?.path ?? null });
      if (error) throw error;
      setBody("");
      setFile(null);
      setComposerOpen(false);
      toast.success("Příspěvek je venku.");
      await load();
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
      toast.error(error?.message ?? "Příspěvek se nepodařilo zveřejnit.");
    } finally {
      setUploading(false);
    }
  };

  const publishStory = async (asset: File) => {
    if (!user || uploading) return;
    let uploadedPath: string | null = null;
    try {
      setUploading(true);
      const uploaded = await uploadAsset(asset);
      uploadedPath = uploaded.path;
      const { error } = await db.from("social_stories").insert({ user_id: user.id, author_nickname: nickname || "Hráč", media_url: uploaded.mediaUrl, storage_path: uploaded.path, caption: "", expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
      if (error) throw error;
      toast.success("Story přidána na 24 hodin.");
      await load();
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
      toast.error(error?.message ?? "Story se nepodařilo nahrát.");
    } finally {
      setUploading(false);
    }
  };

  const addComment = async (postId: string) => {
    const text = commentDraft.trim();
    if (!user || !text) return;
    const { error } = await db.from("social_comments").insert({ post_id: postId, user_id: user.id, author_nickname: nickname || "Hráč", body: text });
    if (error) {
      toast.error("Komentář se nepodařilo přidat.");
      return;
    }
    setCommentDraft("");
    setCommenting(null);
    toast.success("Komentář přidán.");
    await load();
  };

  const toggleLike = async (post: SocialPost) => {
    if (!user) {
      toast.error("Pro označení To se mi líbí se přihlas.");
      return;
    }
    const nextLiked = !post.liked_by_me;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked_by_me: nextLiked, likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)) } : item));
    const result = nextLiked
      ? await db.from("social_post_likes").insert({ post_id: post.id, user_id: user.id })
      : await db.from("social_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    if (result.error) {
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked_by_me: post.liked_by_me, likes: post.likes } : item));
      toast.error("To se mi líbí se nepodařilo uložit.");
    }
  };

  const deletePost = async (post: SocialPost) => {
    if (!user || post.user_id !== user.id) return;
    if (!window.confirm("Smazat tento příspěvek?")) return;
    const { error } = await db.from("social_posts").delete().eq("id", post.id).eq("user_id", user.id);
    if (error) {
      toast.error("Příspěvek se nepodařilo smazat.");
      return;
    }
    const path = post.storage_path || mediaPathFromUrl(post.image_url);
    if (path) await supabase.storage.from("social-media").remove([path]);
    setPosts((current) => current.filter((item) => item.id !== post.id));
    toast.success("Příspěvek smazán.");
  };

  const deleteComment = async (comment: SocialComment) => {
    if (!user || comment.user_id !== user.id) return;
    const { error } = await db.from("social_comments").delete().eq("id", comment.id).eq("user_id", user.id);
    if (error) {
      toast.error("Komentář se nepodařilo smazat.");
      return;
    }
    setPosts((current) => current.map((post) => post.id === comment.post_id ? { ...post, comments: post.comments?.filter((item) => item.id !== comment.id) } : post));
  };

  const deleteStory = async (story: SocialStory) => {
    if (!user || story.user_id !== user.id) return;
    const { error } = await db.from("social_stories").delete().eq("id", story.id).eq("user_id", user.id);
    if (error) {
      toast.error("Story se nepodařilo smazat.");
      return;
    }
    const path = story.storage_path || mediaPathFromUrl(story.media_url);
    if (path) await supabase.storage.from("social-media").remove([path]);
    setStories((current) => current.filter((item) => item.id !== story.id));
    setStoryViewer(null);
    toast.success("Story smazána.");
  };

  return <section className={compact ? "space-y-3" : "space-y-5"}>
    {!profileUserId && <StoriesStrip groups={storyGroups} meGroup={meStoryGroup} user={Boolean(user)} disabled={uploading} onPick={(group) => setStoryViewer({ stories: group.stories, index: 0 })} onAdd={publishStory} />}

    {!profileUserId && <div className="aaa-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="aaa-meta text-amber-200/70">SOCIAL FEED</div><h2 className="mt-1 font-display text-2xl tracking-[.12em] text-white">CO SE DĚJE NA CHMELOVCÍCH</h2></div>{user && <button type="button" onClick={() => setComposerOpen((value) => !value)} className="aaa-cta inline-flex min-h-10 items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.15em]"><Plus className="h-4 w-4" /> {composerOpen ? "Zavřít" : "Přidat příspěvek"}</button>}</div>
      {composerOpen && <PostComposer body={body} setBody={setBody} file={file} setFile={setFile} onPublish={publishPost} uploading={uploading} />}
    </div>}

    <div className={compact ? "space-y-3" : "mx-auto max-w-3xl space-y-4"}>
      {loading && <div className="aaa-card p-8 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-amber-200/60" /><p className="mt-3 text-sm text-white/35">Načítám momenty…</p></div>}
      {!loading && posts.map((post) => <PostCard key={post.id} post={post} currentUserId={user?.id} canComment={Boolean(user)} commenting={commenting === post.id} setCommenting={setCommenting} commentDraft={commentDraft} setCommentDraft={setCommentDraft} onComment={() => void addComment(post.id)} onLike={() => void toggleLike(post)} onDelete={() => void deletePost(post)} onDeleteComment={(comment) => void deleteComment(comment)} onOpenImage={setMediaViewer} />)}
      {!loading && !posts.length && <div className="aaa-card p-8 text-center"><Sparkles className="mx-auto h-7 w-7 text-amber-200/70" /><p className="mt-3 text-sm text-white/45">{profileUserId ? "Tenhle hráč zatím nemá žádné příspěvky." : "Feed je zatím prázdný. Přidej první moment ze zápasu."}</p></div>}
    </div>

    {storyViewer && <StoryViewer viewer={storyViewer} canDelete={Boolean(user)} currentUserId={user?.id} onClose={() => setStoryViewer(null)} onChange={(index) => setStoryViewer((current) => current ? { ...current, index } : current)} onDelete={(story) => void deleteStory(story)} />}
    {mediaViewer && <div className="fixed inset-0 z-[95] grid place-items-center bg-black/92 p-3 backdrop-blur-sm" onClick={() => setMediaViewer(null)}><div className="relative flex max-h-[92vh] w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}><img src={mediaViewer} alt="Fotka z feedu" className="max-h-[92vh] max-w-full rounded-2xl object-contain" /><button type="button" onClick={() => setMediaViewer(null)} className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white" aria-label="Zavřít fotku"><X className="h-5 w-5" /></button></div></div>}
  </section>;
}

function StoriesStrip({ groups, meGroup, user, disabled, onPick, onAdd }: { groups: StoryGroup[]; meGroup?: StoryGroup; user: boolean; disabled: boolean; onPick: (group: StoryGroup) => void; onAdd: (file: File) => void }) {
  const visibleGroups = meGroup ? [meGroup, ...groups.filter((group) => group.userId !== meGroup.userId)] : groups;
  return <div className="aaa-card overflow-hidden p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><div className="aaa-meta text-cyan-200/70">MOMENTS · 24 H</div><h2 className="mt-1 font-display text-2xl tracking-[.12em] text-white">STORIES</h2></div><span className="aaa-meta">ZÁPASY · LIDI · MOMENTKY</span></div>
    <div className="mt-4 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
      {user && <label className="w-20 shrink-0 cursor-pointer text-center"><div className="relative mx-auto h-16 w-16"><div className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-amber-300/40 bg-amber-300/5 text-amber-200"><ImagePlus className="h-6 w-6" /></div><span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border border-black bg-amber-200 text-black"><Plus className="h-3.5 w-3.5" /></span></div><span className="mt-2 block truncate text-[9px] font-black uppercase tracking-[.13em] text-white/55">{meGroup ? "Přidat story" : "Tvoje story"}</span><input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onAdd(file); event.currentTarget.value = ""; }} /></label>}
      {visibleGroups.map((group) => {
        const latest = group.stories[0];
        const isMe = meGroup?.userId === group.userId;
        return <button type="button" key={group.userId} onClick={() => onPick(group)} className="w-20 shrink-0 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"><div className={`mx-auto h-16 w-16 overflow-hidden rounded-full p-0.5 ${isMe ? "border-2 border-amber-200" : "border-2 border-cyan-200/70"}`}><img src={latest.media_url} alt="" className="h-full w-full rounded-full object-cover" /></div><span className="mt-2 block truncate text-[9px] font-black uppercase tracking-[.12em] text-white/65">{isMe ? "Ty" : group.nickname}</span><span className="block text-[8px] uppercase tracking-[.12em] text-white/25">{group.stories.length} {group.stories.length === 1 ? "moment" : "momentů"}</span></button>;
      })}
      {!visibleGroups.length && !user && <div className="py-3 text-sm text-white/30">Žádné aktivní story.</div>}
    </div>
  </div>;
}

function PostComposer({ body, setBody, file, setFile, onPublish, uploading }: { body: string; setBody: (value: string) => void; file: File | null; setFile: (value: File | null) => void; onPublish: () => void; uploading: boolean }) {
  return <div className="mt-4 rounded-2xl border border-amber-300/15 bg-black/20 p-3"><textarea value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)} placeholder="Co se dnes děje na kurtu?" className="min-h-24 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-white/20" />
    {file && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.025] px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-semibold text-white/70">{file.name}</div><div className="text-[10px] text-white/25">{Math.ceil(file.size / 1024)} KB</div></div><button type="button" onClick={() => setFile(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-white/5 hover:text-white" aria-label="Odebrat fotku"><X className="h-4 w-4" /></button></div>}
    <div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-white/[.02] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/55"><Camera className="h-4 w-4" /> Fotka<input type="file" accept="image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><span className="text-[9px] text-white/20">max 10 MB</span><button type="button" disabled={uploading || (!body.trim() && !file)} onClick={onPublish} className="aaa-cta ml-auto inline-flex min-h-10 items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-[.14em]"><Send className="h-4 w-4" /> {uploading ? "Nahrávám…" : "Publikovat"}</button></div>
  </div>;
}

function PostCard({ post, currentUserId, canComment, commenting, setCommenting, commentDraft, setCommentDraft, onComment, onLike, onDelete, onDeleteComment, onOpenImage }: { post: SocialPost; currentUserId?: string; canComment: boolean; commenting: boolean; setCommenting: (id: string | null) => void; commentDraft: string; setCommentDraft: (value: string) => void; onComment: () => void; onLike: () => void; onDelete: () => void; onDeleteComment: (comment: SocialComment) => void; onOpenImage: (url: string) => void }) {
  const own = currentUserId === post.user_id;
  return <article className="aaa-card overflow-hidden"><div className="flex items-center justify-between gap-3 p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/5 font-display text-sm text-amber-100">{post.author_nickname.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{post.author_nickname}</div><div className="aaa-meta mt-0.5">SPORTCHMELÁCI · {formatTime(post.created_at)}</div></div></div><div className="flex items-center gap-1">{post.match_id && <span className="hidden rounded-full border border-cyan-200/10 bg-cyan-200/5 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/50 sm:inline">ZÁPAS</span>}{own && <button type="button" onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-xl text-white/25 hover:bg-white/5 hover:text-rose-200" aria-label="Smazat příspěvek"><MoreHorizontal className="h-4 w-4" /></button>}</div></div>
    {post.image_url && <button type="button" onClick={() => onOpenImage(post.image_url!)} className="block w-full cursor-zoom-in bg-black/30" aria-label="Otevřít fotku"><img src={post.image_url} alt="Fotka z příspěvku" className="max-h-[720px] w-full object-contain" loading="lazy" /></button>}
    <div className="p-4 sm:p-5"><div className="flex items-center gap-1"><IconButton label={post.liked_by_me ? "Zrušit To se mi líbí" : "To se mi líbí"} onClick={onLike} active={post.liked_by_me}><Heart className="h-5 w-5" fill={post.liked_by_me ? "currentColor" : "none"} /></IconButton><span className="mr-3 text-xs text-white/45">{post.likes}</span><IconButton label="Komentáře" onClick={() => setCommenting(commenting ? null : post.id)}><MessageCircle className="h-5 w-5" /></IconButton><span className="text-xs text-white/45">{post.comments?.length ?? 0}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/72">{post.body || "Moment ze zápasu."}</p>
      {(post.comments?.length ?? 0) > 0 && <div className="mt-4 space-y-2 border-t border-white/8 pt-3">{post.comments?.map((comment) => <div key={comment.id} className="group rounded-xl bg-white/[.025] px-3 py-2.5"><div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-white">{comment.author_nickname}</div>{comment.user_id === currentUserId && <button type="button" onClick={() => onDeleteComment(comment)} className="hidden h-7 w-7 place-items-center rounded-lg text-white/20 hover:bg-white/5 hover:text-rose-200 group-hover:grid" aria-label="Smazat komentář"><Trash2 className="h-3.5 w-3.5" /></button>}</div><div className="mt-0.5 text-sm text-white/55">{comment.body}</div><div className="mt-1 text-[9px] uppercase tracking-[.1em] text-white/20">{formatTime(comment.created_at)}</div></div>)}</div>}
      {commenting && canComment && <div className="mt-4 flex gap-2 border-t border-white/8 pt-3"><input value={commentDraft} maxLength={1000} onChange={(event) => setCommentDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onComment(); } }} placeholder="Napiš komentář…" className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-200/30" /><button type="button" onClick={onComment} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/5 text-amber-100" aria-label="Odeslat komentář"><Send className="h-4 w-4" /></button></div>}
    </div>
  </article>;
}

function StoryViewer({ viewer, currentUserId, canDelete, onClose, onChange, onDelete }: { viewer: StoryViewerState; currentUserId?: string; canDelete: boolean; onClose: () => void; onChange: (index: number) => void; onDelete: (story: SocialStory) => void }) {
  const story = viewer.stories[viewer.index];
  useEffect(() => {
    const id = window.setInterval(() => onChange(viewer.index + 1 < viewer.stories.length ? viewer.index + 1 : 0), 6500);
    return () => window.clearInterval(id);
  }, [viewer.index, viewer.stories.length, onChange]);
  if (!story) return null;
  const mine = currentUserId === story.user_id;
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/92 p-3 backdrop-blur-sm" onClick={onClose}><div className="relative flex h-[min(90vh,860px)] w-full max-w-md items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-3 pt-3">{viewer.stories.map((item, index) => <div key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/15"><div className={`h-full rounded-full ${index <= viewer.index ? "w-full bg-white" : "w-0"} ${index < viewer.index ? "opacity-60" : ""}`} /></div>)}</div><img src={story.media_url} alt={story.caption || "Příběh"} className="h-full w-full object-contain" /><button type="button" onClick={() => viewer.index > 0 && onChange(viewer.index - 1)} className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/70" aria-label="Předchozí story"><ChevronLeft className="h-6 w-6" /></button><button type="button" onClick={() => viewer.index + 1 < viewer.stories.length ? onChange(viewer.index + 1) : onClose()} className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/70" aria-label="Další story"><ChevronRight className="h-6 w-6" /></button><div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 pt-6"><div><div className="text-sm font-bold text-white">{story.author_nickname}</div><div className="aaa-meta mt-0.5">24H · {formatTime(story.created_at)}</div></div><div className="flex items-center gap-2">{mine && canDelete && <button type="button" onClick={() => onDelete(story)} className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white/70 hover:text-rose-200" aria-label="Smazat story"><Trash2 className="h-4 w-4" /></button>}<button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white" aria-label="Zavřít"><X className="h-5 w-5" /></button></div></div>{story.caption && <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/50 px-4 py-3 text-sm text-white backdrop-blur">{story.caption}</div>}</div></div>;
}

function IconButton({ label, onClick, active, children }: { label: string; onClick?: () => void; active?: boolean; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`grid h-10 w-10 place-items-center rounded-xl transition ${active ? "text-rose-300" : "text-white/45 hover:bg-white/5 hover:text-white"}`} aria-label={label}>{children}</button>;
}
