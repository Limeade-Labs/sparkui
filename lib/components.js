'use strict';

const base = require('../templates/base');

/**
 * SparkUI Composable Component Library
 * 
 * Each component returns an HTML string with inline styles and JS.
 * Components are self-contained, dark-themed, responsive, and accessible.
 * Interactive components emit events via window.sparkui.send(type, data).
 */

// ── Unique ID generator for component instances ──
let _idCounter = 0;
function uid(prefix = 'sui') {
  return `${prefix}_${++_idCounter}_${Date.now().toString(36)}`;
}

// ── Style constants ──
const THEME = {
  bg: '#111',
  cardBg: '#1a1a1a',
  border: '#333',
  text: '#e0e0e0',
  textMuted: '#888',
  accent: '#00ff88',
  secondary: '#444',
  danger: '#ff4444',
  radius: '8px',
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
};

// ── 1. Header Component ──

function header(config = {}) {
  const { title = '', subtitle = '', icon = '', badge = '' } = config;
  const badgeHtml = badge
    ? `<span style="background:${THEME.accent};color:#111;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px;margin-left:8px;vertical-align:middle">${esc(badge)}</span>`
    : '';
  const iconHtml = icon
    ? `<span style="font-size:1.8rem;margin-right:8px;vertical-align:middle">${icon}</span>`
    : '';
  const subtitleHtml = subtitle
    ? `<p style="color:${THEME.textMuted};font-size:0.9rem;margin-top:4px">${esc(subtitle)}</p>`
    : '';

  return `<div style="margin-bottom:20px">
  <h1 style="font-size:1.5rem;font-weight:700;color:${THEME.text};margin:0;line-height:1.3">
    ${iconHtml}${esc(title)}${badgeHtml}
  </h1>
  ${subtitleHtml}
</div>`;
}

// ── 2. Button Component ──

function button(config = {}) {
  const { label = 'Button', action = 'click', style = 'primary', icon = '', disabled = false } = config;
  const id = uid('btn');

  const styles = {
    primary: `background:${THEME.accent};color:#111;border:none;font-weight:600`,
    secondary: `background:transparent;color:${THEME.text};border:2px solid ${THEME.secondary}`,
    danger: `background:${THEME.danger};color:#fff;border:none;font-weight:600`,
  };

  const btnStyle = styles[style] || styles.primary;
  const disabledAttr = disabled ? 'disabled' : '';
  const disabledStyle = disabled ? 'opacity:0.5;cursor:not-allowed;' : 'cursor:pointer;';
  const iconHtml = icon ? `<span style="margin-right:6px">${icon}</span>` : '';

  return `<button id="${id}" ${disabledAttr} style="${btnStyle};${disabledStyle}padding:12px 24px;border-radius:${THEME.radius};font-size:1rem;font-family:${THEME.font};display:inline-flex;align-items:center;justify-content:center;transition:opacity 0.15s;width:100%;max-width:320px" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">${iconHtml}${esc(label)}</button>
<script>(function(){var b=document.getElementById('${id}');b&&b.addEventListener('click',function(){if(!b.disabled&&window.sparkui)window.sparkui.send('event',{action:'${escJs(action)}'})});})()</script>`;
}

// ── 3. Timer Component ──

