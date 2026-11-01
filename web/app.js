'use strict';

const $ = (selector) => document.querySelector(selector);
const number = new Intl.NumberFormat('en-US');
const fmt = (value, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '—';
const pct = (value, digits = 1) => Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—';
const signed = (value, digits = 3) => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(digits)}` : '—';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = (value) => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? esc(u.href) : ''; } catch { return ''; } };
const teams = {ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LA:'Los Angeles Rams',LAC:'Los Angeles Chargers',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders'};
let scouting;
let careers;
let lastExport = [];

function setTab(name, focus = false) {
  const valid = ['scouting', 'model', 'careers'];
  if (!valid.includes(name)) name = 'scouting';
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  valid.forEach((id) => { $(`#${id}`).hidden = id !== name || (!scouting && id !== 'careers'); });
  $('#view-label').textContent = name === 'model' ? 'MODEL EVALUATION' : name.toUpperCase();
  history.replaceState(null, '', `#${name}`);
}

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...document.querySelectorAll('[data-tab]')];
    const index = buttons.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    setTab(buttons[next].dataset.tab, true);
  });
});
window.addEventListener('hashchange', () => setTab(location.hash.slice(1)));

function option(value, label = value) { return `<option value="${esc(value)}">${esc(label)}</option>`; }
function aggregate(rows) {
  const result = {n:0, successes:0, epa_sum:0, pass_n:0, run_n:0};
  rows.forEach((r) => { result.n += r.n; result.successes += r.successes; result.epa_sum += r.epa_sum; if (r.play_type === 'pass') result.pass_n += r.n; if (r.play_type === 'run') result.run_n += r.n; });
  result.epa = result.n ? result.epa_sum / result.n : NaN;
  result.success = result.n ? result.successes / result.n : NaN;
  result.pass = result.n ? result.pass_n / result.n : NaN;
  return result;
}
function filters() { return {team:$('#team').value,season:Number($('#season').value),down:$('#down').value,distance:$('#distance').value,field_zone:$('#field-zone').value,play_type:$('#play-type').value}; }
function selectedCells(f) {
  return scouting.cells.filter((r) => r.season === f.season && (f.down === 'all' || r.down === Number(f.down)) && (f.distance === 'all' || r.distance === f.distance) && (f.field_zone === 'all' || r.field_zone === f.field_zone) && (f.play_type === 'all' || r.play_type === f.play_type));
}
function kpi(label, value, detail, accent = false) { return `<article class="kpi"><div class="kpi-label">${label}</div><div class="kpi-number${accent ? ' lime' : ''}">${value}</div><p class="kpi-detail">${detail}</p></article>`; }
function comparison(value, reference, unit = '') {
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return 'No comparable plays';
  const delta = unit === 'pp' ? (value-reference)*100 : value-reference;
  return `<span class="${delta >= 0 ? 'positive' : 'negative'}">${signed(delta, unit === 'pp' ? 1 : 3)}${unit === 'pp' ? ' pp' : ''}</span> vs. rest of league`;
}
function initializeScouting() {
  $('#team').innerHTML = Object.keys(teams).map((t) => option(t, `${t} · ${teams[t]}`)).join('');
  $('#team').value = 'BUF';
  $('#season').innerHTML = [...scouting.seasons].sort((a,b)=>b-a).map((s)=>option(s)).join('');
  $('#distance').insertAdjacentHTML('beforeend', [...new Set(scouting.cells.map((r)=>r.distance))].sort((a,b)=>({Short:0,Medium:1,Long:2}[a.split(' ')[0]] - {Short:0,Medium:1,Long:2}[b.split(' ')[0]])).map((x)=>option(x)).join(''));
  $('#field-zone').insertAdjacentHTML('beforeend', ['Own half','Opponent half','Red zone'].filter((x)=>scouting.cells.some((r)=>r.field_zone===x)).map((x)=>option(x)).join(''));
  ['team','season','down','distance','field-zone','play-type'].forEach((id)=>$(`#${id}`).addEventListener('change',renderScouting));
  $('#reset-filters').addEventListener('click',()=>{ ['down','distance','field-zone','play-type'].forEach((id)=>{$(`#${id}`).value='all';});renderScouting(); });
  $('#export-csv').addEventListener('click', exportCsv);
  $('#attribution').innerHTML = `${esc(scouting.attribution)} <a href="${safeUrl(scouting.source_url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`;
  $('#audit-table').innerHTML = `<table class="mini-table"><caption class="eyebrow">SOURCE → ELIGIBLE SAMPLE AUDIT</caption><thead><tr><th>Season</th><th>Source rows</th><th>Eligible</th><th>Excluded</th><th>Games</th></tr></thead><tbody>${scouting.audit.map((r)=>`<tr><td>${r.season}</td><td>${number.format(r.raw_rows)}</td><td>${number.format(r.eligible_rows)}</td><td>${number.format(r.excluded_rows)}</td><td>${r.games}</td></tr>`).join('')}</tbody></table>`;
  renderScouting(); renderModel();
}

