(function(){
'use strict';

/* ---------- plan data (from the 10-week program) ---------- */
var PLAN=[
 {easy:3,q:3,qk:'easy',long:5},
 {easy:3,q:4,qk:'easy',long:6},
 {easy:4,q:4,qk:'intervals',long:6},
 {easy:3,q:3,qk:'easy',long:5,light:true},
 {easy:4,q:4,qk:'tempo',long:7,est:true},
 {easy:4,q:4,qk:'intervals',long:8},
 {easy:5,q:4,qk:'tempo',long:8,est:true},
 {easy:4,q:4,qk:'easy',long:6,light:true},
 {easy:5,q:4,qk:'tempo',long:9,est:true},
 {easy:3,q:3,qk:'easy',long:10,final:true}
];
var DAYOFF={easy:1,quality:3,long:5};
var DAYNAME={easy:'Tue',quality:'Thu',long:'Sat'};
var TYPE_LABEL={easy:'Easy',quality:'Quality',long:'Long',recovery:'Recovery',test:'Test / race'};
var QK_LABEL={easy:'3 to 4 km easy',intervals:'Short intervals',tempo:'Tempo intervals'};
var HOW={
 easy:'Easy conversational run in Zone 2. Keep it relaxed and do not chase speed.',
 intervals:'10 min easy warm-up, then 1 min fast and 2 min slow jog, repeated 5 to 6 times, then 5 to 10 min cool-down. Fast should feel challenging but controlled.',
 tempo:'10 min warm-up, then 5 min comfortably hard and 2 min easy jog, repeated 3 times, then 5 to 10 min cool-down.',
 long:'Long Zone 2 run at a conversational pace. The distance is a target, not something to force.',
 final:'Your 10K continuous run. Start easy, stay conversational, and walk briefly only if your heart rate climbs too high.'
};

/* ---------- helpers ---------- */
var DAY=864e5;
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function pad(n){return n<10?'0'+n:''+n}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pd(s){var p=s.split('-').map(Number);return Date.UTC(p[0],p[1]-1,p[2])}
function fd(ms){return new Date(ms).toISOString().slice(0,10)}
function todayStr(){var n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate())}
function addDays(s,n){return fd(pd(s)+n*DAY)}
function mondayOf(s){var t=pd(s);var dow=(new Date(t).getUTCDay()+6)%7;return fd(t-dow*DAY)}
function fmtDate(s,o){return new Date(pd(s)).toLocaleDateString(undefined,Object.assign({timeZone:'UTC'},o||{day:'numeric',month:'short'}))}
function fmtDateL(s){return fmtDate(s,{weekday:'short',day:'numeric',month:'short'})}
function fmtPace(sec){if(!isFinite(sec)||sec<=0)return '–';var m=Math.floor(sec/60),s=Math.round(sec-m*60);if(s===60){m++;s=0}return m+':'+pad(s)}
function fmtTime(secs){secs=Math.round(secs);var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;return h>0?h+':'+pad(m)+':'+pad(s):m+':'+pad(s)}
function fmtKm(k){return String(Math.round(k*100)/100)}
function parseTime(s){
  s=(s||'').trim();if(!s)return null;
  if(/^\d+(\.\d+)?$/.test(s))return Math.round(parseFloat(s)*60);
  var p=s.split(':').map(Number);
  if(p.length>3||p.some(function(x){return isNaN(x)||x<0}))return null;
  if(p.length===2){if(p[1]>=60)return null;return p[0]*60+p[1]}
  if(p[1]>=60||p[2]>=60)return null;
  return p[0]*3600+p[1]*60+p[2];
}
function uid(){return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

/* ---------- state ---------- */
function defaultStart(){
  var t=todayStr();var mon=mondayOf(t);
  return mon>=t?mon:addDays(mon,7);
}
function exampleRuns(){
  var rows=[
    ['2026-09-29','easy',3.0,'21:00',4],['2026-10-01','quality',3.0,'20:30',5],['2026-10-03','long',5.0,'35:10',4],
    ['2026-10-06','easy',3.0,'20:40',4],['2026-10-08','quality',3.5,'23:20',5],['2026-10-10','long',5.5,'38:00',4],
    ['2026-10-13','easy',3.5,'23:10',4],['2026-10-15','quality',4.0,'26:20',6],['2026-10-17','long',6.0,'41:00',5],
    ['2026-10-20','easy',4.0,'26:10',4],['2026-10-22','quality',4.0,'25:50',6],['2026-10-24','long',7.0,'47:30',5],
    ['2026-10-27','easy',4.0,'25:40',4],['2026-10-29','quality',4.5,'28:40',6],['2026-10-31','long',8.0,'54:00',5],
    ['2026-11-03','easy',4.0,'25:20',4],['2026-11-05','quality',4.0,'24:50',6]
  ];
  return rows.map(function(r,i){return {id:'ex'+i,date:r[0],type:r[1],dist:r[2],secs:parseTime(r[3]),rpe:r[4],hr:null,knee:false,notes:'',example:true}});
}
var S={runs:[],start:defaultStart(),base10k:null,strength:{}};
var editingId=null;
var chartMode='pace',tableView=false;
var store={kind:'none',ref:null};
var downloadsApi=null;
var supabaseClient=null;
var authUser=null;
var SUPABASE_URL='https://kauigfqoodswaouydidn.supabase.co';
var SUPABASE_PUBLIC_KEY='sb_publishable_h7uKd6Z1K68-waj94f5YtA_uHmEdBgZ';

function snapshotData(){return {v:1,runs:S.runs,start:S.start,base10k:S.base10k,strength:S.strength}}
function applyData(d){
  S.runs=Array.isArray(d.runs)?d.runs:[];
  if(typeof d.start==='string')S.start=mondayOf(d.start);
  S.base10k=typeof d.base10k==='number'?d.base10k:null;
  S.strength=d.strength&&typeof d.strength==='object'?d.strength:{};
}
var writing=false,dirty=false;
function persist(){
  dirty=true;
  if(store.kind==='local'){try{localStorage.setItem('runtracker-v1',JSON.stringify(snapshotData()))}catch(e){}dirty=false;return}
  if(store.kind==='supabase')flush();
}
function flush(){
  if(writing||!dirty||!store.ref)return;
  writing=true;dirty=false;
  supabaseClient.from('tracker_data').upsert({user_id:authUser.id,data:snapshotData(),updated_at:new Date().toISOString()}).then(function(result){
    if(result.error)throw result.error;
    writing=false;setChip('Saved to your account',true);if(dirty)flush();
  }).catch(function(e){writing=false;dirty=true;setChip('Not saved. Try again.',false);console.error('Supabase save failed',e)});
}
function setChip(t,ok){var c=$('#saveChip');c.textContent=t;c.className='chip'+(ok?' ok':'')}

function setAuthUi(user){
  authUser=user||null;
  $('#authHome').hidden=!!user;
  $('#trackerApp').hidden=!user;
  $('#saveChip').hidden=!user;
  $('#userMenu').hidden=!user;
  $('#signedOut').hidden=!!user;
  $('#signedIn').hidden=!user;
  $('#authUser').textContent=user?'Signed in as '+user.email:'';
  $('#headerUser').textContent=user?user.email:'';
  $('#userAvatar').textContent=user?(user.email||'?').charAt(0).toUpperCase():'?';
}
function authError(message){$('#authErr').textContent=message||''}
function setTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  try{localStorage.setItem('runtracker-theme',theme)}catch(e){}
  $('#themeBtn').textContent=theme==='dark'?'☀':'◐';
  $('#themeBtn').setAttribute('aria-label',theme==='dark'?'Use light theme':'Use dark theme');
}
function initTheme(){
  var saved=null;
  try{saved=localStorage.getItem('runtracker-theme')}catch(e){}
  setTheme(saved==='dark'||saved==='light'?saved:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
}
function setAuthenticatedStore(){
  store={kind:'supabase',ref:true};
  setChip('Connected to your account',true);
}
function loadSupabaseData(){
  return supabaseClient.from('tracker_data').select('data').eq('user_id',authUser.id).maybeSingle().then(function(result){
    if(result.error)throw result.error;
    setAuthenticatedStore();
    if(result.data&&result.data.data){applyData(result.data.data)}
    else {S.runs=[];S.start=defaultStart();S.base10k=null;S.strength={};persist()}
    renderAll();
  });
}
function initSupabase(){
  if(!window.supabase||!window.supabase.createClient)return Promise.reject(new Error('Supabase client did not load'));
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY);
  return supabaseClient.auth.getSession().then(function(result){
    if(result.error)throw result.error;
    setAuthUi(result.data.session&&result.data.session.user);
    if(result.data.session&&result.data.session.user)return loadSupabaseData();
    useLocal();
  }).then(function(){
    supabaseClient.auth.onAuthStateChange(function(event,session){
      setAuthUi(session&&session.user);
      if(event==='SIGNED_IN'&&session){authUser=session.user;loadSupabaseData().catch(function(e){authError(e.message);setChip('Could not load account data',false)})}
      if(event==='SIGNED_OUT'){store={kind:'local',ref:null};useLocal()}
    });
  });
}

/* ---------- derived ---------- */
function sortedRuns(){return S.runs.filter(function(r){return r.dist>0&&r.secs>0}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(a.id<b.id?-1:1)})}
function computeRecords(){
  var rs=sortedRuns(),ev=[],bl=0,bp=Infinity,bd={3:Infinity,5:Infinity,8:Infinity,10:Infinity},cur={};
  rs.forEach(function(r){
    var pace=r.secs/r.dist;
    if(r.dist>bl+1e-9){bl=r.dist;cur.long=r;ev.push({date:r.date,id:r.id,key:'long',title:'Longest run',value:fmtKm(r.dist)+' km'})}
    if(r.dist>=2&&pace<bp-1e-9){bp=pace;cur.pace=r;ev.push({date:r.date,id:r.id,key:'pace',title:'Fastest pace',value:fmtPace(pace)+' /km'})}
    [3,5,8,10].forEach(function(D){
      if(r.dist>=D-0.05&&pace<bd[D]-1e-9){bd[D]=pace;cur['d'+D]=r;ev.push({date:r.date,id:r.id,key:'d'+D,title:'Fastest '+D+'K',value:fmtTime(pace*D)})}
    });
  });
  var weeks={};
  rs.forEach(function(r){var k=mondayOf(r.date);(weeks[k]=weeks[k]||{km:0,n:0});weeks[k].km+=r.dist;weeks[k].n++});
  var bw=null,mr=null;
  Object.keys(weeks).forEach(function(k){
    if(!bw||weeks[k].km>bw.km+1e-9)bw={key:k,km:weeks[k].km,n:weeks[k].n};
    if(!mr||weeks[k].n>mr.n)mr={key:k,n:weeks[k].n,km:weeks[k].km};
  });
  return {rs:rs,ev:ev,cur:cur,weeks:weeks,bestWeek:bw,mostRuns:mr};
}
function planWeeks(){
  var used={};
  return PLAN.map(function(wk,i){
    var mon=addDays(S.start,i*7),end=addDays(mon,6);
    var inW=sortedRuns().filter(function(r){return r.date>=mon&&r.date<=end});
    var slots=['easy','quality','long'].map(function(k){
      var run=null;
      for(var j=0;j<inW.length;j++){if(inW[j].type===k&&!used[inW[j].id]){run=inW[j];used[run.id]=1;break}}
      var target=k==='easy'?wk.easy:k==='quality'?wk.q:wk.long;
      var est=k==='quality'&&wk.est;
      var kind=k==='easy'?'Easy':k==='quality'?QK_LABEL[wk.qk]:(wk.final?'10K continuous':'Long run');
      var how=k==='easy'?HOW.easy:k==='quality'?HOW[wk.qk]:(wk.final?HOW.final:HOW.long);
      return {k:k,run:run,target:target,est:est,kind:kind,how:how,date:addDays(mon,DAYOFF[k])};
    });
    return {i:i,mon:mon,end:end,wk:wk,slots:slots,target:wk.easy+wk.q+wk.long};
  });
}