function timer(config = {}) {
  const { mode = 'countdown', duration = 60, intervals = [], autoStart = false, onComplete = '' } = config;
  const id = uid('tmr');

  // Pre-compute intervals JSON
  const intervalsJson = JSON.stringify(intervals.map(i => ({
    label: i.label || 'Work',
    seconds: i.seconds || 30,
  })));

  return `<div id="${id}" style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:24px;text-align:center;margin-bottom:16px">
  <div id="${id}_label" style="font-size:0.85rem;color:${THEME.textMuted};margin-bottom:8px;min-height:1.2em"></div>
  <div id="${id}_display" style="font-size:3rem;font-weight:700;font-variant-numeric:tabular-nums;color:${THEME.text};margin-bottom:16px">00:00</div>
  <div id="${id}_progress" style="height:4px;background:${THEME.secondary};border-radius:2px;margin-bottom:16px;overflow:hidden;display:none">
    <div id="${id}_bar" style="height:100%;background:${THEME.accent};width:0%;transition:width 0.3s"></div>
  </div>
  <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
    <button id="${id}_start" style="background:${THEME.accent};color:#111;border:none;padding:10px 20px;border-radius:${THEME.radius};font-size:0.9rem;font-weight:600;cursor:pointer;font-family:${THEME.font}">Start</button>
    <button id="${id}_pause" style="background:${THEME.secondary};color:${THEME.text};border:none;padding:10px 20px;border-radius:${THEME.radius};font-size:0.9rem;cursor:pointer;font-family:${THEME.font};display:none">Pause</button>
    <button id="${id}_reset" style="background:transparent;color:${THEME.textMuted};border:1px solid ${THEME.border};padding:10px 20px;border-radius:${THEME.radius};font-size:0.9rem;cursor:pointer;font-family:${THEME.font}">Reset</button>
  </div>
</div>
<script>(function(){
  var mode='${escJs(mode)}',dur=${parseInt(duration)||60},intervals=${intervalsJson},autoStart=${!!autoStart};
  var el=document.getElementById('${id}'),display=document.getElementById('${id}_display');
  var label=document.getElementById('${id}_label'),progWrap=document.getElementById('${id}_progress');
  var bar=document.getElementById('${id}_bar');
  var startBtn=document.getElementById('${id}_start'),pauseBtn=document.getElementById('${id}_pause');
  var resetBtn=document.getElementById('${id}_reset');
  var timer=null,elapsed=0,running=false,curInterval=0,intervalElapsed=0;

  function totalDur(){
    if(mode==='interval'){var t=0;for(var i=0;i<intervals.length;i++)t+=intervals[i].seconds;return t||dur;}
    if(mode==='countdown')return dur;
    return 0;
  }

  function fmt(s){var m=Math.floor(s/60);var sec=s%60;return(m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;}

  function currentTarget(){
    if(mode==='countdown')return dur;
    if(mode==='interval'&&intervals.length>0)return intervals[curInterval]?intervals[curInterval].seconds:0;
    return 0;
  }

  function render(){
    if(mode==='stopwatch'){display.textContent=fmt(elapsed);return;}
    if(mode==='countdown'){display.textContent=fmt(Math.max(0,dur-elapsed));progWrap.style.display='block';bar.style.width=(elapsed/dur*100)+'%';return;}
    if(mode==='interval'&&intervals.length>0){
      var ci=intervals[curInterval];
      if(ci){label.textContent=ci.label;display.textContent=fmt(Math.max(0,ci.seconds-intervalElapsed));progWrap.style.display='block';bar.style.width=(intervalElapsed/ci.seconds*100)+'%';}
    }
  }

  function tick(){
    elapsed++;intervalElapsed++;
    if(mode==='countdown'&&elapsed>=dur){stop();done();return;}
    if(mode==='interval'){
      var ci=intervals[curInterval];
      if(ci&&intervalElapsed>=ci.seconds){curInterval++;intervalElapsed=0;if(curInterval>=intervals.length){stop();done();return;}}
    }
    render();
  }

  function start(){if(running)return;running=true;timer=setInterval(tick,1000);startBtn.style.display='none';pauseBtn.style.display='inline-block';render();}
  function pause(){running=false;clearInterval(timer);timer=null;startBtn.style.display='inline-block';startBtn.textContent='Resume';pauseBtn.style.display='none';}
  function stop(){running=false;clearInterval(timer);timer=null;startBtn.style.display='none';pauseBtn.style.display='none';}
  function reset(){stop();elapsed=0;curInterval=0;intervalElapsed=0;startBtn.style.display='inline-block';startBtn.textContent='Start';pauseBtn.style.display='none';label.textContent='';render();}
  function done(){
    display.style.color='${THEME.accent}';
    if(window.sparkui)window.sparkui.send('timer',{action:'complete',mode:mode,elapsed:elapsed});
  }

  startBtn.addEventListener('click',start);
  pauseBtn.addEventListener('click',pause);
  resetBtn.addEventListener('click',reset);
  render();
  if(autoStart)start();
})()</script>`;
}

// ── 4. Checklist Component ──

