// Demo backend: runs entirely in the browser with made-up players, so the app
// can be tried before Supabase is set up. Data is kept in localStorage.

const KEY = 'playertoo-demo-v1';
const ME = 'demo-me';

const SEED = [
  { id: 'd1', display_name: 'Maya', age: 24, gender: 'woman', interested_in: ['man', 'nonbinary'], looking_for: 'both', region: 'NA East', platforms: ['PC'], play_times: ['Evenings', 'Late nights'], bio: 'Hard stuck Plat but my comms are elite. Looking for someone to queue with and maybe grab ramen after.', games: [{ game: 'Valorant', rank: 'Platinum' }, { game: 'Stardew Valley' }, { game: 'Lethal Company' }], likesYou: true },
  { id: 'd2', display_name: 'Jordan', age: 27, gender: 'nonbinary', interested_in: ['man', 'woman', 'nonbinary'], looking_for: 'date', region: 'NA West', platforms: ['PC', 'Switch'], play_times: ['Weekends', 'Evenings'], bio: 'Cozy gamer. Will absolutely judge your island layout.', games: [{ game: 'Animal Crossing' }, { game: 'Stardew Valley' }, { game: "Baldur's Gate 3" }], likesYou: true },
  { id: 'd3', display_name: 'Dev', age: 29, gender: 'man', interested_in: ['woman'], looking_for: 'both', region: 'Europe', platforms: ['PC', 'PlayStation'], play_times: ['Late nights'], bio: 'Support main in every game. I will peel for you.', games: [{ game: 'League of Legends', rank: 'Emerald' }, { game: 'Overwatch 2', rank: 'Diamond' }, { game: 'Elden Ring' }], likesYou: false },
  { id: 'd4', display_name: 'Sam', age: 22, gender: 'woman', interested_in: ['woman'], looking_for: 'both', region: 'NA East', platforms: ['PC', 'Xbox'], play_times: ['Afternoons', 'Evenings'], bio: 'Rocket League at 2am is a personality.', games: [{ game: 'Rocket League', rank: 'Champion' }, { game: 'Fortnite', rank: 'Diamond' }, { game: 'Minecraft' }], likesYou: true },
  { id: 'd5', display_name: 'Theo', age: 31, gender: 'man', interested_in: ['man'], looking_for: 'date', region: 'NA West', platforms: ['PlayStation'], play_times: ['Weekends'], bio: 'Souls veteran. Let me show you the best bonfire.', games: [{ game: 'Elden Ring' }, { game: 'Destiny 2' }, { game: 'Helldivers 2' }], likesYou: true },
  { id: 'd6', display_name: 'Riley', age: 25, gender: 'woman', interested_in: ['man', 'woman', 'nonbinary'], looking_for: 'duo', region: 'NA East', platforms: ['PC'], play_times: ['Evenings'], bio: 'Just want a consistent duo who does not flame. Radiant or bust.', games: [{ game: 'Valorant', rank: 'Diamond' }, { game: 'Counter-Strike 2', rank: '15k–20k' }, { game: 'Apex Legends', rank: 'Master' }], likesYou: true },
  { id: 'd7', display_name: 'Kai', age: 23, gender: 'man', interested_in: ['woman', 'nonbinary'], looking_for: 'both', region: 'Asia', platforms: ['Mobile', 'PC'], play_times: ['Mornings', 'Weekends'], bio: 'Gacha addict in recovery (not really).', games: [{ game: 'Genshin Impact' }, { game: 'Marvel Rivals', rank: 'Grandmaster' }, { game: 'Pokémon' }], likesYou: false },
  { id: 'd8', display_name: 'Nia', age: 28, gender: 'woman', interested_in: ['man'], looking_for: 'both', region: 'Europe', platforms: ['PC'], play_times: ['Evenings', 'Weekends'], bio: 'Raid leader. Punctual. Will bring snacks to the LAN.', games: [{ game: 'World of Warcraft' }, { game: 'Final Fantasy XIV' }, { game: 'Dota 2', rank: 'Ancient' }], likesYou: true },
  { id: 'd9', display_name: 'Alex', age: 26, gender: 'nonbinary', interested_in: ['woman', 'nonbinary'], looking_for: 'both', region: 'Oceania', platforms: ['Switch', 'PC'], play_times: ['Late nights'], bio: 'Smash tournaments on weekends, Mario Kart trash talk always.', games: [{ game: 'Super Smash Bros. Ultimate' }, { game: 'Mario Kart' }, { game: 'Among Us' }], likesYou: true },
  { id: 'd10', display_name: 'Marcus', age: 30, gender: 'man', interested_in: ['woman'], looking_for: 'duo', region: 'NA East', platforms: ['Xbox', 'PC'], play_times: ['Evenings', 'Late nights'], bio: 'Need a squadmate who calls out footsteps.', games: [{ game: 'Call of Duty' }, { game: 'Apex Legends', rank: 'Diamond' }, { game: 'Rainbow Six Siege', rank: 'Platinum' }], likesYou: true },
  { id: 'd11', display_name: 'Priya', age: 24, gender: 'woman', interested_in: ['man', 'nonbinary'], looking_for: 'date', region: 'NA West', platforms: ['PC', 'PlayStation'], play_times: ['Evenings'], bio: 'Tabletop nerd turned CRPG nerd. Tell me your Tav build.', games: [{ game: "Baldur's Gate 3" }, { game: 'Minecraft' }, { game: 'Overwatch 2', rank: 'Gold' }], likesYou: true },
  { id: 'd12', display_name: 'Leo', age: 27, gender: 'man', interested_in: ['woman', 'man', 'nonbinary'], looking_for: 'both', region: 'South America', platforms: ['PC', 'PlayStation'], play_times: ['Afternoons', 'Weekends'], bio: 'FC on weekdays, GTA chaos on weekends.', games: [{ game: 'EA Sports FC' }, { game: 'GTA Online' }, { game: 'Fortnite', rank: 'Platinum' }], likesYou: true },
];

