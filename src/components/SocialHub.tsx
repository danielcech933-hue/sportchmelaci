import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Bookmark, Camera, Heart, ImagePlus, MessageCircle, MoreHorizontal, Plus, Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type SocialStory = { id: string; user_id: string; author_nickname: string; media_url: string; caption: string | null; expires_at: string; created_at: string };
type SocialPost = { id: string; user_id: string; author_nickname: string; body: string; image_url: string | null; match_id: string | null; created_at: string; likes: number; comments?: SocialComment[] };
type SocialComment = { id: string; post_id: string; user_id: string; author_nickname: string; body: string; created_at: string };

type Props = { compact?: boolean; profileUserId?: string };
const db = supabase as any;

export function SocialHub({ compact = false, profileUserId }: Props) {
  const { user, nickname } = useAuth();
  const [stories, setStories] = useState<SocialStory[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [storyViewer, setStoryViewer] = useState<SocialStory | null>(null);

  const load = async () => {
    const now = new Date().toISOString();
    const storyQuery = await db.from("social_stories").select("id,user_id,author_nickname,media_url,caption,expires_at,created_at").gt("expires_at", now).order("created_at", { ascending: false }).limit(18);
    const postQuery = await db.from("social_posts").select("id,user_id,author_nickname,body,image_url,match_id,created_at").order("created_at", { ascending: false }).limit(profileUserId ? 40 : compact ? 6 : 24);
    setStories((storyQuery.data ?? []) as SocialStory[]);
    const loaded = (postQuery.data ?? []) as SocialPost[];
    const filtered = profileUserId ? loaded.filter((p) => p.user_id === profileUserId) : loaded;
    const postIds = filtered.map((p) => p.id);
    if (postIds.length) {
      const comments = await db.from("social_comments").select("id,post_id,user_id,author_nickname,body,created_at").in("post_id", postIds).order("created_at", { ascending: true });
      const byPost = new Map<string, SocialComment[]>();
      for (const c of (comments.data ?? []) as SocialComment[]) {
        const list = byPost.get(c.post_id) ?? [];
        list.push(c);
        byPost.set(c.post_id, list);
      }
      for (const p of filtered) p.comments = byPost.get(p.id) ?? [];
    }
    setPosts(filtered);
  };

  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 12000); return () => window.clearInterval(id); }, [profileUserId, compact]);

  const meStory = useMemo(() => stories.find((story) => story.user_id === user?.id), [stories, user?.id]);

  const uploadAsset = async (asset: File) => {
    if (!user) throw new Error("Přihlas se.");
    if (!asset.type.startsWith("image/")) throw new Error("Použij obrázek.");
    if (asset.size > 10 * 1024 * 1024) throw new Error("Maximální velikost je 10 MB.");
    const ext = asset.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("social-media").upload(path, asset, { upsert: false, contentType: asset.type });
    if (error) throw error;
    return supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
  };

  const publishPost = async () => {
    if (!user || (!body.trim() && !file)) return;
    try {
      setUploading(true);
      const imageUrl = file ? await uploadAsset(file) : null;
      const { error } = await db.from("social_posts").insert({ user_id: user.id, author_nickname: nickname || "Hráč", body: body.trim(), image_url: imageUrl });
      if (error) throw error;
      setBody(""); setFile(null); setComposerOpen(false); await load();
    } catch (error: any) { window.alert(error?.message ?? "Příspěvek se nepodařilo zveřejnit."); } finally { setUploading(false); }
  };

  const publishStory = async (asset: File) => {
    if (!user) return;
    try {
      setUploading(true);
      const mediaUrl = await uploadAsset(asset);
      const { error } = await db.from("social_stories").insert({ user_id: user.id, author_nickname: nickname || "Hráč", media_url: mediaUrl, caption: "", expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
      if (error) throw error;
      await load();
    } catch (error: any) { window.alert(error?.message ?? "Story se nepodařilo nahrát."); } finally { setUploading(false); }
  };

  const addComment = async (postId: string) => {
    if (!user || !commentDraft.trim()) return;
    const { error } = await db.from("social_comments").insert({ post_id: postId, user_id: user.id, author_nickname: nickname || "Hráč", body: commentDraft.trim() });
    if (!error) { setCommentDraft(""); setCommenting(null); await load(); }
  };

  const likePost = async (post: SocialPost) => {
    if (!user) return;
    // Optimistic UI; a lightweight per-user like table can be added later without changing the feed contract.
    setPosts((current) => current.map((p) => p.id === post.id ? { ...p, likes: p.likes + 1 } : p));
  };

  return <section className={compact ? "space-y-3" : "space-y-5"}>
    {!profileUserId && <StoriesStrip stories={stories} meStory={meStory} onPick={setStoryViewer} onAdd={publishStory} disabled={!user || uploading} />}

    {!profileUserId && <div className="aaa-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><div className="aaa-meta text-amber-200/70">SOCIAL FEED</div><h2 className="mt-1 font-display text-2xl tracking-[.12em] text-white">CO SE DĚJE NA CHMELOVCÍCH</h2></div>
        {user && <button type="button" onClick={() => setComposerOpen((v) => !v)} className="aaa-cta inline-flex items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.15em]"><Plus className="h-4 w-4" /> Přidat příspěvek</button>}
      </div>
      {composerOpen && <PostComposer body={body} setBody={setBody} file={file} setFile={setFile} onPublish={publishPost} uploading={uploading} />}
    </div>}

    <div className={compact ? "space-y-3" : "mx-auto max-w-3xl space-y-4"}>
      {posts.map((post) => <PostCard key={post.id} post={post} canComment={Boolean(user)} commenting={commenting === post.id} setCommenting={setCommenting} commentDraft={commentDraft} setCommentDraft={setCommentDraft} onComment={() => void addComment(post.id)} onLike={() => void likePost(post)} />)}
      {!posts.length && <div className="aaa-card p-8 text-center"><Sparkles className="mx-auto h-7 w-7 text-amber-200/70" /><p className="mt-3 text-sm text-white/45">Feed je zatím prázdný. Přidej první moment ze zápasu.</p></div>}
    </div>

    {storyViewer && <StoryViewer story={storyViewer} onClose={() => setStoryViewer(null)} />}
  </section>;
}

function StoriesStrip({ stories, meStory, onPick, onAdd, disabled }: { stories: SocialStory[]; meStory?: SocialStory; onPick: (story: SocialStory) => void; onAdd: (file: File) => void; disabled: boolean }) {
  return <div className="aaa-card overflow-hidden p-4 sm:p-5">
    <div className="flex items-center justify-between"><div><div className="aaa-meta text-cyan-200/70">MOMENTS · 24 H</div><h2 className="mt-1 font-display text-2xl tracking-[.12em] text-white">STORIES</h2></div><span className="aaa-meta">ZÁPASY · LIDI · MOMENTKY</span></div>
    <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
      <label className="w-20 shrink-0 cursor-pointer text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-dashed border-amber-300/40 bg-amber-300/5 text-amber-200"><ImagePlus className="h-6 w-6" /></div>
        <span className="mt-2 block text-[9px] font-black uppercase tracking-[.13em] text-white/50">Tvoje story</span>
        <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.currentTarget.value = ""; }} />
      </label>
      {stories.map((story) => <button type="button" key={story.id} onClick={() => onPick(story)} className="w-20 shrink-0 text-center"><div className="mx-auto h-16 w-16 overflow-hidden rounded-full border-2 border-amber-300/70 p-0.5"><img src={story.media_url} alt="" className="h-full w-full rounded-full object-cover" /></div><span className="mt-2 block truncate text-[9px] font-black uppercase tracking-[.12em] text-white/65">{story.user_id === meStory?.user_id ? "Ty" : story.author_nickname}</span></button>)}
    </div>
  </div>;
}

