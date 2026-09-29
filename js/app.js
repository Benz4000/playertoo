import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createDemoBackend } from './backend-demo.js';
import { GAMES, MAX_GAMES, PLATFORMS, REGIONS, PLAY_TIMES, GENDERS, LOOKING_FOR } from './games.js';
import { rankCandidates } from './matching.js';

const api = SUPABASE_URL && SUPABASE_ANON_KEY
  ? (await import('./backend-supabase.js')).createSupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createDemoBackend();

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabs');
const $toast = document.getElementById('toast');
document.getElementById('demo-badge').hidden = !api.demo;

let me = null;
let cleanup = null;

// ---------- helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const safeImg = (url) => (typeof url === 'string' && /^(https:|data:image\/)/.test(url) ? url : null);

function avatar(p, size = '') {
  const url = safeImg(p.avatar_url);
  if (url) return `<img class="avatar ${size}" src="${esc(url)}" alt="">`;
  const hue = [...(p.id || p.display_name || 'x')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return `<div class="avatar ${size}" style="--hue:${hue}" aria-hidden="true">${esc((p.display_name || '?')[0].toUpperCase())}</div>`;
}

function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $toast.hidden = true; }, 3000);
}

function showTabs(active) {
  $tabs.hidden = !active;
  $tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === active));
}

async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Something went wrong');
  }
}

// ---------- routing ----------

async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const userId = await api.getUserId();
  if (!userId) { me = null; return renderLogin(); }
  if (!me) me = await guard(() => api.getMyProfile());
  if (!me) return renderProfileEditor(true);

  const [view, arg] = location.hash.slice(1).split('/');
  if (view === 'matches') return renderMatches();
  if (view === 'chat' && arg) return renderChat(decodeURIComponent(arg));
  if (view === 'profile') return renderProfileEditor(false);
  return renderDiscover();
}

// ---------- login ----------

function renderLogin() {
  showTabs(null);
  $app.innerHTML = `
    <section class="hero">
      <h1>Find your <span class="grad">Player Two</span>.</h1>
      <p class="lead">Match with people who play what you play. Looking for a date, a duo, or both? Pick your games and start swiping.</p>
      <form id="login" class="card form">
        ${api.demo ? `
          <p class="muted">This is a demo with made-up players. Nothing you enter leaves your browser.</p>
          <button class="btn primary" type="submit">Try the demo</button>
        ` : `
          <label>Email<input type="email" name="email" required placeholder="you@example.com" autocomplete="email"></label>
          <button class="btn primary" type="submit">Send me a sign-in link</button>
          <p class="muted small">You must be 18 or older to use Player Too.</p>
        `}
      </form>
    </section>`;
  $app.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email?.value.trim();
    const res = await guard(() => api.signIn(email));
    if (res?.sentLink) {
      e.target.innerHTML = `<p><strong>Check your email.</strong> We sent a sign-in link to ${esc(email)}.</p>`;
    } else if (res) {
      route();
    }
  });
}

// ---------- profile editor ----------