function renderScouting() {
  const f = filters();
  const rows = selectedCells(f);
  const ownRows = rows.filter((r)=>r.team===f.team);
  const own = aggregate(ownRows);
  const league = aggregate(rows.filter((r)=>r.team!==f.team));
  const descriptors = [f.down==='all'?'All downs':`${f.down}${({1:'st',2:'nd',3:'rd',4:'th'})[f.down]} down`,f.distance==='all'?'All distances':f.distance,f.field_zone==='all'?'All field zones':f.field_zone,f.play_type==='all'?'Pass + run':f.play_type==='pass'?'Pass only':'Run only'];
  $('#snapshot-title').textContent = `${teams[f.team]} · ${f.season}`;
  $('#selection-summary').textContent = `${descriptors.join(' / ')} · League reference: ${number.format(league.n)} matching plays, excluding ${f.team}.`;
  const warning = $('#sample-warning');
  warning.hidden = own.n >= 100;
  warning.className = 'notice warning';
  warning.textContent = own.n === 0 ? 'No eligible plays match this selection. Broaden the situation filters to see a comparison.' : `Small sample: ${number.format(own.n)} plays. Treat this slice as a prompt for film review, not a stable ranking.`;
  $('#export-csv').disabled = own.n===0;
  $('#kpis').innerHTML = kpi('Eligible plays',number.format(own.n),`${f.season} regular season · selected situation`,true)+kpi('EPA per play',fmt(own.epa),comparison(own.epa,league.epa))+kpi('Success rate',pct(own.success),comparison(own.success,league.success,'pp'))+kpi('Pass rate',pct(own.pass),own.n ? `${number.format(own.pass_n)} pass / ${number.format(own.run_n)} run plays` : 'No plays in selection');
  $('#leaderboard-note').textContent = `Same ${f.season} situation filters for every team. Bars show play-weighted EPA; hover or focus a row for its sample size.`;
  const ranked = Object.keys(teams).map((t)=>({team:t,...aggregate(rows.filter((r)=>r.team===t))})).filter((r)=>r.n).sort((a,b)=>b.epa-a.epa);
  const min = Math.min(-.05,...ranked.map((r)=>r.epa));
  const max = Math.max(.05,...ranked.map((r)=>r.epa));
  const scale = (v)=>(v-min)/(max-min)*100;
  const zero = scale(0);
  $('#leaderboard').innerHTML = ranked.length ? ranked.map((r,i)=>`<div class="rank-row${r.team===f.team?' selected':''}" tabindex="0" aria-label="${esc(teams[r.team])}, rank ${i+1}, EPA per play ${fmt(r.epa)}, ${number.format(r.n)} plays" title="${esc(teams[r.team])} · ${number.format(r.n)} plays · ${pct(r.success)} success"><span class="rank">${String(i+1).padStart(2,'0')}</span><span class="team-abbr">${r.team}</span><span class="bar-track" style="--zero:${zero}%"><i class="bar-fill${r.epa<0?' negative-bar':''}" style="left:${Math.min(zero,scale(r.epa))}%;width:${Math.abs(scale(r.epa)-zero)}%"></i></span><span class="value">${fmt(r.epa)}</span></div>`).join('') : '<p class="empty-state">No league plays match this situation.</p>';
  $('#play-mix').innerHTML = own.n ? `<div class="mix-bar" role="img" aria-label="Pass ${pct(own.pass)}, run ${pct(1-own.pass)}"><span class="mix-pass" style="width:${own.pass*100}%">${own.pass>=.15?pct(own.pass,0):''}</span><span class="mix-run" style="width:${(1-own.pass)*100}%">${1-own.pass>=.15?pct(1-own.pass,0):''}</span></div><div class="mix-labels"><span>Pass · ${number.format(own.pass_n)}</span><span>Run · ${number.format(own.run_n)}</span></div>` : '<p class="empty-state">No play mix available.</p>';
  const playRows = ['pass','run'].map((p)=>({label:p==='pass'?'Pass':'Run',...aggregate(ownRows.filter((r)=>r.play_type===p))}));
  $('#play-type-comparison').innerHTML = `<table class="mini-table"><thead><tr><th>Type</th><th>Plays</th><th>EPA/play</th><th>Success</th></tr></thead><tbody>${playRows.map((r)=>`<tr><td>${r.label}</td><td>${number.format(r.n)}</td><td>${fmt(r.epa)}</td><td>${pct(r.success)}</td></tr>`).join('')}</tbody></table>`;
  $('#situations').innerHTML = `<table class="mini-table"><thead><tr><th>Down</th><th>Plays</th><th>EPA/play</th><th>Success</th></tr></thead><tbody>${[1,2,3,4].map((d)=>{ const r=aggregate(ownRows.filter((x)=>x.down===d));return `<tr><td>${d}${['','st','nd','rd','th'][d]}</td><td>${number.format(r.n)}</td><td>${fmt(r.epa)}</td><td>${pct(r.success)}</td></tr>`;}).join('')}</tbody></table>`;
  renderWeekly(f);
  lastExport = [{scope:'selected_team',team:f.team,...own},{scope:'league_excluding_selected_team',team:`NFL excluding ${f.team}`,...league},...ranked.map((r)=>({scope:'league_team_comparison',...r}))].map((r)=>({scope:r.scope,team:r.team,season:f.season,down:f.down,distance:f.distance,field_zone:f.field_zone,play_type:f.play_type,n:r.n,successes:r.successes,epa_sum:r.epa_sum,epa_per_play:Number.isFinite(r.epa)?r.epa:'',success_rate:Number.isFinite(r.success)?r.success:'',pass_rate:Number.isFinite(r.pass)?r.pass:''}));
}