function PostComposer({ body, setBody, file, setFile, onPublish, uploading }: { body: string; setBody: (v: string) => void; file: File | null; setFile: (v: File | null) => void; onPublish: () => void; uploading: boolean }) {
  return <div className="mt-4 rounded-2xl border border-amber-300/15 bg-black/20 p-3"><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Co se dnes děje na kurtu?" className="min-h-24 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/20" /><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-white/[.02] px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/50"><Camera className="h-4 w-4" /> Fotka <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>{file && <span className="max-w-52 truncate text-xs text-amber-100/70">{file.name}</span>}<button type="button" disabled={uploading || (!body.trim() && !file)} onClick={onPublish} className="aaa-cta ml-auto inline-flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-[.14em]"><Send className="h-4 w-4" /> {uploading ? "Nahrávám…" : "Publikovat"}</button></div></div>;
}

function PostCard({ post, canComment, commenting, setCommenting, commentDraft, setCommentDraft, onComment, onLike }: { post: SocialPost; canComment: boolean; commenting: boolean; setCommenting: (id: string | null) => void; commentDraft: string; setCommentDraft: (v: string) => void; onComment: () => void; onLike: () => void }) {
  return <article className="aaa-card overflow-hidden">
    <div className="flex items-center justify-between gap-3 p-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/5 font-display text-sm text-amber-100">{post.author_nickname.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{post.author_nickname}</div><div className="aaa-meta mt-0.5">SPORTCHMELÁCI · {new Date(post.created_at).toLocaleDateString("cs-CZ")}</div></div></div><MoreHorizontal className="h-4 w-4 text-white/25" /></div>
    {post.image_url && <img src={post.image_url} alt="" className="max-h-[620px] w-full object-cover" loading="lazy" />}
    <div className="p-4 sm:p-5"><div className="flex items-center gap-1"><IconButton label="To se mi líbí" onClick={onLike}><Heart className="h-5 w-5" /></IconButton><span className="mr-3 text-xs text-white/45">{post.likes}</span><IconButton label="Komentáře" onClick={() => setCommenting(commenting ? null : post.id)}><MessageCircle className="h-5 w-5" /></IconButton><span className="text-xs text-white/45">{post.comments?.length ?? 0}</span><span className="ml-auto"><IconButton label="Uložit"><Bookmark className="h-5 w-5" /></IconButton></span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/72">{post.body || "Moment ze zápasu."}</p>
      {(post.comments?.length ?? 0) > 0 && <div className="mt-4 space-y-2 border-t border-white/8 pt-3">{post.comments?.map((c) => <div key={c.id} className="rounded-xl bg-white/[.02] px-3 py-2"><div className="text-xs font-bold text-white">{c.author_nickname}</div><div className="mt-0.5 text-sm text-white/55">{c.body}</div></div>)}</div>}
      {commenting && canComment && <div className="mt-4 flex gap-2 border-t border-white/8 pt-3"><input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onComment(); }} placeholder="Napiš komentář…" className="min-w-0 flex-1 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/20" /><button type="button" onClick={onComment} className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/5 text-amber-100" aria-label="Odeslat komentář"><Send className="h-4 w-4" /></button></div>}
    </div>
  </article>;
}

function StoryViewer({ story, onClose }: { story: SocialStory; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-3 backdrop-blur-sm" onClick={onClose}><div className="relative flex h-[min(88vh,820px)] w-full max-w-md items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-black" onClick={(e) => e.stopPropagation()}><img src={story.media_url} alt="" className="h-full w-full object-contain" /><div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4"><div><div className="text-sm font-bold text-white">{story.author_nickname}</div><div className="aaa-meta mt-0.5">24H STORY</div></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white" aria-label="Zavřít"><X className="h-5 w-5" /></button></div></div></div>;
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className="grid h-9 w-9 place-items-center rounded-xl text-white/45 hover:bg-white/5 hover:text-white" aria-label={label}>{children}</button>; }