const OPENERS = [
  'gg on the match 😄 what do you main?',
  'ok your profile made me laugh. queue tonight?',
  'finally someone with taste in games',
  'hi!! be honest, what rank are you really',
];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return s;
  } catch {}
  return { signedIn: false, profile: null, swipes: {}, matches: [], messages: {}, blocked: [], nextId: 1 };
}

export function createDemoBackend() {
  let state = load();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  };
  const listeners = {};
  const person = (id) => SEED.find((p) => p.id === id);
  const publicView = ({ likesYou, ...p }) => ({ ...p, avatar_url: null });
  const now = () => new Date().toISOString();

  function addMessage(matchId, sender, body) {
    const msg = { id: state.nextId++, match_id: matchId, sender, body, created_at: now() };
    (state.messages[matchId] ||= []).push(msg);
    save();
    (listeners[matchId] || []).forEach((cb) => cb(msg));
    return msg;
  }

  return {
    demo: true,

    async getUserId() {
      return state.signedIn ? ME : null;
    },

    onAuthChange() {},

    async signIn() {
      state.signedIn = true;
      save();
      return { sentLink: false };
    },

    async signOut() {
      localStorage.removeItem(KEY);
      state = load();
    },

    async getMyProfile() {
      return state.profile;
    },

    async saveProfile(profile, games) {
      state.profile = { ...profile, id: ME, games };
      save();
    },

    async uploadAvatar(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    },

    async getCandidates() {
      return SEED
        .filter((p) => !(p.id in state.swipes) && !state.blocked.includes(p.id))
        .map(publicView);
    },

    async swipe(targetId, liked) {
      state.swipes[targetId] = liked;
      let matched = false;
      let matchId;
      if (liked && person(targetId)?.likesYou) {
        matchId = `m-${targetId}`;
        state.matches.push({ match_id: matchId, other: targetId, matched_at: now() });
        matched = true;
        setTimeout(() => addMessage(matchId, targetId, OPENERS[state.matches.length % OPENERS.length]), 2500);
      }
      save();
      return { matched, matchId };
    },

    async getMatches() {
      return state.matches
        .map((m) => {
          const msgs = state.messages[m.match_id] || [];
          const last = msgs[msgs.length - 1];
          return {
            match_id: m.match_id,
            matched_at: m.matched_at,
            profile: publicView(person(m.other)),
            last_message: last?.body ?? null,
            last_message_at: last?.created_at ?? null,
          };
        })
        .sort((a, b) => (b.last_message_at || b.matched_at).localeCompare(a.last_message_at || a.matched_at));
    },

    async unmatch(matchId) {
      state.matches = state.matches.filter((m) => m.match_id !== matchId);
      delete state.messages[matchId];
      save();
    },

    async getMessages(matchId) {
      return state.messages[matchId] || [];
    },

    async sendMessage(matchId, body) {
      const msg = addMessage(matchId, ME, body);
      const m = state.matches.find((x) => x.match_id === matchId);
      if (m && (state.messages[matchId] || []).filter((x) => x.sender === ME).length === 1) {
        setTimeout(() => addMessage(matchId, m.other, 'haha love that. add me, I’m on most nights 🎮'), 3000);
      }
      return msg;
    },

    subscribeMessages(matchId, cb) {
      (listeners[matchId] ||= []).push(cb);
      return () => { listeners[matchId] = listeners[matchId].filter((x) => x !== cb); };
    },

    async block(otherId) {
      state.blocked.push(otherId);
      const m = state.matches.find((x) => x.other === otherId);
      if (m) await this.unmatch(m.match_id);
      save();
    },

    async report() {},

    get userId() {
      return state.signedIn ? ME : null;
    },
  };
}