function checklist(config = {}) {
  const { items = [], allowAdd = false, showProgress = false } = config;
  const id = uid('chk');
  const itemsJson = JSON.stringify(items.map(i => ({
    text: i.text || '',
    checked: !!i.checked,
  })));

  return `<div id="${id}" style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:16px;margin-bottom:16px">
  ${showProgress ? `<div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:${THEME.textMuted};margin-bottom:4px">
      <span id="${id}_count">0 / 0</span><span id="${id}_pct">0%</span>
    </div>
    <div style="height:6px;background:${THEME.secondary};border-radius:3px;overflow:hidden">
      <div id="${id}_bar" style="height:100%;background:${THEME.accent};width:0%;transition:width 0.3s ease"></div>
    </div>
  </div>` : ''}
  <div id="${id}_list"></div>
  ${allowAdd ? `<div style="margin-top:12px;display:flex;gap:8px">
    <input id="${id}_input" type="text" placeholder="Add item..." style="flex:1;background:${THEME.bg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:8px 12px;color:${THEME.text};font-size:0.9rem;font-family:${THEME.font};outline:none" />
    <button id="${id}_add" style="background:${THEME.accent};color:#111;border:none;padding:8px 16px;border-radius:${THEME.radius};font-weight:600;cursor:pointer;font-family:${THEME.font}">+</button>
  </div>` : ''}
</div>
<script>(function(){
  var id='${id}',items=${itemsJson},showProgress=${!!showProgress},allowAdd=${!!allowAdd};
  var list=document.getElementById(id+'_list');
  function render(){
    list.innerHTML='';
    var done=0;
    items.forEach(function(it,i){
      if(it.checked)done++;
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;padding:10px 0;border-bottom:1px solid ${THEME.border};cursor:pointer;transition:opacity 0.2s';
      row.innerHTML='<span style="width:22px;height:22px;border-radius:50%;border:2px solid '+(it.checked?'${THEME.accent}':'${THEME.secondary}')+';display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;transition:all 0.2s">'+(it.checked?'<span style="color:${THEME.accent};font-size:14px">✓</span>':'')+'</span><span style="'+(it.checked?'text-decoration:line-through;color:${THEME.textMuted}':'color:${THEME.text}')+';transition:all 0.2s;font-size:0.95rem">'+escH(it.text)+'</span>';
      row.addEventListener('click',function(){items[i].checked=!items[i].checked;render();
        if(window.sparkui)window.sparkui.send('event',{action:'checklist_toggle',index:i,checked:items[i].checked,text:items[i].text});
        var allDone=items.length>0&&items.every(function(x){return x.checked});
        if(allDone&&window.sparkui)window.sparkui.send('completion',{action:'checklist_complete',items:items});
      });
      list.appendChild(row);
    });
    if(showProgress){
      var pct=items.length?Math.round(done/items.length*100):0;
      var ce=document.getElementById(id+'_count');if(ce)ce.textContent=done+' / '+items.length;
      var pe=document.getElementById(id+'_pct');if(pe)pe.textContent=pct+'%';
      var be=document.getElementById(id+'_bar');if(be)be.style.width=pct+'%';
    }
  }
  function escH(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  render();
  if(allowAdd){
    var inp=document.getElementById(id+'_input'),addBtn=document.getElementById(id+'_add');
    function addItem(){var t=inp.value.trim();if(!t)return;items.push({text:t,checked:false});inp.value='';render();}
    addBtn.addEventListener('click',addItem);
    inp.addEventListener('keydown',function(e){if(e.key==='Enter')addItem();});
  }
})()</script>`;
}

// ── 5. Progress Component ──

