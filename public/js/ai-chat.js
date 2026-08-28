(function(){
  if (window.__mpChatLoaded) return;
  window.__mpChatLoaded = true;

  const styles = `
    .mp-chat-launcher { position: fixed; bottom: 20px; right: 20px; z-index: 120; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .mp-chat-btn { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; border: none; border-radius: 999px; padding: 12px 16px; box-shadow: var(--shadow); cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; transition: transform 0.15s ease, box-shadow 0.2s ease; }
    .mp-chat-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(0,0,0,0.16); }
    .mp-chat-window { width: 380px; max-width: calc(100vw - 24px); background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-light); border-radius: 18px; box-shadow: 0 18px 48px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; }
    .mp-chat-window.open { display: flex; }
    .mp-chat-header { padding: 13px 15px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; display: flex; align-items: center; justify-content: space-between; }
    .mp-chat-brand { display:flex; align-items:center; gap:10px; }
    .mp-chat-avatar { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.18); font-size:18px; }
    .mp-chat-header .title { font-weight: 800; font-size: 0.98rem; }
    .mp-chat-header .subtitle { font-size: 0.72rem; opacity:.78; margin-top:2px; }
    .mp-chat-header button { background: transparent; border: none; color: #fff; cursor: pointer; font-size: 18px; padding: 4px; }
    .mp-chat-body { padding: 12px; height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: var(--bg-1); }
    .mp-chat-msg { padding: 10px 12px; border-radius: 13px; max-width: 90%; box-shadow: 0 6px 18px rgba(0,0,0,0.06); line-height: 1.55; font-size:.94rem; overflow-wrap:anywhere; }
    .mp-chat-msg.user { align-self: flex-end; background: var(--accent-2); color: #fff; border-bottom-right-radius:5px; white-space:pre-wrap; }
    .mp-chat-msg.bot { align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-light); border-bottom-left-radius:5px; }
    .mp-chat-msg.bot p { margin: 0 0 9px; }
    .mp-chat-msg.bot p:last-child { margin-bottom: 0; }
    .mp-chat-msg.bot strong { font-weight: 800; }
    .mp-chat-msg.bot em { font-style: italic; }
    .mp-chat-msg.bot ul, .mp-chat-msg.bot ol { margin: 5px 0 9px 20px; padding: 0; }
    .mp-chat-msg.bot li { margin: 3px 0; }
    .mp-chat-msg.bot .kaitlyn-heading { font-weight: 800; font-size: 1rem; margin: 4px 0 8px; }
    .mp-chat-msg.bot code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .88em; background: rgba(127,127,127,.12); padding: 1px 5px; border-radius: 5px; }
    .mp-chat-typing { display:inline-flex; gap:4px; align-items:center; }
    .mp-chat-typing i { width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.45; animation:mpTyping 1.1s infinite ease-in-out; }
    .mp-chat-typing i:nth-child(2){animation-delay:.15s}.mp-chat-typing i:nth-child(3){animation-delay:.3s}
    @keyframes mpTyping { 0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-3px);opacity:.9} }
    .mp-chat-footer { padding: 10px; border-top: 1px solid var(--border-light); background: var(--card-bg); display: flex; gap: 8px; }
    .mp-chat-footer input { flex: 1; padding: 10px 11px; border-radius: 10px; border: 1px solid var(--border-light); background: var(--card-bg); color: var(--text-primary); min-width:0; }
    .mp-chat-footer button { padding: 10px 14px; border-radius: 10px; border: none; background: var(--accent-2); color: #fff; cursor: pointer; font-weight: 700; }
    @media(max-width:640px){ .mp-chat-window { width: calc(100vw - 24px); } .mp-chat-launcher { right: 12px; bottom: 12px; } }
  `;

  const styleTag = document.createElement('style');
  styleTag.innerHTML = styles;
  document.head.appendChild(styleTag);

  const launcher = document.createElement('div');
  launcher.className = 'mp-chat-launcher';
  const btn = document.createElement('button');
  btn.className = 'mp-chat-btn';
  btn.type = 'button';
  btn.innerHTML = '✨ Ask Kaitlyn';
  launcher.appendChild(btn);

  const win = document.createElement('div');
  win.className = 'mp-chat-window';
  win.innerHTML = `
    <div class="mp-chat-header">
      <div class="mp-chat-brand">
        <div class="mp-chat-avatar">✨</div>
        <div><div class="title">Kaitlyn</div><div class="subtitle">AI learning & client support</div></div>
      </div>
      <button type="button" aria-label="Close chat">✕</button>
    </div>
    <div class="mp-chat-body"></div>
    <form class="mp-chat-footer">
      <input type="text" name="msg" autocomplete="off" maxlength="1000" placeholder="Ask Kaitlyn anything..." />
      <button type="submit">Send</button>
    </form>
  `;
  launcher.appendChild(win);
  document.body.appendChild(launcher);

  const closeBtn = win.querySelector('.mp-chat-header button');
  const body = win.querySelector('.mp-chat-body');
  const form = win.querySelector('.mp-chat-footer');
  const input = form.querySelector('input');
  const sendBtn = form.querySelector('button');
  const history = [];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Render the small, predictable Markdown subset Kaitlyn uses. This keeps the
  // API response safe while turning **bold**, *italic*, bullets and headings
  // into polished HTML instead of displaying raw asterisks to visitors.
  function formatKaitlyn(text) {
    let source = String(text || '').replace(/\r\n?/g, '\n').trim();
    // Remove markdown emphasis markers that sometimes arrive doubled or malformed.
    source = source.replace(/\*{3,}/g, '**');
    const lines = source.split('\n');
    const out = [];
    let listType = null;

    const inline = (value) => {
      let s = escapeHtml(value);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
      s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
      // A final cleanup prevents stray emphasis characters from ever being shown.
      s = s.replace(/\*+/g, '').replace(/(^|\s)_+(?=\s|$)/g, '$1');
      return s;
    };

    const closeList = () => {
      if (listType) { out.push(`</${listType}>`); listType = null; }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      const bullet = line.match(/^\s*[-•]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (heading) {
        closeList();
        out.push(`<div class="kaitlyn-heading">${inline(heading[1])}</div>`);
      } else if (bullet) {
        if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
        out.push(`<li>${inline(bullet[1])}</li>`);
      } else if (numbered) {
        if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
        out.push(`<li>${inline(numbered[1])}</li>`);
      } else if (!line.trim()) {
        closeList();
      } else {
        closeList();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    closeList();
    return out.join('') || '<p></p>';
  }

  const appendMsg = (role, text) => {
    const el = document.createElement('div');
    el.className = `mp-chat-msg ${role}`;
    if (role === 'bot') el.innerHTML = formatKaitlyn(text);
    else el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    const roleForApi = role === 'bot' ? 'assistant' : 'user';
    history.push({ role: roleForApi, content: String(text || '') });
    if (history.length > 12) history.splice(0, history.length - 12);
  };

  const setOpen = (val) => {
    if (val) { win.classList.add('open'); setTimeout(()=>input.focus(), 150); }
    else win.classList.remove('open');
  };

  const showTyping = () => {
    const typing = document.createElement('div');
    typing.className = 'mp-chat-msg bot';
    typing.innerHTML = '<span class="mp-chat-typing"><i></i><i></i><i></i></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
    return typing;
  };

  btn.addEventListener('click', ()=> setOpen(!win.classList.contains('open')));
  closeBtn.addEventListener('click', ()=> setOpen(false));
  appendMsg('bot', 'Hi, I’m Kaitlyn. I can help with learning, tutors, lessons, bookings, resources, accounts and questions about The Modern Pedagogues. What can I help you with?');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const message = input.value.trim();
    if (!message || sendBtn.disabled) return;
    appendMsg('user', message);
    input.value = '';
    sendBtn.disabled = true;
    input.disabled = true;
    const typing = showTyping();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history.slice(-10) })
      });
      const data = await res.json();
      typing.remove();
      if (!res.ok || !data || !data.answer) {
        appendMsg('bot', data.error || 'I’m sorry, I couldn’t complete that request. Please try again or contact our support team.');
        return;
      }
      appendMsg('bot', data.answer);
    } catch (err) {
      typing.remove();
      appendMsg('bot', 'I’m having trouble connecting right now. Please try again in a moment.');
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
})();
