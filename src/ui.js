// Screens: title, controls, options, story, world map, shop, party, deploy,
// battle HUD, results, game over, ending. DOM only; no Three.js here.
import { BUILD_INFO } from './config.js';
import { JOBS, EQUIPMENT, ABILITIES, STORY, SHOP_STOCK, SHOP_STOCK_CH3, SHOP_STOCK_CH4, PROPOSITIONS } from './data.js';
import { jobUnlocked, computeStats, learnCost, hireCost } from './state.js';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export class UI {
  constructor(root) {
    this.root = root;
    this.diagEl = document.getElementById('diag');
    this.toastWrap = document.getElementById('toast-wrap');
    this.audio = null;
  }

  setAudio(audio) { this.audio = audio; }
  click(id = 'confirm') { if (this.audio) this.audio.playSfx(id); }

  clear() { this.root.innerHTML = ''; }

  toast(msg, ms = 2200) {
    const t = el(`<div class="toast"></div>`);
    t.textContent = msg;
    this.toastWrap.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  setDiag(text) {
    if (this.diagEl) this.diagEl.textContent = text;
  }

  showDiag(v) {
    if (this.diagEl) this.diagEl.classList.toggle('hidden', !v);
    document.getElementById('corner-btns')?.classList.toggle('diag-on', !!v);
  }

  // ---------- title ----------
  showTitle({ canContinue, onNew, onContinue, onControls, onOptions }) {
    this.clear();
    const s = el(`<div class="screen" id="title-screen">
      <div class="title-block">
        <h1 class="game-title">CROWNFALL</h1>
        <div class="game-sub">T A C T I C S &nbsp;—&nbsp; a Lion War story</div>
        <div class="btn-row" style="flex-direction:column;align-items:stretch;max-width:300px;margin:0 auto;">
          ${canContinue ? '<button class="primary" data-a="continue">Continue Campaign</button>' : ''}
          <button class="${canContinue ? '' : 'primary'}" data-a="new">New Campaign</button>
          <button data-a="controls">Controls</button>
          <button data-a="options">Options</button>
        </div>
        <div class="title-credit">
          An original tactical RPG inspired by Final Fantasy Tactics (PS1).<br>
          Generated ${BUILD_INFO.date} · Built by ${BUILD_INFO.model}<br>
          v${BUILD_INFO.version} · Internal test build — placeholder audio
        </div>
      </div>
    </div>`);
    s.querySelector('[data-a="new"]').onclick = () => { this.click(); onNew(); };
    s.querySelector('[data-a="controls"]').onclick = () => { this.click('cursor'); onControls(); };
    s.querySelector('[data-a="options"]').onclick = () => { this.click('cursor'); onOptions(); };
    const c = s.querySelector('[data-a="continue"]');
    if (c) c.onclick = () => { this.click(); onContinue(); };
    this.root.appendChild(s);
  }

  // ---------- controls reference ----------
  showControls(onBack) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>Controls</h2>
      <p><b>Goal:</b> move each unit on its turn, strike with weapons and magicks, and rout the enemy. Units act in Speed (CT) order — watch the AT list.</p>
      <table class="stat-table">
        <tr><td>Select tile / unit</td><td>Click or tap</td></tr>
        <tr><td>Rotate camera</td><td>Drag, or Q / E</td></tr>
        <tr><td>Zoom</td><td>Wheel, or pinch</td></tr>
        <tr><td>Pan camera</td><td>Right-drag, Shift-drag, arrows / WASD, or two-finger drag</td></tr>
        <tr><td>Cancel targeting</td><td>Right-click, Esc, or Cancel button</td></tr>
        <tr><td>End unit turn</td><td>Wait button</td></tr>
      </table>
      <p class="dim">Touch: tap tiles to move and target. Drag to orbit. Pinch to zoom. Every decision from the desktop game is available on touch.</p>
      <p class="dim">Charge times (CTR): casters recover more slowly after big spells — shown as negative CT in the AT list. KO'd units crystallize after 3 rounds unless revived.</p>
      <p class="dim">Facing matters: the arrow by a unit's name shows where it looks. Striking from behind deals +30% and cannot miss. Thieves poach felled monsters for goods — sometimes rare ones. Some battlefields hide Move-Find-Item caches: end a move on the right tile.</p>
      <div class="btn-row"><button class="primary" data-a="back">Back</button></div>
    </div></div>`);
    s.querySelector('[data-a="back"]').onclick = () => { this.click('cancel'); onBack(); };
    this.root.appendChild(s);
  }

  // ---------- options ----------
  showOptions(opts, { onChange, onBack }) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>Options</h2>
      <label class="opt"><span>Quality preset</span>
        <select data-o="quality">
          <option value="auto">Auto (measured)</option>
          <option value="high">High</option>
          <option value="balanced">Balanced</option>
        </select>
      </label>
      <small class="hint">Auto measures frame rate and switches between High and Balanced. High adds full resolution, larger shadows, and bloom; Balanced cuts resolution, bloom, and physics debris.</small>
      <label class="opt"><span>Volume</span>
        <input type="range" data-o="volume" min="0" max="100" value="${Math.round(opts.volume * 100)}" style="flex:1">
      </label>
      <label class="opt"><span>Mute</span>
        <select data-o="muted"><option value="0">Off</option><option value="1">On</option></select>
      </label>
      <label class="opt"><span>Fullscreen</span>
        <select data-o="fullscreen"><option value="0">Windowed</option><option value="1">Fullscreen</option></select>
      </label>
      <label class="opt"><span>Diagnostics overlay</span>
        <select data-o="showDiag"><option value="1">Show</option><option value="0">Hide</option></select>
      </label>
      <label class="opt"><span>Camera speed</span>
        <input type="range" data-o="cameraSpeed" min="40" max="200" value="${Math.round(opts.cameraSpeed * 100)}" style="flex:1">
      </label>
      <div class="btn-row"><button class="primary" data-a="back">Back</button></div>
    </div></div>`);
    s.querySelector('[data-o="quality"]').value = opts.quality;
    s.querySelector('[data-o="muted"]').value = opts.muted ? '1' : '0';
    s.querySelector('[data-o="fullscreen"]').value = opts.fullscreen ? '1' : '0';
    s.querySelector('[data-o="showDiag"]').value = opts.showDiag ? '1' : '0';
    s.querySelectorAll('[data-o]').forEach((inp) => {
      inp.onchange = () => {
        const k = inp.dataset.o;
        let v = inp.value;
        if (k === 'volume') v = inp.value / 100;
        if (k === 'cameraSpeed') v = inp.value / 100;
        if (k === 'muted' || k === 'fullscreen' || k === 'showDiag') v = inp.value === '1';
        onChange(k, v);
      };
    });
    s.querySelector('[data-a="back"]').onclick = () => { this.click('cancel'); onBack(); };
    this.root.appendChild(s);
  }

  // ---------- story ----------
  showStory(title, lines, { onDone }) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>${escapeHtml(title)}</h2>
      <div class="story-text">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>
      <div class="btn-row"><button class="primary" data-a="next">Continue</button></div>
    </div></div>`);
    s.querySelector('[data-a="next"]').onclick = () => { this.click(); onDone(); };
    this.root.appendChild(s);
  }

  // ---------- world map ----------
  showWorld(campaign, battles, errands, { onBattle, onErrand, onShop, onParty, onTavern, onOptions, onTitle }) {
    this.clear();
    const cur = battles[campaign.battleIndex];
    const chapter = cur ? cur.chapter : 4;
    const node = (b, i, state) => `
      <div class="map-node ${state}" data-b="${i}">
        <div><div class="ch">CHAPTER ${b.chapter}${b.boss ? ' · BOSS' : ''}</div>
        <div class="nm">${escapeHtml(b.name)}</div></div>
        <div>${state === 'done' ? '✓' : state === 'current' ? '▶' : '🔒'}</div>
      </div>`;
    const errHtml = errands.map((e, i) => `
      <div class="map-node ${e.done ? 'done' : e.open ? 'current' : 'locked'}" data-e="${i}">
        <div><div class="ch">ERRAND · TAVERN</div>
        <div class="nm">${escapeHtml(e.name)}</div></div>
        <div>${e.done ? '✓' : e.open ? '▶' : '🔒'}</div>
      </div>`).join('');
    const s = el(`<div class="screen"><div class="panel">
      <h2>Crownfall — World Map</h2>
      <div class="chapter-banner">${escapeHtml(STORY.chapters[chapter] || '')}</div>
      <div class="spread"><span>Gil: <b style="color:var(--gold)">${campaign.gil} G</b></span>
      <span class="dim">Company: ${campaign.party.length} · Next: ${cur ? escapeHtml(cur.name) : '—'}</span></div>
      <div class="map-list">
        ${battles.map((b, i) => node(b, i, i < campaign.battleIndex ? 'done' : i === campaign.battleIndex ? 'current' : 'locked')).join('')}
      </div>
      <div class="chapter-banner">Tavern Errands (optional)</div>
      <div class="map-list">${errHtml}</div>
      <div class="btn-row">
        <button class="primary" data-a="fight" ${cur ? '' : 'disabled'}>To Battle: ${cur ? escapeHtml(cur.name) : '—'}</button>
        <button data-a="shop">Shop</button>
        <button data-a="party">Party</button>
        <button data-a="tavern">Tavern</button>
        <button data-a="options">Options</button>
        <button data-a="title">Title</button>
      </div>
      <p class="dim">Progress saves automatically after each battle. Shop stocks improve in Chapters 3–4. The tavern hires soldiers and posts dispatch commissions.</p>
    </div></div>`);
    s.querySelector('[data-a="fight"]').onclick = () => { this.click(); onBattle(); };
    s.querySelector('[data-a="shop"]').onclick = () => { this.click('cursor'); onShop(); };
    s.querySelector('[data-a="party"]').onclick = () => { this.click('cursor'); onParty(); };
    s.querySelector('[data-a="tavern"]').onclick = () => { this.click('cursor'); onTavern(); };
    s.querySelector('[data-a="options"]').onclick = () => { this.click('cursor'); onOptions(); };
    s.querySelector('[data-a="title"]').onclick = () => { this.click('cancel'); onTitle(); };
    s.querySelectorAll('[data-e]').forEach((n) => {
      n.onclick = () => {
        const e = errands[+n.dataset.e];
        if (e.open && !e.done) { this.click(); onErrand(e.id); }
        else this.toast(e.done ? 'Errand complete.' : 'Finish more story battles to unlock this errand.');
      };
    });
    this.root.appendChild(s);
  }

  // ---------- shop ----------
  showShop(campaign, chapter, { onBuy, onBack }) {
    this.clear();
    const stock = [...SHOP_STOCK, ...(chapter >= 3 ? SHOP_STOCK_CH3 : []), ...(chapter >= 4 ? SHOP_STOCK_CH4 : [])];
    const items = stock.map((id) => EQUIPMENT[id]);
    const s = el(`<div class="screen"><div class="panel">
      <h2>Outfitter</h2>
      <div class="spread"><span>Gil: <b style="color:var(--gold)" data-g>${campaign.gil} G</b></span><span class="dim">Tap Buy to purchase</span></div>
      <div data-list>
        ${items.map((e) => `
          <div class="shop-item">
            <div class="inf"><div class="n">${escapeHtml(e.name)} — ${e.price} G</div>
            <div class="d">${escapeHtml(e.desc)}${e.slot === 'item' ? ` (Own: ${campaign.inventory[e.id] || 0})` : ''}</div></div>
            <button data-buy="${e.id}" ${campaign.gil >= e.price ? '' : 'disabled'}>Buy</button>
          </div>`).join('')}
      </div>
      <div class="btn-row"><button class="primary" data-a="back">Back to Map</button></div>
    </div></div>`);
    s.querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = () => {
        const ok = onBuy(b.dataset.buy);
        if (ok) {
          this.click('gil');
          s.querySelector('[data-g]').textContent = `${campaign.gil} G`;
          const e = EQUIPMENT[b.dataset.buy];
          if (e.slot === 'item') b.closest('.shop-item').querySelector('.d').textContent = `${e.desc} (Own: ${campaign.inventory[e.id] || 0})`;
          if (campaign.gil < e.price) b.disabled = true;
        } else {
          this.click('cancel');
          this.toast('Not enough gil.');
        }
      };
    });
    s.querySelector('[data-a="back"]').onclick = () => { this.click('cancel'); onBack(); };
    this.root.appendChild(s);
  }

  // ---------- tavern ----------
  showTavern(campaign, { onHire, onDispatch, onBack }) {
    this.clear();
    const cost = hireCost(campaign.battleIndex);
    const offers = campaign.hireOffers || [];
    const reserves = campaign.reserves || [];
    const away = campaign.dispatches || [];
    const s = el(`<div class="screen"><div class="panel">
      <h2>Tavern Hall</h2>
      <div class="spread"><span>Gil: <b style="color:var(--gold)">${campaign.gil} G</b></span>
      <span class="dim">Hire: ${cost} G each</span></div>
      <div class="chapter-banner">Swords for hire</div>
      ${offers.map((o, i) => `
        <div class="shop-item"><div class="inf">
          <div class="n">${escapeHtml(o.name)} — Lv ${o.level} ${JOBS[o.job].name} (${o.gender})</div>
          <div class="d">Joins the reserves. Promote from the Party screen.</div>
        </div><button data-hire="${i}" ${campaign.gil >= cost ? '' : 'disabled'}>Hire</button></div>`).join('')}
      <div class="chapter-banner">Dispatch commissions</div>
      <p class="dim">Send a reserve soldier away for N completed battles. They return with gil, goods, and JP.</p>
      ${reserves.length === 0 ? '<p class="dim">No reserves waiting. Hire swords above.</p>' : reserves.map((u) => `
        <div class="shop-item"><div class="inf">
          <div class="n">${escapeHtml(u.name)} — Lv ${u.level} ${JOBS[u.job].name}</div>
          <div class="d"><select data-prop="${u.uid}">
            ${PROPOSITIONS.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${p.days} battle${p.days > 1 ? 's' : ''}, Lv ${p.minLevel}+, ${p.gil} G + ${p.jp} JP</option>`).join('')}
          </select></div>
        </div><button data-send="${u.uid}">Send</button></div>`).join('')}
      ${away.length ? `<div class="chapter-banner">Away</div>` + away.map((d) => {
        const p = PROPOSITIONS.find((x) => x.id === d.propId);
        return `<div class="shop-item"><div class="inf"><div class="n">${escapeHtml(d.name)} — ${escapeHtml(p ? p.name : d.propId)}</div>
          <div class="d">Returns in ${d.battlesLeft} battle${d.battlesLeft > 1 ? 's' : ''}.</div></div></div>`;
      }).join('') : ''}
      <div class="btn-row"><button class="primary" data-a="back">Back to Map</button></div>
    </div></div>`);
    s.querySelectorAll('[data-hire]').forEach((b) => {
      b.onclick = () => {
        const u = onHire(+b.dataset.hire);
        if (u) { this.click('gil'); this.toast(`${u.name} joined the reserves!`); this.showTavern(campaign, { onHire, onDispatch, onBack }); }
        else { this.click('cancel'); this.toast('Not enough gil.'); }
      };
    });
    s.querySelectorAll('[data-send]').forEach((b) => {
      b.onclick = () => {
        const propId = s.querySelector(`[data-prop="${b.dataset.send}"]`).value;
        const err = onDispatch(+b.dataset.send, propId);
        if (!err) { this.click(); this.showTavern(campaign, { onHire, onDispatch, onBack }); }
        else { this.click('cancel'); this.toast(err); }
      };
    });
    s.querySelector('[data-a="back"]').onclick = () => { this.click('cancel'); onBack(); };
    this.root.appendChild(s);
  }

  // ---------- party ----------
  showParty(campaign, { onJob, onEquip, onLearn, onPromote, onBack }) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>Company</h2>
      <div data-list>
        ${campaign.party.map((u) => {
          computeStats(u);
          const job = JOBS[u.job];
          const eq = (slot) => (u.equipment[slot] ? EQUIPMENT[u.equipment[slot]].name : '—');
          return `<div class="party-member" style="flex-direction:column;align-items:stretch;">
            <div class="spread"><b>${escapeHtml(u.name)}</b><span class="dim">Lv ${u.level} ${job.name} · ${u.gender}</span></div>
            <table class="stat-table">
              <tr><td>HP / MP</td><td>${u.hp}/${u.maxHp} · ${u.mp}/${u.maxMp}</td></tr>
              <tr><td>PA / MA / SP</td><td>${u.pa} / ${u.ma} / ${u.sp}</td></tr>
              <tr><td>Brave / Faith</td><td>${u.brave} / ${u.faith}</td></tr>
              <tr><td>Weapon</td><td>${escapeHtml(eq('weapon'))}</td></tr>
              <tr><td>Offhand / Body / Head / Trinket</td><td>${escapeHtml(eq('offhand'))} / ${escapeHtml(eq('body'))} / ${escapeHtml(eq('head'))} / ${escapeHtml(eq('acc'))}</td></tr>
              <tr><td>Job points (${job.name})</td><td>${u.jp[u.job] || 0} JP</td></tr>
            </table>
            <div class="row">
              <select data-job="${u.uid}">
                ${Object.values(JOBS).map((j) => `<option value="${j.id}" ${j.id === u.job ? 'selected' : ''}>${j.name}${jobUnlocked(campaign.party, u, j.id) ? '' : ` (needs ${j.requires.jp} ${JOBS[j.requires.job].name} JP)`}</option>`).join('')}
              </select>
              <select data-eqslot="${u.uid}">
                <option value="weapon">Weapon</option><option value="offhand">Offhand</option>
                <option value="body">Body</option><option value="head">Head</option><option value="acc">Trinket</option>
              </select>
              <select data-eq="${u.uid}"></select>
            </div>
            <div class="bar-label">Train (${job.name} JP: ${u.jp[u.job] || 0}) — learned arts carry between jobs:</div>
            <div class="row" data-train="${u.uid}">
              ${job.abilities.slice(2).map((ab) => {
                const known = u.learned && u.learned[ab];
                const cost = learnCost(ab);
                return `<button data-learn="${ab}" ${known ? 'disabled' : ''}>${escapeHtml(ABILITIES[ab].name)}${known ? ' ✓' : ` (${cost} JP)`}</button>`;
              }).join('') || '<span class="dim">Nothing left to learn here.</span>'}
            </div>
          </div>`;
        }).join('')}
      </div>
      <p class="dim">Changing jobs keeps learned JP. Equipment comes from the company stores — anything you have bought can be worn by anyone who can equip it.</p>
      <div class="chapter-banner">Reserves (${(campaign.reserves || []).length})</div>
      ${(campaign.reserves || []).length === 0 ? '<p class="dim">No reserves. Hire soldiers at the tavern.</p>' : (campaign.reserves || []).map((u) => `
        <div class="shop-item"><div class="inf">
          <div class="n">${escapeHtml(u.name)} — Lv ${u.level} ${JOBS[u.job].name}</div>
          <div class="d">HP ${u.maxHp} · PA ${u.pa} MA ${u.ma} SP ${u.sp}</div>
        </div><button data-promote="${u.uid}" ${campaign.party.length >= 8 ? 'disabled' : ''}>To Party</button></div>`).join('')}
      <div class="btn-row"><button class="primary" data-a="back">Back to Map</button></div>
    </div></div>`);
    const refreshEq = (uid) => {
      const u = campaign.party.find((x) => x.uid === +uid);
      const slotSel = s.querySelector(`[data-eqslot="${uid}"]`);
      const eqSel = s.querySelector(`[data-eq="${uid}"]`);
      const job = JOBS[u.job];
      const owned = ownedEquipment(campaign);
      const opts = owned.filter((id) => {
        const e = EQUIPMENT[id];
        return e.slot === slotSel.value && (e.slot === 'acc' || job.equip.includes(e.type) || (e.slot === slotSel.value && slotSel.value !== 'weapon' && slotSel.value !== 'body' && slotSel.value !== 'head' && slotSel.value !== 'offhand'));
      });
      // body/head/offhand: allow if job equip list includes type OR slot is generic
      eqSel.innerHTML = `<option value="">— unequip —</option>` + owned
        .filter((id) => EQUIPMENT[id].slot === slotSel.value)
        .filter((id) => {
          const e = EQUIPMENT[id];
          if (e.slot === 'acc') return true;
          return job.equip.includes(e.type);
        })
        .map((id) => `<option value="${id}" ${u.equipment[slotSel.value] === id ? 'selected' : ''}>${EQUIPMENT[id].name}</option>`).join('');
      void opts;
    };
    s.querySelectorAll('[data-eqslot]').forEach((sel) => {
      refreshEq(sel.dataset.eqslot);
      sel.onchange = () => refreshEq(sel.dataset.eqslot);
    });
    s.querySelectorAll('[data-eq]').forEach((sel) => {
      sel.onchange = () => {
        const slot = s.querySelector(`[data-eqslot="${sel.dataset.eq}"]`).value;
        onEquip(+sel.dataset.eq, slot, sel.value || null);
        this.click('cursor');
      };
    });
    s.querySelectorAll('[data-job]').forEach((sel) => {
      sel.onchange = () => {
        const ok = onJob(+sel.dataset.job, sel.value);
        if (!ok) {
          this.click('cancel');
          this.toast('Job locked: earn more JP in the required job first.');
          const u = campaign.party.find((x) => x.uid === +sel.dataset.job);
          sel.value = u.job;
        } else {
          this.click();
          this.showParty(campaign, { onJob, onEquip, onLearn, onPromote, onBack });
        }
      };
    });
    s.querySelectorAll('[data-promote]').forEach((btn) => {
      btn.onclick = () => {
        const ok = onPromote(+btn.dataset.promote);
        if (ok) {
          this.click();
          this.showParty(campaign, { onJob, onEquip, onLearn, onPromote, onBack });
        } else {
          this.click('cancel');
          this.toast('The party is full (8).');
        }
      };
    });
    s.querySelectorAll('[data-learn]').forEach((btn) => {
      btn.onclick = () => {
        const wrap = btn.closest('[data-train]');
        const ok = onLearn(+wrap.dataset.train, btn.dataset.learn);
        if (ok) {
          this.click('levelup');
          this.showParty(campaign, { onJob, onEquip, onLearn, onPromote, onBack });
        } else {
          this.click('cancel');
          this.toast('Not enough JP in the current job.');
        }
      };
    });
    s.querySelector('[data-a="back"]').onclick = () => { this.click('cancel'); onBack(); };
    this.root.appendChild(s);
  }

  // ---------- deploy ----------
  showDeploy(campaign, def, { onStart, onBack }) {
    this.clear();
    const sel = new Set(campaign.party.slice(0, def.deployMax).map((u) => u.uid));
    const s = el(`<div class="screen"><div class="panel">
      <h2>${escapeHtml(def.name)}</h2>
      <p>${escapeHtml(def.brief)}</p>
      <p><b>Objective:</b> ${escapeHtml(def.objective)}</p>
      <p class="dim">Choose up to ${def.deployMax} units to deploy.</p>
      <div data-list>
        ${campaign.party.map((u) => `
          <label class="shop-item" style="cursor:pointer;">
            <input type="checkbox" data-u="${u.uid}" ${sel.has(u.uid) ? 'checked' : ''}>
            <div class="inf"><div class="n">${escapeHtml(u.name)} — Lv ${u.level} ${JOBS[u.job].name}</div>
            <div class="d">HP ${u.maxHp} · PA ${u.pa} MA ${u.ma} SP ${u.sp}</div></div>
          </label>`).join('')}
      </div>
      <div class="btn-row">
        <button class="primary" data-a="start">Begin Battle</button>
        <button data-a="back">Back</button>
      </div>
    </div></div>`);
    s.querySelectorAll('[data-u]').forEach((c) => {
      c.onchange = () => {
        if (c.checked) {
          if (sel.size >= def.deployMax) { c.checked = false; this.toast(`Only ${def.deployMax} may deploy.`); return; }
          sel.add(+c.dataset.u);
        } else sel.delete(+c.dataset.u);
        if (sel.size === 0) { c.checked = true; sel.add(+c.dataset.u); this.toast('Deploy at least one unit.'); }
      };
    });
    s.querySelector('[data-a="start"]').onclick = () => { this.click(); onStart([...sel]); };
    s.querySelector('[data-a="back"]').onclick = () => { this.click('cancel'); onBack(); };
    this.root.appendChild(s);
  }

  // ---------- results ----------
  showResults(rewards, treasure, { title, onDone }) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>${escapeHtml(title)}</h2>
      <div class="reward-row"><span>Spoils of war</span><b style="color:var(--gold)">+${rewards.gil} G</b></div>
      ${rewards.gains.map((g) => `
        <div class="reward-row"><span>${escapeHtml(g.name)} — +${g.xp} XP, +${g.jp} JP</span>
        ${g.leveled ? `<span class="lv">LEVEL ${g.level}!</span>` : '<span class="dim"></span>'}</div>`).join('')}
      ${treasure.length ? `<p class="dim">Treasure claimed: ${treasure.map((t) => EQUIPMENT[t] ? EQUIPMENT[t].name : t).join(', ')}</p>` : ''}
      <div class="btn-row"><button class="primary" data-a="next">Continue</button></div>
    </div></div>`);
    s.querySelector('[data-a="next"]').onclick = () => { this.click(); onDone(); };
    this.root.appendChild(s);
  }

  showGameOver({ onRetry, onMap }) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>Defeat</h2>
      <p>The company breaks and flees into the hills. The stones wait, patient as ever.</p>
      <div class="btn-row">
        <button class="primary" data-a="retry">Retry Battle</button>
        <button data-a="map">Return to Map</button>
      </div>
    </div></div>`);
    s.querySelector('[data-a="retry"]').onclick = () => { this.click(); onRetry(); };
    s.querySelector('[data-a="map"]').onclick = () => { this.click('cancel'); onMap(); };
    this.root.appendChild(s);
  }

  showEnding({ onDone }) {
    this.clear();
    const s = el(`<div class="screen"><div class="panel">
      <h2>Crownfall Tactics — Epilogue</h2>
      <div class="story-text">${STORY.ending.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>
      <p class="dim">Thank you for playing. Generated ${BUILD_INFO.date} · ${BUILD_INFO.model}</p>
      <div class="btn-row"><button class="primary" data-a="done">Return to Title</button></div>
    </div></div>`);
    s.querySelector('[data-a="done"]').onclick = () => { this.click(); onDone(); };
    this.root.appendChild(s);
  }

  mountBattleHud() {
    this.clear();
    const hud = el(`<div id="battle-hud">
      <div id="turn-banner" style="display:none"><div class="who"></div><div class="what"></div></div>
      <div id="at-list"><div class="hd">TURN ORDER</div><div data-1></div></div>
      <div id="unit-card" style="display:none"></div>
      <div id="battle-log"></div>
      <div id="hint-bar"></div>
      <div id="action-menu" style="display:none"></div>
    </div>`);
    this.root.appendChild(hud);
    return new BattleHud(hud, this);
  }
}

export function ownedEquipment(campaign) {
  const have = new Set();
  for (const id of Object.keys(EQUIPMENT)) {
    const e = EQUIPMENT[id];
    if (e.slot === 'item') continue;
  }
  // Everything ever bought is tracked in campaign.stores.
  for (const id of campaign.stores || []) have.add(id);
  // Starter gear counts as owned.
  for (const u of campaign.party) {
    for (const v of Object.values(u.equipment || {})) if (v) have.add(v);
  }
  // Defaults available from the start.
  for (const id of ['dagger', 'short_sword', 'longbow', 'rod', 'buckler', 'linen', 'cloth_hat']) have.add(id);
  return [...have];
}

// Battle HUD controller: menus, banners, log, floaters.
class BattleHud {
  constructor(root, ui) {
    this.root = root;
    this.ui = ui;
    this.banner = root.querySelector('#turn-banner');
    this.order = root.querySelector('#at-list [data-1]');
    this.card = root.querySelector('#unit-card');
    this.log = root.querySelector('#battle-log');
    this.menu = root.querySelector('#action-menu');
    this.hint = root.querySelector('#hint-bar');
  }

  setTurn(unit) {
    this.banner.style.display = '';
    this.banner.querySelector('.who').textContent = `${unit.name} — ${unit.monster ? 'Monster' : JOBS[unit.job].name}`;
    this.banner.querySelector('.what').textContent = unit.side === 'player'
      ? `Lv ${unit.level} · HP ${unit.hp}/${unit.maxHp} · MP ${unit.mp}/${unit.maxMp} · CT ${Math.max(0, Math.floor(unit.ct))}`
      : `Enemy · HP ${unit.hp}/${unit.maxHp}`;
    this.showCard(unit);
  }

  setOrder(list) {
    this.order.innerHTML = list.slice(0, 6).map((u) =>
      `<div class="${u.side === 'player' ? 'friend' : 'foe'}">${escapeHtml(u.name)} <span style="opacity:.7">${Math.max(0, Math.floor(u.ct))}</span></div>`).join('');
  }

  showCard(unit) {
    this.card.style.display = '';
    const sts = Object.keys(unit.statuses || {});
    const face = unit.fx === 1 ? '▶' : unit.fx === -1 ? '◀' : unit.fz === 1 ? '▼' : '▲';
    this.card.innerHTML = `
      <div class="nm">${escapeHtml(unit.name)} <span style="color:var(--gold)" title="Facing — back attacks hurt">${face}</span></div>
      <div class="bar-label">${unit.monster ? 'Monster' : JOBS[unit.job].name} Lv ${unit.level}${unit.boss ? ' · BOSS' : ''}</div>
      <div class="bars">
        <div class="bar-label">HP ${unit.hp}/${unit.maxHp}</div>
        <div class="bar hp"><div style="width:${(100 * unit.hp / Math.max(1, unit.maxHp)).toFixed(0)}%"></div></div>
        <div class="bar-label">MP ${unit.mp}/${unit.maxMp}</div>
        <div class="bar mp"><div style="width:${unit.maxMp ? (100 * unit.mp / unit.maxMp).toFixed(0) : 0}%"></div></div>
      </div>
      ${sts.length ? `<div class="bar-label">Status: ${sts.join(', ')}</div>` : ''}
      ${!unit.alive ? `<div class="bar-label">KO — crystallizes in ${unit.koTimer}</div>` : ''}`;
  }

  hideCard() { this.card.style.display = 'none'; }

  logMsg(text) {
    const d = document.createElement('div');
    d.textContent = text;
    this.log.prepend(d);
    while (this.log.children.length > 6) this.log.lastChild.remove();
  }

  showHint(text, ms = 4000) {
    this.hint.textContent = text;
    this.hint.style.display = 'block';
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => { this.hint.style.display = 'none'; }, ms);
  }

  // Player command menu for `unit`. Callbacks wire into Battle.
  showMenu(unit, battle) {
    const m = this.menu;
    m.style.display = '';
    const abs = battle.usableAbilities();
    m.innerHTML = `
      <div class="btn-row">
        <button data-c="move" ${battle.moved ? 'disabled' : ''}>Move</button>
        <button data-c="act" ${battle.acted ? 'disabled' : ''}>Act</button>
        <button data-c="wait">Wait</button>
      </div>
      <div data-sub></div>`;
    const sub = m.querySelector('[data-sub]');
    m.querySelector('[data-c="move"]').onclick = () => { this.ui.click('cursor'); battle.beginMove(); };
    m.querySelector('[data-c="wait"]').onclick = () => { this.ui.click(); battle.doWait(); };
    m.querySelector('[data-c="act"]').onclick = () => {
      this.ui.click('cursor');
      sub.innerHTML = `<div class="ability-grid">${abs.map((a) => `
        <button class="ability-btn" data-ab="${a.id}" ${a.usable ? '' : 'disabled'}>
          <div>${escapeHtml(a.name)} ${a.mp ? `<span class="cost">· ${a.mp} MP</span>` : ''}</div>
          <div class="cost">${escapeHtml(a.desc)}</div>
          ${a.usable ? '' : `<div class="why">${escapeHtml(a.why)}</div>`}
        </button>`).join('')}</div>
        <div class="btn-row"><button data-c="back">Back</button></div>`;
      sub.querySelectorAll('[data-ab]').forEach((b) => {
        b.onclick = () => {
          this.ui.click();
          const a = abs.find((x) => x.id === b.dataset.ab);
          if (a.range === 0) { battle._targetAbility = a.id; battle.doTarget(unit.x, unit.y); }
          else battle.beginTarget(a.id);
        };
      });
      sub.querySelector('[data-c="back"]').onclick = () => { this.ui.click('cancel'); this.showMenu(unit, battle); };
    };
  }

  showTargeting(abilityName, onCancel) {
    const m = this.menu;
    m.style.display = '';
    m.innerHTML = `<div class="spread"><span><b>${escapeHtml(abilityName)}</b> — tap a highlighted tile</span>
      <button data-c="cancel">Cancel</button></div>`;
    m.querySelector('[data-c="cancel"]').onclick = () => { this.ui.click('cancel'); onCancel(); };
  }

  hideMenu() { this.menu.style.display = 'none'; }

  floater(screenX, screenY, text, cls) {
    const f = document.createElement('div');
    f.className = `floater ${cls || ''}`;
    f.textContent = text;
    f.style.left = `${screenX}px`;
    f.style.top = `${screenY}px`;
    this.root.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
