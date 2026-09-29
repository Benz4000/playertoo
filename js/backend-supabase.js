// Real backend: Supabase (auth, database, storage, realtime chat).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export function createSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey);
  let userId = null;

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  function ageFrom(birthdate) {
    const b = new Date(birthdate);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  }

  return {
    demo: false,

    async getUserId() {
      const { data } = await sb.auth.getSession();
      userId = data.session?.user.id ?? null;
      return userId;
    },

    onAuthChange(cb) {
      sb.auth.onAuthStateChange((_event, session) => {
        userId = session?.user.id ?? null;
        cb(userId);
      });
    },

    async signIn(email) {
      const redirect = location.origin + location.pathname;
      check(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
      return { sentLink: true };
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async getMyProfile() {
      const profile = check(await sb.from('profiles').select('*').eq('id', userId).maybeSingle());
      if (!profile) return null;
      const games = check(await sb.from('profile_games').select('game, rank').eq('profile_id', userId));
      return { ...profile, age: ageFrom(profile.birthdate), games };
    },

    async saveProfile(profile, games) {
      const row = { ...profile, id: userId };
      delete row.games;
      delete row.age;
      check(await sb.from('profiles').upsert(row));
      check(await sb.from('profile_games').delete().eq('profile_id', userId));
      if (games.length) {
        check(await sb.from('profile_games').insert(
          games.map((g) => ({ profile_id: userId, game: g.game, rank: g.rank || null })),
        ));
      }
    },

    async uploadAvatar(file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      check(await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type }));
      return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    },

    async getCandidates() {
      return check(await sb.rpc('get_candidates', { max_results: 100 }));
    },

    async swipe(targetId, liked) {
      check(await sb.from('swipes').upsert({ swiper: userId, swiped: targetId, liked }));
      if (!liked) return { matched: false };
      const [a, b] = [userId, targetId].sort();
      const match = check(await sb.from('matches').select('id').eq('user_a', a).eq('user_b', b).maybeSingle());
      return { matched: !!match, matchId: match?.id };
    },

    async getMatches() {
      return check(await sb.rpc('get_matches'));
    },

    async unmatch(matchId) {
      check(await sb.from('matches').delete().eq('id', matchId));
    },

    async getMessages(matchId) {
      return check(await sb.from('messages').select('*').eq('match_id', matchId).order('created_at'));
    },

    async sendMessage(matchId, body) {
      return check(await sb.from('messages').insert({ match_id: matchId, sender: userId, body }).select().single());
    },

    subscribeMessages(matchId, cb) {
      const channel = sb
        .channel(`match-${matchId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          (payload) => cb(payload.new))
        .subscribe();
      return () => sb.removeChannel(channel);
    },

    async block(otherId) {
      check(await sb.from('blocks').insert({ blocker: userId, blocked: otherId }));
    },

    async report(otherId, reason) {
      check(await sb.from('reports').insert({ reporter: userId, reported: otherId, reason }));
    },

    get userId() {
      return userId;
    },
  };
}