function renderWeekly(f) {
  const rows = scouting.games.filter((g)=>g.team===f.team&&g.season===f.season).sort((a,b)=>a.week-b.week);
  $('#weekly-title').textContent = `${f.team} · Weekly EPA per play`;
  if (!rows.length) { $('#weekly-chart').innerHTML='<p class="empty-state">No eligible weekly data for this team and season.</p>';return; }
  const W=860,H=225,left=48,right=20,top=23,bottom=40;
  const min=Math.min(-.15,...rows.map((r)=>r.epa_sum/r.n));
  const max=Math.max(.15,...rows.map((r)=>r.epa_sum/r.n));
  const pad=(max-min)*.15;
  const yMin=min-pad,yMax=max+pad;
  const x=(week)=>left+(week-1)/17*(W-left-right);
  const y=(v)=>H-bottom-(v-yMin)/(yMax-yMin)*(H-top-bottom);
  const grid=Array.from({length:5},(_,i)=>yMin+(yMax-yMin)*i/4).map((v)=>`<line class="grid-line" x1="${left}" x2="${W-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-10}" y="${y(v)+3}" text-anchor="end">${fmt(v,2)}</text>`).join('');
  const path=rows.map((r,i)=>`${i?'L':'M'}${x(r.week)},${y(r.epa_sum/r.n)}`).join(' ');
  $('#weekly-chart').innerHTML=`<svg class="svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${f.team} ${f.season} full-season weekly EPA per play; excludes situation filters"><title>${esc(teams[f.team])} full-season weekly efficiency</title>${grid}<line class="zero-line" x1="${left}" x2="${W-right}" y1="${y(0)}" y2="${y(0)}"/><path class="data-line" d="${path}"/>${rows.map((r)=>`<circle class="data-dot" cx="${x(r.week)}" cy="${y(r.epa_sum/r.n)}" r="4"><title>Week ${r.week} vs ${r.opponent}: ${fmt(r.epa_sum/r.n)} EPA/play · ${number.format(r.n)} plays</title></circle>`).join('')}${Array.from({length:18},(_,i)=>i+1).map((week)=>`<text x="${x(week)}" y="${H-bottom+19}" text-anchor="middle">${week}</text>`).join('')}<text class="axis-title" x="${W-right}" y="${H-3}" text-anchor="end">REGULAR-SEASON WEEK</text></svg><p class="chart-note">${rows.length} games · Bye weeks have no point; the line joins observed games. Hover a point for opponent and sample.</p>`;
}

