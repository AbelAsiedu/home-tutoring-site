(function(){
  if (window.__mpChatLoaded) return; // prevent double init
  window.__mpChatLoaded = true;

  const styles = `
    .mp-chat-launcher { position: fixed; bottom: 20px; right: 20px; z-index: 120; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .mp-chat-btn { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; border: none; border-radius: 999px; padding: 12px 16px; box-shadow: var(--shadow); cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; transition: transform 0.15s ease, box-shadow 0.2s ease; }
    .mp-chat-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(0,0,0,0.16); }
    .mp-chat-window { width: 320px; max-width: calc(100vw - 32px); background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 16px 36px rgba(0,0,0,0.18); display: none; flex-direction: column; overflow: hidden; }
    .mp-chat-window.open { display: flex; }
    .mp-chat-header { padding: 12px 14px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; display: flex; align-items: center; justify-content: space-between; }
    .mp-chat-header .title { font-weight: 700; font-size: 0.95rem; }
    .mp-chat-header button { background: transparent; border: none; color: #fff; cursor: pointer; font-size: 18px; padding: 4px; }
    .mp-chat-body { padding: 12px; height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: var(--bg-1); }
    .mp-chat-msg { padding: 10px 12px; border-radius: 12px; max-width: 85%; box-shadow: 0 6px 18px rgba(0,0,0,0.06); white-space: pre-line; line-height: 1.45; }
    .mp-chat-msg.user { align-self: flex-end; background: var(--accent-2); color: #fff; }
    .mp-chat-msg.bot { align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-light); }
    .mp-chat-footer { padding: 10px; border-top: 1px solid var(--border-light); background: var(--card-bg); display: flex; gap: 8px; }
    .mp-chat-footer input { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border-light); background: var(--card-bg); color: var(--text-primary); }
    .mp-chat-footer button { padding: 10px 14px; border-radius: 10px; border: none; background: var(--accent-2); color: #fff; cursor: pointer; font-weight: 600; }
    @media(max-width:640px){ .mp-chat-window { width: calc(100vw - 24px); right: 12px; } .mp-chat-launcher { right: 12px; bottom: 12px; } }
  `;

  const styleTag = document.createElement('style');
  styleTag.innerHTML = styles;
  document.head.appendChild(styleTag);

  const launcher = document.createElement('div');
  launcher.className = 'mp-chat-launcher';
  const btn = document.createElement('button');
  btn.className = 'mp-chat-btn';
  btn.type = 'button';
  btn.innerHTML = '🤖 AI Tutor';
  launcher.appendChild(btn);

  const win = document.createElement('div');
  win.className = 'mp-chat-window';
  win.innerHTML = `
    <div class="mp-chat-header">
      <span class="title">AI Tutor (24/7)</span>
      <button type="button" aria-label="Close chat">✕</button>
    </div>
    <div class="mp-chat-body"></div>
    <form class="mp-chat-footer">
      <input type="text" name="msg" autocomplete="off" placeholder="Ask about tutors, lessons, pricing..." />
      <button type="submit">Send</button>
    </form>
  `;
  launcher.appendChild(win);
  document.body.appendChild(launcher);

  const closeBtn = win.querySelector('.mp-chat-header button');
  const body = win.querySelector('.mp-chat-body');
  const form = win.querySelector('.mp-chat-footer');
  const input = form.querySelector('input');
  const history = [];

  const appendMsg = (role, text) => {
    const el = document.createElement('div');
    el.className = `mp-chat-msg ${role}`;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;

    const roleForApi = role === 'bot' ? 'assistant' : 'user';
    history.push({ role: roleForApi, content: String(text || '') });
    if (history.length > 10) history.splice(0, history.length - 10);
  };

  const setOpen = (val) => {
    if (val) {
      win.classList.add('open');
      setTimeout(()=>input.focus(), 150);
    } else {
      win.classList.remove('open');
    }
  };

  btn.addEventListener('click', ()=> setOpen(!win.classList.contains('open')));
  closeBtn.addEventListener('click', ()=> setOpen(false));

  appendMsg('bot', 'Hi! I am your AI tutor. Ask me anything about lessons, pricing, bookings, downloads, account help, or tutor quality.');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    appendMsg('user', message);
    input.value = '';

    // show typing
    const typing = document.createElement('div');
    typing.className = 'mp-chat-msg bot';
    typing.textContent = 'Typing...';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: history.slice(-8)
        })
      });
      const data = await res.json();
      typing.remove();
      if (!res.ok || !data || !data.answer) {
        appendMsg('bot', data.error || 'Sorry, something went wrong. Please try again.');
        return;
      }
      appendMsg('bot', data.answer);
    } catch (err) {
      typing.remove();
      appendMsg('bot', 'Network error. Please check your connection.');
    }
  });
})();