function chips(name, options, selected, type = 'checkbox') {
  return options.map((o) => {
    const value = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    const checked = type === 'radio' ? selected === value : (selected || []).includes(value);
    return `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  }).join('');
}

function renderProfileEditor(isNew) {
  showTabs(isNew ? null : 'profile');
  const p = me || { interested_in: [], platforms: [], play_times: [], looking_for: 'both', games: [] };
  const myGames = new Map((p.games || []).map((g) => [g.game, g.rank]));
  let avatarUrl = p.avatar_url || null;
  const maxBirth = new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10);

  $app.innerHTML = `
    <form id="profile" class="stack">
      <h1>${isNew ? 'Set up your profile' : 'Your profile'}</h1>

      <div class="card form">
        <div class="avatar-edit">
          <div id="avatar-preview">${avatar({ ...p, avatar_url: avatarUrl, display_name: p.display_name || '?' }, 'xl')}</div>
          <label class="btn">Choose photo<input type="file" id="photo" accept="image/*" hidden></label>
        </div>
        <label>Display name<input name="display_name" required maxlength="40" value="${esc(p.display_name)}"></label>
        ${p.age != null && !isNew ? '' : `<label>Birthday<input type="date" name="birthdate" required max="${maxBirth}" value="${esc(p.birthdate)}"></label>`}
        <label>Bio<textarea name="bio" maxlength="300" rows="3" placeholder="Main, playstyle, hot takes…">${esc(p.bio)}</textarea></label>
      </div>

      <div class="card form">
        <fieldset><legend>I am a</legend><div class="chips">${chips('gender', GENDERS, p.gender, 'radio')}</div></fieldset>
        <fieldset><legend>Looking for</legend><div class="chips">${chips('looking_for', LOOKING_FOR, p.looking_for, 'radio')}</div></fieldset>
        <fieldset><legend>Interested in dating</legend><div class="chips">${chips('interested_in', GENDERS, p.interested_in)}</div></fieldset>
      </div>

      <div class="card form">
        <fieldset><legend>Games <span class="muted small">(up to ${MAX_GAMES})</span></legend>
          <div class="chips" id="games">
            ${GAMES.map((g) => `<label class="chip"><input type="checkbox" name="game" value="${esc(g.name)}" ${myGames.has(g.name) ? 'checked' : ''}><span>${esc(g.name)}</span></label>`).join('')}
          </div>
        </fieldset>
        <div id="ranks" class="ranks"></div>
      </div>

      <div class="card form">
        <fieldset><legend>Platforms</legend><div class="chips">${chips('platforms', PLATFORMS, p.platforms)}</div></fieldset>
        <label>Region<select name="region" required>
          <option value="">Choose…</option>
          ${REGIONS.map((r) => `<option ${p.region === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
        </select></label>
        <fieldset><legend>Usually playing</legend><div class="chips">${chips('play_times', PLAY_TIMES, p.play_times)}</div></fieldset>
      </div>

      <button class="btn primary big" type="submit">${isNew ? 'Start swiping' : 'Save'}</button>
      ${isNew ? '' : '<button class="btn ghost" type="button" id="signout">Sign out</button>'}
    </form>`;

  const form = $app.querySelector('#profile');
  const $ranks = form.querySelector('#ranks');

  function drawRanks() {
    const picked = [...form.querySelectorAll('input[name=game]:checked')].map((i) => i.value);
    form.querySelectorAll('input[name=game]:not(:checked)').forEach((i) => { i.disabled = picked.length >= MAX_GAMES; });
    $ranks.innerHTML = picked
      .map((name) => GAMES.find((g) => g.name === name))
      .filter((g) => g?.ranks)
      .map((g) => {
        const current = form.querySelector(`select[data-game="${CSS.escape(g.name)}"]`)?.value ?? myGames.get(g.name) ?? '';
        return `<label>${esc(g.name)} rank<select data-game="${esc(g.name)}">
          <option value="">Prefer not to say</option>
          ${g.ranks.map((r) => `<option ${current === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
        </select></label>`;
      }).join('');
  }
  form.querySelector('#games').addEventListener('change', drawRanks);
  drawRanks();

  form.querySelector('#photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Photo must be under 5 MB');
    const url = await guard(() => api.uploadAvatar(file));
    if (url) {
      avatarUrl = url;
      form.querySelector('#avatar-preview').innerHTML = avatar({ avatar_url: url }, 'xl');
    }
  });

  form.querySelector('#signout')?.addEventListener('click', async () => {
    await api.signOut();
    me = null;
    location.hash = '';
    route();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const all = (n) => fd.getAll(n);
    const games = all('game').map((game) => ({
      game,
      rank: form.querySelector(`select[data-game="${CSS.escape(game)}"]`)?.value || null,
    }));

    if (!fd.get('gender')) return toast('Pick how you identify');
    if (!games.length) return toast('Pick at least one game');
    if (fd.get('looking_for') !== 'duo' && !all('interested_in').length) return toast('Pick who you’re interested in dating');

    const profile = {
      display_name: fd.get('display_name').trim(),
      birthdate: fd.get('birthdate') || p.birthdate,
      gender: fd.get('gender'),
      looking_for: fd.get('looking_for') || 'both',
      interested_in: all('interested_in'),
      bio: fd.get('bio').trim() || null,
      avatar_url: avatarUrl,
      platforms: all('platforms'),
      region: fd.get('region'),
      play_times: all('play_times'),
    };
    if (api.demo) {
      const b = new Date(profile.birthdate);
      profile.age = Math.floor((Date.now() - b) / (365.25 * 864e5));
    }

    const ok = await guard(async () => { await api.saveProfile(profile, games); return true; });
    if (!ok) return;
    me = await api.getMyProfile();
    toast(isNew ? 'Welcome to Player Too!' : 'Profile saved');
    location.hash = 'discover';
    if (isNew) route();
  });
}

// ---------- discover ----------

function tags(labels, cls = '') {
  return labels.map((t) => `<span class="tag ${cls}">${esc(t)}</span>`).join('');
}

function cardHtml({ them, fit, match }) {
  const shared = new Set(match.sharedGames);
  const games = (them.games || []).map((g) => {
    const label = g.rank ? `${g.game} · ${g.rank}` : g.game;
    return `<span class="tag ${shared.has(g.game) ? 'hot' : ''}">${esc(label)}</span>`;
  }).join('');
  const modes = [fit.date && 'Date', fit.duo && 'Duo'].filter(Boolean);
  return `
    <article class="swipe-card" data-id="${esc(them.id)}">
      <div class="photo">${avatar(them, 'fill')}
        <div class="stamp like">PLAYER 2</div><div class="stamp nope">PASS</div>
      </div>
      <div class="info">
        <div class="name-row">
          <h2>${esc(them.display_name)} <span class="age">${esc(them.age)}</span></h2>
          <button class="icon-btn" data-act="more" aria-label="Report or block">⋯</button>
        </div>
        <div class="meta">${tags(modes, 'mode')}${them.region ? `<span class="muted">📍 ${esc(them.region)}</span>` : ''}</div>
        ${match.sharedGames.length ? `<p class="common">🎮 You both play ${esc(match.sharedGames.join(', '))}</p>` : ''}
        ${them.bio ? `<p class="bio">${esc(them.bio)}</p>` : ''}
        <div class="tags">${games}</div>
        <div class="tags small">${tags(them.platforms || [])}${tags(them.play_times || [], 'soft')}</div>
      </div>
    </article>`;
}

async function renderDiscover() {
  showTabs('discover');
  $app.innerHTML = '<p class="muted center">Finding players…</p>';
  const candidates = await guard(() => api.getCandidates());
  if (!candidates) return;
  const deck = rankCandidates(me, candidates);
  let i = 0;

  function draw() {
    if (i >= deck.length) {
      $app.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🕹️</div>
          <h2>You’re all caught up</h2>
          <p class="muted">No more players match your games and preferences right now. Add more games to your profile or check back later.</p>
          <a class="btn" href="#profile">Edit profile</a>
        </div>`;
      return;
    }
    $app.innerHTML = `
      <div class="deck">
        ${deck[i + 1] ? cardHtml(deck[i + 1]).replace('swipe-card', 'swipe-card under') : ''}
        ${cardHtml(deck[i])}
      </div>
      <div class="actions">
        <button class="round nope" data-act="pass" aria-label="Pass">✕</button>
        <button class="round like" data-act="like" aria-label="Like">♥</button>
      </div>`;
    const card = $app.querySelector('.swipe-card:not(.under)');
    enableDrag(card, (liked) => decide(liked));
    $app.querySelector('[data-act=pass]').onclick = () => fling(card, false);
    $app.querySelector('[data-act=like]').onclick = () => fling(card, true);
    card.querySelector('[data-act=more]').onclick = () => safetyMenu(deck[i].them, () => { i++; draw(); });
  }

  function fling(card, liked) {
    card.style.transition = 'transform .3s ease, opacity .3s ease';
    card.style.transform = `translateX(${liked ? 120 : -120}%) rotate(${liked ? 18 : -18}deg)`;
    card.style.opacity = '0';
    setTimeout(() => decide(liked), 250);
  }

  let busy = false;
  async function decide(liked) {
    if (busy) return;
    busy = true;
    const them = deck[i].them;
    const res = await guard(() => api.swipe(them.id, liked));
    busy = false;
    i++;
    draw();
    if (res?.matched) showMatch(them, res.matchId);
  }

  const onKey = (e) => {
    const card = $app.querySelector('.swipe-card:not(.under)');
    if (!card || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') fling(card, false);
    if (e.key === 'ArrowRight') fling(card, true);
  };
  window.addEventListener('keydown', onKey);
  cleanup = () => window.removeEventListener('keydown', onKey);

  draw();
}

function enableDrag(card, done) {
  let startX = 0, startY = 0, dx = 0, dragging = false;
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY; dx = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = (e.clientY - startY) * 0.2;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)`;
    card.style.setProperty('--like', Math.max(0, Math.min(1, dx / 100)));
    card.style.setProperty('--nope', Math.max(0, Math.min(1, -dx / 100)));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = 'transform .3s ease, opacity .3s ease';
    if (Math.abs(dx) > 110) {
      card.style.transform = `translateX(${dx > 0 ? 150 : -150}%) rotate(${dx / 10}deg)`;
      card.style.opacity = '0';
      setTimeout(() => done(dx > 0), 200);
    } else {
      card.style.transform = '';
      card.style.setProperty('--like', 0);
      card.style.setProperty('--nope', 0);
    }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

function modal(html) {
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
  return el;
}

function showMatch(them, matchId) {
  const el = modal(`
    <div class="match-pop">
      <p class="eyebrow">It’s a match!</p>
      <div class="pair">${avatar(me, 'lg')}${avatar(them, 'lg')}</div>
      <h2>You and ${esc(them.display_name)} liked each other</h2>
      <a class="btn primary" href="#chat/${encodeURIComponent(matchId)}">Say hi</a>
      <button class="btn ghost" data-close>Keep swiping</button>
    </div>`);
  el.querySelector('a').onclick = () => el.remove();
  el.querySelector('[data-close]').onclick = () => el.remove();
}

function safetyMenu(them, after, matchId) {
  const el = modal(`
    <h2>${esc(them.display_name)}</h2>
    <div class="stack">
      ${matchId ? '<button class="btn" data-a="unmatch">Unmatch</button>' : ''}
      <button class="btn" data-a="block">Block</button>
      <button class="btn danger" data-a="report">Report</button>
      <button class="btn ghost" data-a="close">Cancel</button>
    </div>`);
  el.querySelector('[data-a=close]').onclick = () => el.remove();
  el.querySelector('[data-a=unmatch]')?.addEventListener('click', async () => {
    el.remove();
    await guard(() => api.unmatch(matchId));
    toast('Unmatched');
    after();
  });
  el.querySelector('[data-a=block]').onclick = async () => {
    el.remove();
    await guard(() => api.block(them.id));
    toast(`${them.display_name} is blocked`);
    after();
  };
  el.querySelector('[data-a=report]').onclick = () => {
    el.querySelector('.modal-box').innerHTML = `
      <h2>Report ${esc(them.display_name)}</h2>
      <form class="form stack">
        <label>What happened?<textarea name="reason" required maxlength="500" rows="4"></textarea></label>
        <button class="btn danger" type="submit">Send report and block</button>
      </form>`;
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const reason = e.target.reason.value.trim();
      el.remove();
      await guard(async () => {
        await api.report(them.id, reason);
        await api.block(them.id);
      });
      toast('Thanks. We got your report.');
      after();
    };
  };
}

// ---------- matches ----------

async function renderMatches() {
  showTabs('matches');
  $app.innerHTML = '<p class="muted center">Loading matches…</p>';
  const matches = await guard(() => api.getMatches());
  if (!matches) return;
  if (!matches.length) {
    $app.innerHTML = `
      <div class="empty">
        <div class="empty-icon">💬</div>
        <h2>No matches yet</h2>
        <p class="muted">When someone you liked likes you back, they’ll show up here.</p>
        <a class="btn primary" href="#discover">Start swiping</a>
      </div>`;
    return;
  }
  $app.innerHTML = `
    <h1>Matches</h1>
    <ul class="match-list">
      ${matches.map((m) => `
        <li><a href="#chat/${encodeURIComponent(m.match_id)}">
          ${avatar(m.profile)}
          <div class="grow">
            <strong>${esc(m.profile.display_name)}</strong>
            <p class="muted ellipsis">${m.last_message ? esc(m.last_message) : 'New match. Say hi!'}</p>
          </div>
        </a></li>`).join('')}
    </ul>`;
}

// ---------- chat ----------

async function renderChat(matchId) {
  showTabs(null);
  const matches = await guard(() => api.getMatches());
  const m = matches?.find((x) => String(x.match_id) === String(matchId));
  if (!m) { location.hash = 'matches'; return; }
  const them = m.profile;

  $app.innerHTML = `
    <div class="chat">
      <div class="chat-head">
        <a href="#matches" class="icon-btn" aria-label="Back">←</a>
        ${avatar(them, 'sm')}
        <div class="grow"><strong>${esc(them.display_name)}</strong>
          <div class="muted small ellipsis">${esc((them.games || []).map((g) => g.game).join(' · '))}</div></div>
        <button class="icon-btn" data-act="more" aria-label="Options">⋯</button>
      </div>
      <div class="messages" id="messages"></div>
      <form class="composer" id="composer">
        <input name="body" autocomplete="off" maxlength="2000" placeholder="Message ${esc(them.display_name)}…" required>
        <button class="btn primary" type="submit">Send</button>
      </form>
    </div>`;

  const $list = $app.querySelector('#messages');
  const seen = new Set();
  const add = (msg) => {
    if (seen.has(msg.id)) return;
    seen.add(msg.id);
    $list.querySelector('p.center')?.remove();
    const mine = msg.sender === api.userId;
    $list.insertAdjacentHTML('beforeend', `<div class="bubble ${mine ? 'mine' : ''}">${esc(msg.body)}</div>`);
    $list.scrollTop = $list.scrollHeight;
  };

  if (!(await guard(() => api.getMessages(m.match_id)) || []).map(add).length) {
    $list.innerHTML = `<p class="muted center small">You matched with ${esc(them.display_name)}. Ask what they’re playing tonight.</p>`;
  }
  cleanup = api.subscribeMessages(m.match_id, add);

  $app.querySelector('[data-act=more]').onclick = () => safetyMenu(them, () => { location.hash = 'matches'; }, m.match_id);

  $app.querySelector('#composer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.body;
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    const msg = await guard(() => api.sendMessage(m.match_id, body));
    if (msg) add(msg);
    input.focus();
  });
}

// ---------- start ----------

api.onAuthChange(() => route());
window.addEventListener('hashchange', route);
route();