/* ---------- rendering: header / overview ---------- */
function renderSub(){
  var t=todayStr(),idx=Math.floor((pd(t)-pd(S.start))/(7*DAY));
  var txt;
  if(idx<0)txt='Week 1 starts '+fmtDateL(S.start)+'. '+(-idx)+(idx===-1?' week to go.':' weeks to go.');
  else if(idx>9)txt='The 10 weeks are done. Keep logging to track your progress.';
  else txt='Week '+(idx+1)+' of 10'+(PLAN[idx].light?' (lighter week)':'')+'. Goal: run 10K continuously.';
  $('#subline').textContent=txt;
}
function pbIdsByRun(rec){var m={};rec.ev.forEach(function(e){(m[e.id]=m[e.id]||[]).push(e)});return m}
function renderBanners(){
  var rec=computeRecords(),out='';
  if(S.runs.some(function(r){return r.example})){
    out+='<div class="banner info"><span><b>Example runs are showing.</b> They are sample data so you can see how the charts work.</span><button class="btn sm" data-act="clearEx">Clear examples</button></div>';
  }
  var rs=rec.rs;
  if(rs.length>1){
    var last=rs[rs.length-1],evs=rec.ev.filter(function(e){return e.id===last.id});
    if(evs.length&&!last.example&&last.date>=addDays(todayStr(),-7)){
      out+='<div class="banner pb"><span><span class="diamond"></span><b>New personal best.</b> '+evs.map(function(e){return esc(e.title)+' '+esc(e.value)}).join(', ')+' on '+fmtDate(last.date)+'.</span><a href="#records" class="btn ghost sm" style="text-decoration:none">See records</a></div>';
    }
    if(last.knee){
      out+='<div class="banner warn"><span><b>Your last run flagged knee discomfort.</b> Your plan says to stop running if knee pain worsens, swells, or changes your stride.</span></div>';
    }
  }
  $('#banners').innerHTML=out;
}
function nextSlot(){
  var pw=planWeeks(),t=todayStr();
  for(var i=0;i<pw.length;i++)for(var j=0;j<3;j++){var s=pw[i].slots[j];if(!s.run&&s.date>=t)return {w:pw[i],s:s}}
  return null;
}
function renderNext(){
  var n=nextSlot(),h='';
  if(!n){h='<div class="empty" style="padding:12px">'+(S.runs.length?'Every planned session is logged or past. Nice work.':'Log your first run to get started.')+'</div>'}
  else{
    var when=n.s.date===todayStr()?'Today':fmtDateL(n.s.date);
    h='<div class="next"><div><div class="when">Up next · Week '+(n.w.i+1)+' · '+when+'</div><h2>'+esc(n.s.kind)+' · '+(n.s.est?'about ':'')+n.s.target+' km</h2><p class="how">'+esc(n.s.how)+'</p></div><button class="btn" data-act="prefill" data-w="'+n.w.i+'" data-k="'+n.s.k+'">Log this run</button></div>';
  }
  $('#nextCard').innerHTML=h;
}
function renderTiles(){
  var rs=sortedRuns(),tot=0,secs=0,longest=0;
  rs.forEach(function(r){tot+=r.dist;secs+=r.secs;if(r.dist>longest)longest=r.dist});
  var t=todayStr(),mon=mondayOf(t),wk=0,wn=0;
  rs.forEach(function(r){if(r.date>=mon&&r.date<=addDays(mon,6)){wk+=r.dist;wn++}});
  var idx=Math.floor((pd(t)-pd(S.start))/(7*DAY)),target=(idx>=0&&idx<10)?(PLAN[idx].easy+PLAN[idx].q+PLAN[idx].long):null;
  var pct=Math.min(100,longest/10*100);
  var h='';
  h+='<div class="tile"><div class="l">This week</div><div class="v">'+fmtKm(wk)+'<small>km</small></div><div class="d">'+wn+(wn===1?' run':' runs')+(target?' · plan '+target+' km':'')+'</div>'+(target?'<div class="bar"><i style="width:'+Math.min(100,wk/target*100)+'%"></i></div>':'')+'</div>';
  h+='<div class="tile"><div class="l">Total distance</div><div class="v">'+fmtKm(tot)+'<small>km</small></div><div class="d">'+rs.length+' runs logged</div></div>';
  h+='<div class="tile"><div class="l">Average pace</div><div class="v">'+(tot?fmtPace(secs/tot):'–')+'<small>/km</small></div><div class="d">'+(tot?'across all runs':'Log a run to see it')+'</div></div>';
  h+='<div class="tile"><div class="l">Longest run</div><div class="v">'+fmtKm(longest)+'<small>km</small></div><div class="d">Goal: 10 km continuous</div><div class="bar" role="img" aria-label="'+Math.round(pct)+' percent of 10 kilometres"><i style="width:'+pct+'%"></i></div></div>';
  $('#tiles').innerHTML=h;
}
function renderPaces(){
  var b=S.base10k;
  $('#base10k').value=b?fmtTime(b):'';
  $('#clearBase').hidden=!b;
  if(!b){$('#paces').innerHTML='<p class="small muted" style="margin-top:10px">Enter a recent 10K time to get rough pace ranges for each kind of session. Treat them as a starting point and adjust by feel and heart rate.</p>';return}
  var p=b/10;
  function rg(a,c){return fmtPace(p+a)+' to '+fmtPace(p+c)}
  $('#paces').innerHTML='<div class="paces">'+
   '<div><div class="pn">10K pace</div><div class="pv">'+fmtPace(p)+'</div><div class="pd">per km, from '+fmtTime(b)+'</div></div>'+
   '<div><div class="pn">Easy and long</div><div class="pv">'+rg(60,90)+'</div><div class="pd">Conversational, Zone 2</div></div>'+
   '<div><div class="pn">Tempo</div><div class="pv">'+rg(0,10)+'</div><div class="pd">Comfortably hard, 5 min reps</div></div>'+
   '<div><div class="pn">Fast intervals</div><div class="pv">'+rg(-20,-10)+'</div><div class="pd">Hard but controlled, 1 min reps</div></div></div>';
}