function renderModel() {
  const m=scouting.model;
  const improvement=m.baseline.brier-m.model.brier;
  $('#model-kpis').innerHTML=kpi('Held-out plays',number.format(m.model.n),`${m.test_season} regular season`,true)+kpi('Brier score',fmt(m.model.brier,4),'Lower is better · model')+kpi('Brier improvement',fmt(improvement,4),`${pct(improvement/m.baseline.brier)} relative to constant baseline`)+kpi('ROC AUC',fmt(m.model.auc,3),'Modest discrimination · 0.500 baseline');
  $('#metric-table').innerHTML=`<table class="mini-table metric-table"><thead><tr><th>2025 holdout</th><th>Model</th><th>Baseline</th></tr></thead><tbody>${[['Brier score ↓','brier',4],['Log loss ↓','log_loss',4],['ROC AUC ↑','auc',4]].map(([label,key,d])=>`<tr><td>${label}</td><td><strong>${fmt(m.model[key],d)}</strong></td><td>${fmt(m.baseline[key],d)}</td></tr>`).join('')}<tr><td>Test sample</td><td>${number.format(m.model.n)}</td><td>${number.format(m.baseline.n)}</td></tr><tr><td>Observed success</td><td>${pct(m.model.success_rate)}</td><td>${pct(m.baseline.success_rate)}</td></tr></tbody></table>`;
  const ci=m.brier_difference_game_bootstrap_95;
  $('#bootstrap-result').innerHTML=ci?`<b>Game-cluster bootstrap, 95% interval</b><br>Model − baseline Brier: <span class="positive">[${fmt(ci[0],6)}, ${fmt(ci[1],6)}]</span>.<br>Negative favors the model. ${esc(m.bootstrap_method)}`:'Game-cluster bootstrap interval not supplied.';
  const bins=m.calibration;
  const W=470,H=350,left=58,right=25,top=25,bottom=53;
  const x=(v)=>left+v*(W-left-right),y=(v)=>H-bottom-v*(H-top-bottom);
  const ticks=[0,.2,.4,.6,.8,1];
  const grid=ticks.map((v)=>`<line class="grid-line" x1="${left}" x2="${W-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end">${pct(v,0)}</text><text x="${x(v)}" y="${H-bottom+20}" text-anchor="middle">${pct(v,0)}</text>`).join('');
  const marks=bins.map((b)=>`<g><title>${number.format(b.n)} plays · predicted ${pct(b.predicted)} · observed ${pct(b.observed)} · approximate 95% Wilson CI ${pct(b.interval[0])}–${pct(b.interval[1])}</title><line x1="${x(b.predicted)}" x2="${x(b.predicted)}" y1="${y(b.interval[0])}" y2="${y(b.interval[1])}" stroke="#b7d28c" stroke-width="1.5"/><line x1="${x(b.predicted)-4}" x2="${x(b.predicted)+4}" y1="${y(b.interval[0])}" y2="${y(b.interval[0])}" stroke="#b7d28c"/><line x1="${x(b.predicted)-4}" x2="${x(b.predicted)+4}" y1="${y(b.interval[1])}" y2="${y(b.interval[1])}" stroke="#b7d28c"/><circle cx="${x(b.predicted)}" cy="${y(b.observed)}" r="${b.n>1000?6:4}" class="data-dot"/></g>`).join('');
  $('#calibration-chart').innerHTML=`<svg class="svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="2025 model calibration: predicted versus observed success with approximate 95 percent Wilson intervals"><title>Held-out calibration with observed-rate Wilson intervals</title>${grid}<line class="zero-line" x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}"/>${marks}<text class="axis-title" x="${(W+left-right)/2}" y="${H-7}" text-anchor="middle">PREDICTED SUCCESS PROBABILITY</text><text class="axis-title" transform="translate(13,${(H-bottom+top)/2}) rotate(-90)" text-anchor="middle">OBSERVED SUCCESS RATE</text></svg><p class="chart-note">Intervals assume independent plays and are approximate because plays cluster within games. Bins with few plays are especially uncertain.</p>`;
  $('#calibration-table').innerHTML=`<table class="mini-table"><thead><tr><th>Prediction bin</th><th>Plays</th><th>Avg. predicted</th><th>Observed</th><th>Approx. 95% Wilson CI</th></tr></thead><tbody>${bins.map((b)=>`<tr><td>${b.bin*10}–${(b.bin+1)*10}%</td><td>${number.format(b.n)}</td><td>${pct(b.predicted,2)}</td><td>${pct(b.observed,2)}</td><td>${pct(b.interval[0],2)}–${pct(b.interval[1],2)}</td></tr>`).join('')}</tbody></table>`;
  $('#model-method').textContent=`${m.method} Selected L2 penalty: ${m.selected_l2}.`;
  $('#model-features').textContent=`Features: ${m.features.map((x)=>x.replaceAll('_',' ')).join(', ')}. All play descriptors are observational. Play type is included, so this model cannot be used to choose a call by treating its coefficient as a causal effect.`;
  if(scouting.model_teams?.length){
    const detail=document.createElement('details');detail.className='methodology';
    detail.innerHTML=`<summary>Team outcomes vs. model expectations <span aria-hidden="true">＋</span></summary><div><p>2025 held-out plays. Differences are descriptive model residuals, not causal team effects or strength-adjusted team rankings. The interval belongs to the observed success rate only.</p><div class="table-scroll"><table class="mini-table"><thead><tr><th>Team</th><th>Plays</th><th>Observed</th><th>Expected</th><th>Difference</th><th>Observed 95% Wilson CI</th></tr></thead><tbody>${[...scouting.model_teams].sort((a,b)=>b.over_expected-a.over_expected).map((r)=>`<tr><td>${esc(r.team)}</td><td>${number.format(r.n)}</td><td>${pct(r.observed)}</td><td>${pct(r.expected)}</td><td>${signed(r.over_expected*100,1)} pp</td><td>${pct(r.interval[0])}–${pct(r.interval[1])}</td></tr>`).join('')}</tbody></table></div><p>Wilson intervals assume independent plays and are approximate; they are not uncertainty intervals for the observed-minus-expected difference.</p></div>`;
    $('#model').append(detail);
  }
}