function progress(config = {}) {
  const { value = 0, max = 100, label = '', color = THEME.accent, showPercent = true, segments = [] } = config;
  const id = uid('prg');

  if (segments && segments.length > 0) {
    // Multi-segment mode
    const segHtml = segments.map((seg, i) => {
      const segId = `${id}_s${i}`;
      const pct = seg.max ? Math.min(100, Math.round((seg.value / seg.max) * 100)) : 0;
      const segColor = seg.color || THEME.accent;
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
          <span style="color:${THEME.text}">${esc(seg.label || '')}</span>
          <span style="color:${THEME.textMuted}">${seg.value}/${seg.max}${showPercent ? ' ('+pct+'%)' : ''}</span>
        </div>
        <div style="height:8px;background:${THEME.secondary};border-radius:4px;overflow:hidden">
          <div id="${segId}" style="height:100%;background:${segColor};width:0%;border-radius:4px;transition:width 0.8s ease"></div>
        </div>
      </div>`;
    }).join('');

    const animScript = segments.map((seg, i) => {
      const pct = seg.max ? Math.min(100, Math.round((seg.value / seg.max) * 100)) : 0;
      return `setTimeout(function(){var e=document.getElementById('${id}_s${i}');if(e)e.style.width='${pct}%';},50);`;
    }).join('');

    return `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:16px;margin-bottom:16px">
  ${segHtml}
</div>
<script>(function(){${animScript}})()</script>`;
  }

  // Single bar mode
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:16px;margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px">
    <span style="color:${THEME.text}">${esc(label)}</span>
    ${showPercent ? `<span style="color:${THEME.textMuted}">${pct}%</span>` : ''}
  </div>
  <div style="height:8px;background:${THEME.secondary};border-radius:4px;overflow:hidden">
    <div id="${id}_bar" style="height:100%;background:${color};width:0%;border-radius:4px;transition:width 0.8s ease"></div>
  </div>
</div>
<script>(function(){setTimeout(function(){var e=document.getElementById('${id}_bar');if(e)e.style.width='${pct}%';},50);})()</script>`;
}

// ── 6. Stats Grid Component ──

function stats(config = {}) {
  const { items = [] } = config;

  const cards = items.map(item => {
    const trendMap = { up: '↑', down: '↓', flat: '→' };
    const trendColor = { up: THEME.accent, down: THEME.danger, flat: THEME.textMuted };
    const trend = item.trend ? `<span style="color:${trendColor[item.trend] || THEME.textMuted};font-size:0.9rem;margin-left:4px">${trendMap[item.trend] || ''}</span>` : '';
    const iconHtml = item.icon ? `<span style="font-size:1.3rem;margin-bottom:4px;display:block">${item.icon}</span>` : '';
    const unitHtml = item.unit ? `<span style="font-size:0.85rem;color:${THEME.textMuted};margin-left:2px">${esc(item.unit)}</span>` : '';

    return `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:16px;text-align:center">
      ${iconHtml}
      <div style="font-size:1.6rem;font-weight:700;color:${THEME.text};font-variant-numeric:tabular-nums">${esc(String(item.value || '0'))}${unitHtml}${trend}</div>
      <div style="font-size:0.8rem;color:${THEME.textMuted};margin-top:4px">${esc(item.label || '')}</div>
    </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
  ${cards}
</div>`;
}

// ── 7. Form Component ──

function form(config = {}) {
  const { fields = [], submitLabel = 'Submit' } = config;
  const id = uid('frm');
  const fieldsJson = JSON.stringify(fields);

  const fieldHtml = fields.map((f, i) => {
    const fid = `${id}_f${i}`;
    const req = f.required ? '<span style="color:' + THEME.danger + '">*</span>' : '';
    const labelHtml = f.label ? `<label for="${fid}" style="display:block;font-size:0.85rem;color:${THEME.textMuted};margin-bottom:4px">${esc(f.label)} ${req}</label>` : '';
    const inputStyle = `width:100%;background:${THEME.bg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:10px 12px;color:${THEME.text};font-size:0.95rem;font-family:${THEME.font};outline:none;transition:border-color 0.2s`;

    let input = '';
    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${fid}" name="${esc(f.name || '')}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} style="${inputStyle};min-height:80px;resize:vertical" onfocus="this.style.borderColor='${THEME.accent}'" onblur="this.style.borderColor='${THEME.border}'"></textarea>`;
        break;
      case 'select':
        const opts = (f.options || []).map(o => `<option value="${esc(typeof o === 'string' ? o : o.value)}">${esc(typeof o === 'string' ? o : o.label)}</option>`).join('');
        input = `<select id="${fid}" name="${esc(f.name || '')}" ${f.required ? 'required' : ''} style="${inputStyle};cursor:pointer"><option value="">Select...</option>${opts}</select>`;
        break;
      case 'rating':
        input = `<div id="${fid}" data-name="${esc(f.name || '')}" style="display:flex;gap:4px;font-size:1.5rem;cursor:pointer">
          ${[1,2,3,4,5].map(n => `<span data-val="${n}" style="color:${THEME.secondary};transition:color 0.15s" onmouseover="this.parentNode._hover(${n})" onmouseout="this.parentNode._unhover()" onclick="this.parentNode._select(${n})">★</span>`).join('')}
        </div>`;
        break;
      default:
        input = `<input id="${fid}" type="${f.type || 'text'}" name="${esc(f.name || '')}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} style="${inputStyle}" onfocus="this.style.borderColor='${THEME.accent}'" onblur="this.style.borderColor='${THEME.border}'" />`;
    }

    return `<div style="margin-bottom:16px">${labelHtml}${input}</div>`;
  }).join('');

  // Rating fields init script
  const ratingFields = fields.map((f, i) => f.type === 'rating' ? i : -1).filter(i => i >= 0);
  const ratingScript = ratingFields.map(i => {
    const fid = `${id}_f${i}`;
    return `(function(){
      var el=document.getElementById('${fid}'),val=0,stars=el.querySelectorAll('span');
      function paint(n,c){for(var j=0;j<5;j++)stars[j].style.color=j<n?c:'${THEME.secondary}';}
      el._hover=function(n){paint(n,'${THEME.accent}');};
      el._unhover=function(){paint(val,'#f5c518');};
      el._select=function(n){val=n;paint(n,'#f5c518');el.dataset.value=n;};
    })();`;
  }).join('');

  return `<form id="${id}" style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-radius:${THEME.radius};padding:20px;margin-bottom:16px" onsubmit="return false">
  ${fieldHtml}
  <button type="submit" style="background:${THEME.accent};color:#111;border:none;padding:12px 24px;border-radius:${THEME.radius};font-size:1rem;font-weight:600;cursor:pointer;font-family:${THEME.font};width:100%;transition:opacity 0.15s" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">${esc(submitLabel)}</button>
</form>
<script>(function(){
  ${ratingScript}
  var form=document.getElementById('${id}');
  var fields=${fieldsJson};
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var data={};
    fields.forEach(function(f,i){
      var fid='${id}_f'+i;
      var el=document.getElementById(fid);
      if(!el)return;
      if(f.type==='rating'){data[f.name||'rating']=parseInt(el.dataset.value)||0;}
      else{data[f.name||'field_'+i]=el.value;}
    });
    if(window.sparkui)window.sparkui.send('completion',{formData:data});
    // Visual feedback
    var btn=form.querySelector('button[type=submit]');
    if(btn){btn.textContent='✓ Sent';btn.style.background='${THEME.secondary}';btn.disabled=true;}
  });
})()</script>`;
}

// ── 8. Tabs Component ──

function tabs(config = {}) {
  const { tabs: tabList = [], activeIndex = 0 } = config;
  const id = uid('tabs');

  const tabBtns = tabList.map((t, i) => {
    const active = i === activeIndex;
    return `<button class="${id}_tab" data-idx="${i}" style="background:${active ? THEME.cardBg : 'transparent'};color:${active ? THEME.accent : THEME.textMuted};border:none;border-bottom:2px solid ${active ? THEME.accent : 'transparent'};padding:10px 16px;font-size:0.9rem;cursor:pointer;font-family:${THEME.font};transition:all 0.2s;flex:1">${esc(t.label || 'Tab ' + (i + 1))}</button>`;
  }).join('');

  const panels = tabList.map((t, i) => {
    return `<div class="${id}_panel" data-idx="${i}" style="display:${i === activeIndex ? 'block' : 'none'};padding:16px 0">${t.content || ''}</div>`;
  }).join('');

  return `<div style="margin-bottom:16px">
  <div style="display:flex;border-bottom:1px solid ${THEME.border};margin-bottom:0">${tabBtns}</div>
  <div style="background:${THEME.cardBg};border:1px solid ${THEME.border};border-top:none;border-radius:0 0 ${THEME.radius} ${THEME.radius};padding:16px">${panels}</div>
</div>
<script>(function(){
  var tabs=document.querySelectorAll('.${id}_tab'),panels=document.querySelectorAll('.${id}_panel');
  tabs.forEach(function(tab){
    tab.addEventListener('click',function(){
      var idx=parseInt(this.dataset.idx);
      tabs.forEach(function(t,i){
        t.style.background=i===idx?'${THEME.cardBg}':'transparent';
        t.style.color=i===idx?'${THEME.accent}':'${THEME.textMuted}';
        t.style.borderBottomColor=i===idx?'${THEME.accent}':'transparent';
      });
      panels.forEach(function(p,i){p.style.display=i===idx?'block':'none';});
    });
  });
})()</script>`;
}

// ── Compose Function ──

/**
 * Compose a full page from a layout config.
 * @param {object} layout
 * @param {string} layout.title - Page title
 * @param {Array} layout.sections - Array of { type, config } objects
 * @param {object} [layout.openclaw] - OpenClaw webhook config
 * @returns {{ html: string, pushBody: object }}
 */
function compose(layout = {}) {
  const { title = 'SparkUI', sections = [], openclaw = null } = layout;

  const componentMap = {
    header,
    button,
    timer,
    checklist,
    progress,
    stats,
    form,
    tabs,
  };

  // Reset ID counter for deterministic output
  _idCounter = 0;

  const bodyParts = sections.map(section => {
    const fn = componentMap[section.type];
    if (!fn) return `<!-- unknown component: ${esc(section.type)} -->`;
    return fn(section.config || {});
  });

  const bodyHtml = bodyParts.join('\n');

  // Use placeholder for page ID - will be replaced with actual UUID on push
  const html = base({
    title,
    body: bodyHtml,
    id: '__PAGE_ID__',
  });

  const pushBody = {
    html,
    meta: { title, template: 'composed' },
    openclaw: openclaw || undefined,
  };

  return { html, pushBody };
}

// ── Utility ──

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escJs(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

module.exports = {
  header,
  button,
  timer,
  checklist,
  progress,
  stats,
  form,
  tabs,
  compose,
  THEME,
};