/* ---------- charts ---------- */
function niceTicks(min,max,count){
  var span=max-min||1,raw=span/count,mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10));
  var steps=[1,2,2.5,5,10],step=mag*10;
  for(var i=0;i<steps.length;i++){if(steps[i]*mag>=raw){step=steps[i]*mag;break}}
  var lo=Math.floor(min/step+1e-9)*step,hi=Math.ceil(max/step-1e-9)*step,t=[];
  for(var v=lo;v<=hi+step*1e-6;v+=step)t.push(+v.toFixed(6));
  return t;
}
function chartData(){
  var rec=computeRecords(),pbm=pbIdsByRun(rec),rs=rec.rs;
  if(chartMode==='week'){
    var cur=mondayOf(todayStr()),first=rs.length?mondayOf(rs[0].date):cur;
    var startK=first;var n=Math.round((pd(cur)-pd(first))/(7*DAY))+1;if(n>12){startK=addDays(cur,-77);n=12}
    var tg={};planWeeks().forEach(function(w){tg[w.mon]=w.target});
    var bars=[];for(var i=0;i<n;i++){var k=addDays(startK,i*7),w=rec.weeks[k]||{km:0,n:0};bars.push({key:k,km:w.km,n:w.n,target:tg[k]||null})}
    return {kind:'bars',bars:bars};
  }
  var pts=rs.filter(function(r){return r.dist>=1}).map(function(r){
    var isPb=(pbm[r.id]||[]).some(function(e){return chartMode==='pace'?(e.key==='pace'||/^d/.test(e.key)):e.key==='long'});
    return {t:pd(r.date),y:chartMode==='pace'?r.secs/r.dist:r.dist,run:r,pb:isPb&&rs.length>1};
  });
  return {kind:'line',pts:pts};
}
function drawChart(){
  var host=$('#chart');if(!host||host.offsetParent===null&&host.clientWidth===0)return;
  var d=chartData(),cap=$('#chartCap'),key=$('#chartKey');
  var titles={pace:'Pace over time',dist:'Distance per run',week:'Weekly distance'};
  $('#chartTitle').textContent=titles[chartMode];
  cap.textContent=chartMode==='pace'?'Minutes per km. Higher on the chart is faster.':chartMode==='dist'?'Kilometres per run.':'Kilometres per calendar week (Monday to Sunday).';
  var enough=d.kind==='bars'?d.bars.some(function(b){return b.km>0}):d.pts.length>=2;
  if(!enough){host.innerHTML='<div class="empty">Log at least two runs to see your '+(chartMode==='week'?'weekly volume':'trend')+'.</div>';key.innerHTML='';return}
  if(tableView){host.innerHTML=tableHtml(d);key.innerHTML='';return}
  var W=Math.max(300,host.clientWidth),H=W<520?230:280,m={l:46,r:18,t:18,b:30},iw=W-m.l-m.r,ih=H-m.t-m.b,svg='',tipData=[];
  if(d.kind==='line'){
    var ys=d.pts.map(function(p){return p.y}),baseP=(chartMode==='pace'&&S.base10k)?S.base10k/10:null;
    if(baseP)ys.push(baseP);
    var mn=Math.min.apply(null,ys),mx=Math.max.apply(null,ys),pad_=(mx-mn)*.15||(chartMode==='pace'?15:1);
    var ticks=niceTicks(mn-pad_,mx+pad_,4),dmin=ticks[0],dmax=ticks[ticks.length-1],inv=chartMode==='pace';
    var sy=function(v){var f=(v-dmin)/(dmax-dmin);return m.t+(inv?f:1-f)*ih};
    var t0=d.pts[0].t,t1=d.pts[d.pts.length-1].t;if(t1-t0<6*DAY){t0-=3*DAY;t1+=3*DAY}
    var sx=function(t){return m.l+8+(t-t0)/(t1-t0)*(iw-16)};
    ticks.forEach(function(v){var y=sy(v);svg+='<line class="grid" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y+'" y2="'+y+'"/><text class="ax" x="'+(m.l-8)+'" y="'+(y+4)+'" text-anchor="end">'+(chartMode==='pace'?fmtPace(v):fmtKm(v))+'</text>'});
    var nt=Math.max(2,Math.min(6,Math.floor(iw/95)));
    for(var i=0;i<nt;i++){var tt=t0+(t1-t0)*i/(nt-1);svg+='<text class="ax" x="'+sx(tt)+'" y="'+(H-8)+'" text-anchor="'+(i===0?'start':i===nt-1?'end':'middle')+'">'+fmtDate(fd(tt))+'</text>'}
    if(baseP)svg+='<line class="ref" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+sy(baseP)+'" y2="'+sy(baseP)+'"/>';
    var path=d.pts.map(function(p,i){return (i?'L':'M')+sx(p.t).toFixed(1)+','+sy(p.y).toFixed(1)}).join('');
    if(chartMode==='dist'){svg+='<path class="area" d="'+path+'L'+sx(d.pts[d.pts.length-1].t)+','+sy(dmin)+'L'+sx(d.pts[0].t)+','+sy(dmin)+'Z"/>'}
    svg+='<path class="ln" d="'+path+'"/>';
    d.pts.forEach(function(p){
      var x=sx(p.t),y=sy(p.y);
      if(p.pb)svg+='<path class="pbd" d="M'+x+','+(y-7)+'L'+(x+7)+','+y+'L'+x+','+(y+7)+'L'+(x-7)+','+y+'Z"/>';
      else svg+='<circle class="dot" cx="'+x+'" cy="'+y+'" r="4"/>';
      tipData.push({x:x,y:y,p:p});
    });
    var lp=d.pts[d.pts.length-1],lx=sx(lp.t),ly=sy(lp.y);
    svg+='<text class="lbl" x="'+Math.min(lx,W-m.r)+'" y="'+(ly-12)+'" text-anchor="end">'+(chartMode==='pace'?fmtPace(lp.y):fmtKm(lp.y)+' km')+'</text>';
    svg+='<line class="cross" id="cross" y1="'+m.t+'" y2="'+(m.t+ih)+'" x1="0" x2="0" style="display:none"/>';
    key.innerHTML='<span><i class="k-dot"></i>Run</span><span><i class="k-dia"></i>Set a personal best</span>'+(baseP?'<span><i class="k-dash"></i>Your 10K pace</span>':'');
  }else{
    var mxk=0;d.bars.forEach(function(b){mxk=Math.max(mxk,b.km,b.target||0)});
    var ticks2=niceTicks(0,mxk*1.1||1,4),dmax2=ticks2[ticks2.length-1];
    var sy2=function(v){return m.t+(1-v/dmax2)*ih};
    ticks2.forEach(function(v){var y=sy2(v);svg+='<line class="grid" x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y+'" y2="'+y+'"/><text class="ax" x="'+(m.l-8)+'" y="'+(y+4)+'" text-anchor="end">'+fmtKm(v)+'</text>'});
    var band=iw/d.bars.length,bw=Math.min(34,band*.62),every=Math.ceil(d.bars.length/Math.max(2,Math.floor(iw/70)));
    d.bars.forEach(function(b,i){
      var cx=m.l+band*(i+.5),x=cx-bw/2,y=sy2(b.km),h=m.t+ih-y;
      if(b.km>0){var r=Math.min(4,h);svg+='<path class="barr" d="M'+x+','+(y+h)+'L'+x+','+(y+r)+'Q'+x+','+y+' '+(x+r)+','+y+'L'+(x+bw-r)+','+y+'Q'+(x+bw)+','+y+' '+(x+bw)+','+(y+r)+'L'+(x+bw)+','+(y+h)+'Z"/>'}
      if(b.target){var ty=sy2(b.target);svg+='<line class="tgt" x1="'+(x-3)+'" x2="'+(x+bw+3)+'" y1="'+ty+'" y2="'+ty+'"/>'}
      if(i%every===0||i===d.bars.length-1)svg+='<text class="ax" x="'+cx+'" y="'+(H-8)+'" text-anchor="middle">'+fmtDate(b.key)+'</text>';
      tipData.push({x:cx,y:y,b:b,band:band});
    });
    svg+='<line class="cross" id="cross" y1="'+m.t+'" y2="'+(m.t+ih)+'" x1="0" x2="0" style="display:none"/>';
    key.innerHTML='<span><i class="k-bar"></i>Distance run</span>'+(d.bars.some(function(b){return b.target})?'<span><i class="k-tgt"></i>Plan target</span>':'');
  }
  host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(titles[chartMode])+' chart. Use Table view for the values.">'+svg+'</svg><div class="tip" id="tip" hidden></div>';
  var sv=$('svg',host),tip=$('#tip',host),cross=$('#cross',host);
  function show(e){
    var r=sv.getBoundingClientRect(),px=(e.clientX-r.left)*(W/r.width),best=null,bd=1e9;
    tipData.forEach(function(t){var dd=Math.abs(t.x-px);if(dd<bd){bd=dd;best=t}});
    if(!best)return;
    cross.setAttribute('x1',best.x);cross.setAttribute('x2',best.x);cross.style.display='';
    var h;
    if(best.p){var run=best.p.run;h='<div class="muted">'+fmtDateL(run.date)+' · '+esc(TYPE_LABEL[run.type]||'')+'</div><div class="tv">'+(chartMode==='pace'?fmtPace(run.secs/run.dist)+' <small>/km</small>':fmtKm(run.dist)+' <small>km</small>')+'</div><div>'+fmtKm(run.dist)+' km in '+fmtTime(run.secs)+'</div>'+(best.p.pb?'<div class="pbtag">Personal best set</div>':'')}
    else{var b=best.b;h='<div class="muted">Week of '+fmtDate(b.key)+'</div><div class="tv">'+fmtKm(b.km)+' <small>km</small></div><div>'+b.n+(b.n===1?' run':' runs')+(b.target?' · plan '+b.target+' km':'')+'</div>'}
    tip.innerHTML=h;tip.hidden=false;
    var tw=tip.offsetWidth,left=(best.x*(r.width/W))+14;if(left+tw>r.width-4)left=best.x*(r.width/W)-tw-14;
    tip.style.left=Math.max(4,left)+'px';tip.style.top='8px';
  }
  sv.addEventListener('pointermove',show);sv.addEventListener('pointerdown',show);
  sv.addEventListener('pointerleave',function(){tip.hidden=true;cross.style.display='none'});
}
function tableHtml(d){
  var h='<div class="tbl"><table><thead><tr>';
  if(d.kind==='bars'){
    h+='<th>Week of</th><th class="r">Runs</th><th class="r">Distance (km)</th><th class="r">Plan (km)</th></tr></thead><tbody>';
    d.bars.slice().reverse().forEach(function(b){h+='<tr><td>'+fmtDate(b.key)+'</td><td class="r">'+b.n+'</td><td class="r">'+fmtKm(b.km)+'</td><td class="r">'+(b.target||'–')+'</td></tr>'});
  }else{
    h+='<th>Date</th><th>Session</th><th class="r">Distance (km)</th><th class="r">Time</th><th class="r">Pace (/km)</th><th>PB</th></tr></thead><tbody>';
    d.pts.slice().reverse().forEach(function(p){var r=p.run;h+='<tr><td>'+fmtDate(r.date)+'</td><td>'+esc(TYPE_LABEL[r.type]||'')+'</td><td class="r">'+fmtKm(r.dist)+'</td><td class="r">'+fmtTime(r.secs)+'</td><td class="r">'+fmtPace(r.secs/r.dist)+'</td><td>'+(p.pb?'Yes':'')+'</td></tr>'});
  }
  return h+'</tbody></table></div>';
}

/* ---------- log view ---------- */
function suggestType(dateStr){
  var dow=new Date(pd(dateStr)).getUTCDay();
  return dow===2?'easy':dow===4?'quality':dow===6?'long':dow===0?'recovery':'easy';
}
function resetForm(){
  editingId=null;
  $('#runForm').reset();
  $('#f-date').value=todayStr();
  $('#f-type').value=suggestType(todayStr());
  $('#f-rpe').value=4;$('#rpeOut').textContent='4';
  $('#formTitle').textContent='Log a run';$('#saveRun').textContent='Save run';$('#cancelEdit').hidden=true;
  $('#formErr').textContent='';updatePreview();
}
function updatePreview(){
  var d=parseFloat($('#f-dist').value),s=parseTime($('#f-time').value);
  $('#pacePrev').textContent=(d>0&&s)?fmtPace(s/d)+' /km':'';
}
function submitRun(e){
  e.preventDefault();
  var date=$('#f-date').value,dist=parseFloat($('#f-dist').value),secs=parseTime($('#f-time').value),err=$('#formErr');
  if(!date){err.textContent='Choose the date of the run.';return}
  if(!(dist>0)||dist>100){err.textContent='Enter a distance in km, for example 5 or 5.25.';return}
  if(!secs||secs<60){err.textContent='Enter the time as mm:ss or h:mm:ss, for example 28:45.';return}
  var pace=secs/dist;
  if(pace<150||pace>1200){err.textContent='That works out to '+fmtPace(pace)+' per km. Check the distance and time.';return}
  var hr=parseInt($('#f-hr').value,10);
  var run={id:editingId||uid(),date:date,type:$('#f-type').value,dist:Math.round(dist*100)/100,secs:secs,rpe:parseInt($('#f-rpe').value,10),hr:isNaN(hr)?null:hr,knee:$('#f-knee').checked,notes:$('#f-notes').value.trim().slice(0,400)};
  if(editingId){S.runs=S.runs.map(function(r){return r.id===editingId?run:r})}else S.runs.push(run);
  persist();resetForm();renderAll();
  err.textContent='';
  $('#runList').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function startEdit(id){
  var r=S.runs.filter(function(x){return x.id===id})[0];if(!r)return;
  editingId=id;
  $('#f-date').value=r.date;$('#f-type').value=r.type;$('#f-dist').value=r.dist;$('#f-time').value=fmtTime(r.secs);
  $('#f-rpe').value=r.rpe||4;$('#rpeOut').textContent=r.rpe||4;$('#f-hr').value=r.hr||'';$('#f-knee').checked=!!r.knee;$('#f-notes').value=r.notes||'';
  $('#formTitle').textContent='Edit run';$('#saveRun').textContent='Save changes';$('#cancelEdit').hidden=false;updatePreview();
  window.scrollTo({top:0,behavior:'smooth'});
}
var delTimer=null;
function renderRunList(){
  var rec=computeRecords(),pbm=pbIdsByRun(rec),rs=S.runs.slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.id<b.id?1:-1)});
  $('#exportBtn').hidden=!downloadsApi||!rs.length;
  if(!rs.length){$('#runList').innerHTML='<div class="empty">No runs yet. Log your first run above.</div>';return}
  $('#runList').innerHTML=rs.map(function(r){
    var pbs=(pbm[r.id]||[]).length&&rec.rs.length>1&&!r.example;
    return '<div class="run"><div class="rd"><div class="date">'+fmtDateL(r.date)+'</div><div class="muted small">'+esc(TYPE_LABEL[r.type]||'')+'</div></div>'+
      '<div><div class="nums"><span class="num">'+fmtKm(r.dist)+' km</span><span class="num">'+fmtTime(r.secs)+'</span><span class="muted tab-nums">'+fmtPace(r.secs/r.dist)+' /km</span></div>'+
      '<div class="meta">'+(r.rpe?'<span class="tag">Effort '+r.rpe+'/10</span>':'')+(r.hr?'<span class="tag">'+r.hr+' bpm</span>':'')+(r.knee?'<span class="tag knee">Knee discomfort</span>':'')+(pbs?'<span class="tag pbt">Personal best</span>':'')+(r.example?'<span class="tag ex">Example</span>':'')+(r.notes?'<span class="small muted">'+esc(r.notes)+'</span>':'')+'</div></div>'+
      '<div class="acts"><button class="btn ghost sm" data-act="edit" data-id="'+esc(r.id)+'">Edit</button><button class="btn danger sm" data-act="del" data-id="'+esc(r.id)+'">Delete</button></div></div>';
  }).join('');
}
function exportCsv(){
  if(!downloadsApi)return;
  var rows=[['date','session','distance_km','time','pace_min_per_km','avg_hr','effort','knee_discomfort','notes']];
  S.runs.slice().sort(function(a,b){return a.date<b.date?-1:1}).forEach(function(r){
    rows.push([r.date,TYPE_LABEL[r.type]||r.type,r.dist,fmtTime(r.secs),fmtPace(r.secs/r.dist),r.hr||'',r.rpe||'',r.knee?'yes':'no',r.notes||'']);
  });
  var csv=rows.map(function(r){return r.map(function(c){c=String(c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')}).join('\n');
  downloadsApi.save({filename:'run-log.csv',data:csv}).catch(function(){});
}

/* ---------- plan view ---------- */
function renderPlan(){
  $('#planStart').value=S.start;
  var t=todayStr(),pw=planWeeks();
  $('#weeks').innerHTML=pw.map(function(w){
    var cur=t>=w.mon&&t<=w.end,past=w.end<t;
    var st=S.strength[w.i]||0;
    return '<article class="wk'+(cur?' cur':'')+'"><div><div class="wn">Week '+(w.i+1)+'</div><div class="wd">'+fmtDate(w.mon)+' to '+fmtDate(w.end)+'</div>'+(w.wk.light?'<span class="tag">Lighter week</span>':'')+(cur?' <span class="tag">This week</span>':'')+'</div>'+
      '<div class="slots">'+w.slots.map(function(s){
        var cls='slot',status;
        if(s.run){cls+=' done';status='✓ '+fmtKm(s.run.dist)+' km · '+fmtPace(s.run.secs/s.run.dist)+' /km'}
        else if(s.date<t||past){cls+=' missed';status='Not logged · target '+(s.est?'~':'')+s.target+' km'}
        else status='Target '+(s.est?'about ':'')+s.target+' km';
        return '<button class="'+cls+'" data-act="prefill" data-w="'+w.i+'" data-k="'+s.k+'" title="'+esc(s.how)+'"><div class="sd">'+DAYNAME[s.k]+'</div><div class="sk">'+esc(s.kind)+'</div><div class="ss">'+status+'</div></button>';
      }).join('')+'</div>'+
      '<div class="strength">Strength <button data-act="str" data-w="'+w.i+'" data-n="1" aria-pressed="'+(st>=1)+'" aria-label="Week '+(w.i+1)+' strength session 1">1</button><button data-act="str" data-w="'+w.i+'" data-n="2" aria-pressed="'+(st>=2)+'" aria-label="Week '+(w.i+1)+' strength session 2">2</button></div></article>';
  }).join('');
}

/* ---------- records ---------- */
function renderRecords(){
  var rec=computeRecords(),c=rec.cur,t=todayStr(),h='';
  function card(label,val,unit,run,detail,hasData){
    var recent=run&&run.date>=addDays(t,-7)&&rec.rs.length>1&&!run.example;
    if(!hasData)return '<div class="pbc none"><div class="l">'+label+'</div><div class="v">–</div><div class="d">'+detail+'</div></div>';
    return '<div class="pbc has"><div class="l"><span class="diamond"></span>'+label+(recent?' <span class="tag pbt">New</span>':'')+'</div><div class="v">'+val+(unit?'<small>'+unit+'</small>':'')+'</div><div class="d">'+detail+'</div></div>';
  }
  h+=c.long?card('Longest run',fmtKm(c.long.dist),'km',c.long,fmtDate(c.long.date)+' · '+fmtTime(c.long.secs),1):card('Longest run','','',null,'Log a run to set it',0);
  h+=c.pace?card('Fastest pace',fmtPace(c.pace.secs/c.pace.dist),'/km',c.pace,fmtDate(c.pace.date)+' · '+fmtKm(c.pace.dist)+' km (runs of 2 km or more)',1):card('Fastest pace','','',null,'Needs a run of 2 km or more',0);
  [3,5,8,10].forEach(function(D){
    var r=c['d'+D];
    if(r){var proj=r.dist>D+0.1;h+=card('Fastest '+D+'K',fmtTime(r.secs/r.dist*D),'',r,fmtDate(r.date)+(proj?' · average pace of a '+fmtKm(r.dist)+' km run':''),1)}
    else h+=card('Fastest '+D+'K','','',null,'Run '+D+' km or more to unlock',0);
  });
  var bw=rec.bestWeek;
  h+=bw?card('Biggest week',fmtKm(bw.km),'km',{date:addDays(bw.key,6)},'Week of '+fmtDate(bw.key)+' · '+bw.n+(bw.n===1?' run':' runs'),1):card('Biggest week','','',null,'Log a week of running',0);
  var mr=rec.mostRuns;
  h+=mr?card('Most runs in a week',mr.n,'runs',{date:addDays(mr.key,6)},'Week of '+fmtDate(mr.key)+' · '+fmtKm(mr.km)+' km',1):card('Most runs in a week','','',null,'Log a week of running',0);
  if(S.base10k)h+='<div class="pbc"><div class="l">Starting 10K</div><div class="v">'+fmtTime(S.base10k)+'</div><div class="d">Your baseline at '+fmtPace(S.base10k/10)+' /km</div></div>';
  $('#pbs').innerHTML=h;
  // history grouped by run
  var groups=[],gm={};
  rec.ev.forEach(function(e){if(!gm[e.id]){gm[e.id]={id:e.id,date:e.date,items:[]};groups.push(gm[e.id])}gm[e.id].items.push(e)});
  groups.reverse();
  var byId={};S.runs.forEach(function(r){byId[r.id]=r});
  $('#hist').innerHTML=groups.length?groups.map(function(g,i){
    var r=byId[g.id],isFirst=g===groups[groups.length-1];
    return '<div class="h"><div class="hd">'+fmtDateL(g.date)+(r&&r.example?' <span class="tag ex">Example</span>':'')+'</div><div class="hl">'+g.items.map(function(e){return '<span><span class="diamond"></span>'+esc(e.title)+': <b class="tab-nums">'+esc(e.value)+'</b></span>'}).join('')+(isFirst?'<span class="muted small">First logged run, so everything starts here.</span>':'')+'</div></div>';
  }).join(''):'<div class="empty">Your records will build up here as you log runs.</div>';
}

/* ---------- orchestration ---------- */
function renderAll(){
  renderSub();renderBanners();renderNext();renderTiles();renderPaces();renderRunList();renderPlan();renderRecords();
  if(!$('#v-overview').hidden)drawChart();
}
var TABS=['overview','log','plan','records'];
function showTab(){
  var h=(location.hash||'').replace('#','');if(TABS.indexOf(h)<0)h='overview';
  TABS.forEach(function(n){
    $('#v-'+n).hidden=n!==h;$('#t-'+n).setAttribute('aria-selected',n===h?'true':'false');
  });
  if(h==='overview')requestAnimationFrame(drawChart);
}

function onClick(e){
  var b=e.target.closest('[data-act]');
  if(!b){
    var c=e.target.closest('[data-chart]');
    if(c){chartMode=c.getAttribute('data-chart');$$('#chartSeg button').forEach(function(x){x.setAttribute('aria-pressed',x===c?'true':'false')});drawChart()}
    return;
  }
  var act=b.getAttribute('data-act');
  if(act==='clearEx'){S.runs=S.runs.filter(function(r){return !r.example});persist();renderAll()}
  else if(act==='edit'){location.hash='#log';startEdit(b.getAttribute('data-id'))}
  else if(act==='del'){
    if(b.getAttribute('data-sure')){var id=b.getAttribute('data-id');S.runs=S.runs.filter(function(r){return r.id!==id});if(editingId===id)resetForm();persist();renderAll()}
    else{
      $$('[data-act="del"]').forEach(function(x){x.removeAttribute('data-sure');x.textContent='Delete'});
      b.setAttribute('data-sure','1');b.textContent='Confirm delete';
      clearTimeout(delTimer);delTimer=setTimeout(function(){b.removeAttribute('data-sure');b.textContent='Delete'},3500);
    }
  }
  else if(act==='prefill'){
    var w=+b.getAttribute('data-w'),k=b.getAttribute('data-k'),pw=planWeeks()[w],s=pw.slots.filter(function(x){return x.k===k})[0];
    location.hash='#log';
    if(s.run){startEdit(s.run.id);return}
    resetForm();
    $('#f-type').value=k;$('#f-dist').value=s.target;
    var t=todayStr();$('#f-date').value=(s.date<t||t<pw.mon)?s.date:t;
    updatePreview();
    setTimeout(function(){$('#f-time').focus()},50);
  }
  else if(act==='str'){
    var wi=+b.getAttribute('data-w'),n=+b.getAttribute('data-n'),cur=S.strength[wi]||0;
    S.strength[wi]=cur===n?n-1:n;persist();renderPlan();
  }
}

function init(){
  initTheme();
  try{$('#rememberMe').checked=localStorage.getItem('runtracker-remember')!=='false'}catch(e){}
  $('#themeBtn').addEventListener('click',function(){
    setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
    if(!$('#v-overview').hidden)requestAnimationFrame(drawChart);
  });
  $('#authForm').addEventListener('submit',function(e){
    e.preventDefault();
    authError('');
    var email=$('#authEmail').value.trim(),password=$('#authPassword').value;
    try{localStorage.setItem('runtracker-remember',$('#rememberMe').checked?'true':'false')}catch(e){}
    $('#signInBtn').disabled=true;
    supabaseClient.auth.signInWithPassword({email:email,password:password}).then(function(result){
      if(result.error)throw result.error;
    }).catch(function(e){authError(e.message)}).finally(function(){$('#signInBtn').disabled=false});
  });
  $('#registerForm').addEventListener('submit',function(e){
    e.preventDefault();
    var name=$('#registerName').value.trim(),age=Number($('#registerAge').value),email=$('#registerEmail').value.trim(),password=$('#registerPassword').value,confirm=$('#registerConfirm').value;
    $('#registerErr').textContent='';
    if(password!==confirm){$('#registerErr').textContent='Passwords do not match.';return}
    if(!age||age<13||age>120){$('#registerErr').textContent='Enter an age between 13 and 120.';return}
    $('#registerBtn').disabled=true;
    supabaseClient.auth.signUp({email:email,password:password,options:{data:{full_name:name,age:age}}}).then(function(result){
      if(result.error)throw result.error;
      $('#registerErr').textContent=result.data.session?'Account created.':'Account created. Check your email to confirm your account.';
    }).catch(function(e){$('#registerErr').textContent=e.message}).finally(function(){$('#registerBtn').disabled=false});
  });
  $('#showRegister').addEventListener('click',function(){
    $('#authForm').hidden=true;$('#registerForm').hidden=false;$('#authCard h2').textContent='Create your account';$('#registerName').focus();
  });
  $('#showLogin').addEventListener('click',function(){
    $('#registerForm').hidden=true;$('#authForm').hidden=false;$('#authCard h2').textContent='Sign in to continue';$('#authEmail').focus();
  });
  $('#googleSignIn').addEventListener('click',function(){
    authError('');
    supabaseClient.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin+window.location.pathname}
    }).then(function(result){
      if(result.error)throw result.error;
    }).catch(function(e){authError(e.message)});
  });
  $('#forgotPassword').addEventListener('click',function(){
    authError('');
    var email=$('#authEmail').value.trim();
    if(!email){authError('Enter your email first, then choose Forgot password.');$('#authEmail').focus();return}
    supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname}).then(function(result){
      if(result.error)throw result.error;
      authError('Password reset instructions sent. Check your email.');
    }).catch(function(e){authError(e.message)});
  });
  $('#passwordToggle').addEventListener('click',function(){
    var input=$('#authPassword'),visible=input.type==='text';
    input.type=visible?'password':'text';
    this.textContent=visible?'Show':'Hide';
    this.setAttribute('aria-label',visible?'Show password':'Hide password');
  });
  $('#signOutBtn').addEventListener('click',function(){
    supabaseClient.auth.signOut().catch(function(e){authError(e.message)});
  });
  $('#tabs').addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(b)location.hash='#'+b.getAttribute('data-tab')});
  window.addEventListener('hashchange',showTab);
  document.addEventListener('click',onClick);
  $('#runForm').addEventListener('submit',submitRun);
  $('#cancelEdit').addEventListener('click',resetForm);
  ['f-dist','f-time'].forEach(function(id){$('#'+id).addEventListener('input',updatePreview)});
  $('#f-rpe').addEventListener('input',function(){$('#rpeOut').textContent=this.value});
  $('#f-date').addEventListener('change',function(){if(!editingId&&this.value)$('#f-type').value=suggestType(this.value)});
  $('#exportBtn').addEventListener('click',exportCsv);
  $('#tblBtn').addEventListener('click',function(){tableView=!tableView;this.setAttribute('aria-pressed',tableView);this.textContent=tableView?'Chart view':'Table view';drawChart()});
  $('#planStart').addEventListener('change',function(){if(!this.value)return;S.start=mondayOf(this.value);persist();renderAll()});
  $('#saveBase').addEventListener('click',function(){
    var s=parseTime($('#base10k').value),err=$('#baseErr');
    if(!s||s<1200||s>10800){err.textContent='Enter your 10K time as h:mm:ss or mm:ss, for example 1:02:30.';return}
    err.textContent='';S.base10k=s;persist();renderAll();
  });
  $('#clearBase').addEventListener('click',function(){S.base10k=null;persist();renderAll()});
  var ro=null;
  if(window.ResizeObserver){var last=0;ro=new ResizeObserver(function(){var w=$('#chart').clientWidth;if(w&&Math.abs(w-last)>2){last=w;drawChart()}});ro.observe($('#chart'))}
  resetForm();showTab();renderAll();
  bootStore();
}

/* ---------- storage ---------- */
function useLocal(){
  store={kind:'local',ref:null};
  var raw=null;try{raw=localStorage.getItem('runtracker-v1')}catch(e){}
  if(raw){try{applyData(JSON.parse(raw))}catch(e){S.runs=exampleRuns()}}else S.runs=exampleRuns();
  setChip('Saved on this device only',false);renderAll();
}
function bootStore(){
  S.runs=exampleRuns();renderAll();
  initSupabase().catch(function(e){
    console.error('Supabase initialization failed',e);
    setAuthUi(null);
    authError('Cloud storage is unavailable. Your data will be saved on this device.');
    useLocal();
  });
}

init();
})();