function exportCsv() {
  if(!lastExport.length)return;
  const keys=Object.keys(lastExport[0]);
  const csv=[keys.join(','),...lastExport.map((r)=>keys.map((k)=>`"${String(r[k]).replaceAll('"','""')}"`).join(','))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`sideline-lab-${$('#team').value}-${$('#season').value}-selection.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function family(j) { return j.family || j.role_family || (/engineer/i.test(j.title)?'Data engineer':/scientist/i.test(j.title)?'Data scientist':/analyst/i.test(j.title)?'Analyst':'Adjacent analytics'); }
function labelStatus(value) { return ({application_form_verified:'Application form visible',listed_detail_accessible:'Accessible listing',listing_status_conflict:'Listing status conflict',verified_accessible_listing:'Accessible listing',verified_application_form:'Application form visible'})[value] || String(value||'Unconfirmed').replaceAll('_',' '); }
function initializeCareers() {
  const unique=(values)=>[...new Set(values.filter(Boolean))].sort();
  $('#career-league').insertAdjacentHTML('beforeend',unique([...careers.jobs,...careers.teams].map((r)=>r.league)).map((x)=>option(x)).join(''));
  $('#career-family').insertAdjacentHTML('beforeend',unique(careers.jobs.map(family)).map((x)=>option(x)).join(''));
  $('#career-status').insertAdjacentHTML('beforeend',unique(careers.jobs.map((j)=>j.status)).map((x)=>option(x,labelStatus(x))).join(''));
  ['career-search','career-league','career-family','career-status'].forEach((id)=>$(`#${id}`).addEventListener(id==='career-search'?'input':'change',renderCareers));
  const reviewed=careers.teams.filter((t)=>t.status==='reviewed').length;
  const blocked=careers.teams.filter((t)=>t.status==='blocked').length;
  const forms=careers.jobs.filter((j)=>/application form (visible|verified)|application_form_verified/i.test(j.status)).length;
  $('#career-stats').innerHTML=[['Team boards in scope',careers.teams.length],['Reviewed',reviewed],['Blocked / incomplete',careers.teams.length-reviewed],['Visible application forms',forms]].map(([label,n])=>`<div class="career-stat"><b>${number.format(n)}</b><span>${label}</span></div>`).join('');
  $('#checked-on').textContent=`Checked ${careers.checked_on||'date unavailable'}`;
  if(careers.scope) { const p=document.createElement('p');p.className='chart-note';p.textContent=typeof careers.scope==='string'?careers.scope:JSON.stringify(careers.scope);$('#coverage-table').before(p); }
  renderCareers();
}
function renderCareers() {
  const query=$('#career-search').value.trim().toLowerCase();
  const league=$('#career-league').value;
  const selectedFamily=$('#career-family').value;
  const status=$('#career-status').value;
  const jobs=careers.jobs.filter((j)=>(league==='all'||j.league===league)&&(selectedFamily==='all'||family(j)===selectedFamily)&&(status==='all'||j.status===status)&&(!query||[j.title,j.team,j.league,...(j.skills||[])].join(' ').toLowerCase().includes(query)));
  $('#career-result-count').textContent=`${number.format(jobs.length)} role ${jobs.length===1?'lead':'leads'}`;
  $('#job-list').innerHTML=jobs.length?jobs.map((j)=>{
    const statusText=labelStatus(j.status);
    const verified=/application form (visible|verified)/i.test(statusText);
    const conflict=/conflict|historical|unconfirmed/i.test(statusText);
    const link=safeUrl(j.url);
    const notes=j.notes||j.evidence_notes||j.evidence||'';
    return `<article class="job-card"><div class="job-topline"><span class="job-league">${esc(j.league)}</span><span class="job-status${verified?' verified':conflict?' conflict':''}">${verified?'● ':''}${esc(statusText)}</span></div><h3>${esc(j.title)}</h3><p class="job-team">${esc(j.team)} <span class="muted">/ ${esc(family(j))}</span></p><p class="job-location">${esc(j.location||'Location not stated')}${j.salary?`<br>${esc(j.salary)}`:''}</p><div class="skill-tags">${(j.skills||[]).slice(0,8).map((s)=>`<span class="skill-tag">${esc(s)}</span>`).join('')}</div>${j.requirements?`<p class="job-note">${esc(j.requirements)}</p>`:''}${conflict&&notes?`<p class="job-note">${esc(Array.isArray(notes)?notes.join(' '):notes)}</p>`:''}${link?`<a class="job-source" href="${link}" target="_blank" rel="noopener noreferrer">View source listing <span aria-hidden="true">↗</span></a>`:'<span class="job-note">Source link unavailable</span>'}</article>`;
  }).join(''):'<p class="empty-state">No role leads match these filters. Try a broader search or another league.</p>';
  const teamRows=careers.teams.filter((t)=>(league==='all'||t.league===league)&&(!query||`${t.team} ${t.league}`.toLowerCase().includes(query)));
  $('#coverage-table').innerHTML=teamRows.length?`<table class="mini-table coverage-table"><thead><tr><th>Team</th><th>League</th><th>Review status</th><th>Career source</th><th>Review limits</th></tr></thead><tbody>${teamRows.map((t)=>{const link=safeUrl(t.career_url||t.ats_url||t.listing_url);return `<tr><td>${esc(t.team)}</td><td>${esc(t.league)}</td><td><span class="status-badge ${t.status==='reviewed'?'reviewed':t.status==='blocked'?'blocked':'unreviewed'}">${esc(t.status)}</span></td><td>${link?`<a href="${link}" target="_blank" rel="noopener noreferrer">Career board ↗</a>`:'Not located'}</td><td class="coverage-notes">${esc(t.notes||t.evidence_notes||t.review_scope||'See source for current availability.')}</td></tr>`;}).join('')}</tbody></table>`:'<p class="empty-state">No team names match the league and search. Role-family and listing-status filters apply to jobs only.</p>';
}

async function loadJson(path) {
  const response=await fetch(path);
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
async function start() {
  const results=await Promise.allSettled([loadJson('data/scouting.json'),loadJson('data/careers.json')]);
  $('#loading').hidden=true;
  if(results[0].status==='fulfilled'){
    scouting=results[0].value;
    try { initializeScouting(); } catch(error) { $('#load-error').hidden=false;$('#load-error').textContent=`The scouting data could not be displayed: ${error.message}`; }
  } else {
    $('#load-error').hidden=false;
    $('#load-error').innerHTML='Could not load the scouting dataset. Start a local server from this web folder with <code>python3 -m http.server 8000</code>, then open <a href="http://localhost:8000">http://localhost:8000</a>. Opening index.html directly does not allow JSON fetches.';
  }
  if(results[1].status==='fulfilled') { careers=results[1].value;initializeCareers(); }
  else { $('#career-error').hidden=false;$('#career-error').textContent='Career data could not be loaded. Check that data/careers.json is present and serve this folder over HTTP. The scouting and model views can still be used.'; }
  setTab(location.hash.slice(1));
}
start();
