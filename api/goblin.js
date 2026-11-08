/*!
 * Red Goblin: formant speech synthesizer (Russian + English)
 * Works in Node.js (CommonJS) and in the browser (global `Goblin`).
 *
 *   const Goblin = require('./goblin.js');
 *   const samples = Goblin.synthesize('Hello, I am the red goblin', {lang: 'en'}); // Float32Array, 22050 Hz mono
 *   const wav = Goblin.toWav(samples);                                              // Uint8Array (16-bit WAV)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Goblin = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const FS = 22050;

// ====================================================================
//  RUSSIAN: text -> phonemes -> segments
// ====================================================================
function makeRu() {
  const V={а:[730,1090,2440],о:[570,840,2410],у:[300,870,2240],э:[530,1840,2480],и:[280,2250,2900],ы:[330,1500,2400],A:[600,1250,2450],I:[380,1900,2650]};
  const SN={м:[250,1000,2200,.55,75],н:[250,1500,2500,.55,70],л:[400,900,2600,.7,75],р:[450,1300,1800,.7,70],й:[280,2200,3000,.7,55],в:[300,1100,2300,.7,70]};
  const FR={с:[5500,2400,.7,0,110],з:[4600,2200,.5,1,100],ш:[2700,1300,.95,0,130],ж:[2500,1300,.75,1,115],ф:[4500,3500,.15,0,90],х:[2400,2600,.5,0,100],щ:[3700,1500,.85,0,150],ч:[3800,1600,.85,0,85]};
  const ST={п:[900,1200,800,0],б:[900,1200,800,1],т:[4500,2500,1700,0],д:[4500,2500,1700,1],к:[2300,1500,1800,0],г:[2300,1500,1800,1]};
  const LAT={a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'х',i:'и',j:'ж',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',x:'кс',y:'й',z:'з'};
  const DIG=['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const CONS='бвгджзйклмнпрстфхцчшщ',VOW='аоуэыияеёю';
  const PAIR={б:'п',в:'ф',г:'к',д:'т',ж:'ш',з:'с'},PAIRR={п:'б',ф:'в',к:'г',т:'д',ш:'ж',с:'з'};
  const has=(s,c)=>c!==undefined&&c!==''&&s.includes(c);
  const DICT={гоблин:'г+облин',красный:'кр+асный',буду:'б+уду',вами:'в+ами',свами:'св+ами',сегодня:'сев+одня',что:'шт+о',чтобы:'шт+обы',конечно:'кон+ешно',очень:'+очень',привет:'прив+ет',спасибо:'спас+ибо',пожалуйста:'пож+алуйста',здравствуйте:'здр+авствуйте',хорошо:'хорош+о',хороший:'хор+оший',сейчас:'сейч+ас',можно:'м+ожно',нужно:'н+ужно',потому:'потом+у',почему:'почем+у',когда:'когд+а',тогда:'тогд+а',здесь:'зд+есь',тоже:'т+оже',также:'т+акже',только:'т+олько',который:'кот+орый',которая:'кот+орая',которое:'кот+орое',которые:'кот+орые',этот:'+этот',эта:'+эта',это:'+это',эти:'+эти',всегда:'всегд+а',никогда:'никогд+а',теперь:'теп+ерь',между:'меж+ду',через:'ч+ерез',после:'п+осле',перед:'п+еред',снова:'сн+ова',даже:'д+аже',если:'+если',будет:'б+удет',была:'был+а',было:'б+ыло',были:'б+ыли',человек:'челов+ек',люди:'л+юди',время:'вр+емя',работа:'раб+ота',слово:'сл+ово',голос:'г+олос',язык:'яз+ык',вопрос:'вопр+ос',ответ:'отв+ет',проблема:'пробл+ема',делать:'д+елать',говорить:'говор+ить',сказать:'сказ+ать',хотеть:'хот+еть',говорит:'говор+ит',уже:'уж+е',тебя:'теб+я',меня:'мен+я',себя:'себ+я',тебе:'теб+е',какой:'как+ой',такой:'так+ой',другой:'друг+ой',один:'од+ин',хочу:'хоч+у'};
  const WEAK=new Set('в во к ко с со у о об от до из за на по при про для без над под не ни бы ли же и а но или'.split(' '));
  function word2ph(w){
    if(!w.includes('+')&&DICT[w])w=DICT[w];
    const weak=WEAK.has(w);
    w=w.replace(/ть?ся$/,'ца');
    if(/^(конечно|скучно|нарочно|яичница|скворечник)/.test(w.replace(/\+/g,'')))w=w.replace('ч','ш');
    const L=[];let st=-1;
    for(const c of w){if(c==='+'){st=L.length;continue;}L.push(c);}
    const vi=L.map((c,i)=>has(VOW,c)?i:-1).filter(i=>i>=0);
    if(!vi.length)return [];
    const yo=L.indexOf('ё');
    if(yo>=0)st=yo; else if(vi.length===1&&!weak)st=vi[0];
    const known=st>=0||weak,n=L.length;
    if(L[0]==='ч'&&L[1]==='т')L[0]='ш';
    if(n>=3&&L[n-1]==='о'&&L[n-2]==='г'&&has('ое',L[n-3]))L[n-2]='в';
    const P=[];
    for(let i=0;i<n;i++){
      const c=L[i],pv=L[i-1],nx=L[i+1];
      if(c==='ь'||c==='ъ')continue;
      if(has(VOW,c)){
        const after=has(CONS,pv),iot=has('яеёю',c);
        if(iot&&!after)P.push({c:'й',soft:true});
        let b={я:'а',е:'э',ё:'о',ю:'у'}[c]||c;
        if(c==='и'&&after&&has('жшц',pv))b='ы';
        const stress=i===st;let red=false;
        if(known&&!stress){
          if(c==='я'||c==='е'){b='I';red=true;}
          else if(b==='а'||b==='о'){b='A';red=true;}
        }
        P.push({c:b,v:1,stress,red,known});
      }else if(has(CONS,c)){
        if(c==='ц'){P.push({c:'т'},{c:'с'});continue;}
        if(c==='ч'){P.push({c:'т',soft:true},{c:'ч',soft:true});continue;}
        let soft=has('ьяеёюи',nx)&&!has('жшц',c);
        if(has('щй',c))soft=true;
        P.push({c,soft});
      }
    }
    for(let i=P.length-1;i>=0;i--){
      const p=P[i];
      if(p.v||!(p.c in PAIR||p.c in PAIRR))continue;
      const nx=P[i+1];let want=null;
      if(!nx)want=false;
      else if(!nx.v){if(has('бгджз',nx.c))want=true;else if(has('пфктшсхцчщ',nx.c))want=false;}
      if(want===true&&p.c in PAIRR)p.c=PAIRR[p.c];
      if(want===false&&p.c in PAIR)p.c=PAIR[p.c];
    }
    return P;
  }
  function tokens(text){
    text=text.toLowerCase().replace(/[a-z]/g,m=>LAT[m]).replace(/\d/g,m=>' '+DIG[+m]+' ');
    const out=[],re=/[а-яё+]+|[,.!?;:—-]+|\s+/g,PZ={',':260,';':220,':':220,'—':200,'-':60,'.':480,'!':480,'?':480};
    const NAMES={б:'б+э',в:'в+э',г:'г+э',д:'д+э',ж:'ж+э',з:'з+э',й:'и кр+аткое',к:'к+а',л:'+эль',м:'+эм',н:'+эн',п:'п+э',р:'+эр',с:'+эс',т:'т+э',ф:'+эф',х:'х+а',ц:'ц+э',ч:'ч+э',ш:'ш+а',щ:'щ+а',ь:'м+ягкий зн+ак',ъ:'тв+ёрдый зн+ак'};
    const mt=text.match(re)||[],isW=t=>/^[а-яё+]/.test(t),bare=t=>t.replace(/\+/g,'');
    const ws=mt.filter(isW);
    const spell=ws.length>=3&&ws.filter(t=>bare(t).length===1&&NAMES[bare(t)]).length>=ws.length*0.6;
    let carry='',lastWord=false;
    for(const t of mt){
      if(isW(t)){
        let parts=[t];
        if(bare(t).length===1&&NAMES[bare(t)]){
          if(spell)parts=NAMES[bare(t)].split(' ');else{carry+=t;continue;}
        }else if(carry){parts=[carry+t];carry='';}
        let first=true;
        for(const p of parts){const ph=word2ph(p);if(!ph.length)continue;if(lastWord)out.push({pause:first&&spell?160:80});first=false;out.push(...ph);lastWord=true;}
      }else if(!/^\s/.test(t)){out.push({pause:PZ[t[0]]||100,pm:t[0]===','?1.1:0});lastWord=false;carry='';}
    }
    out.push({pause:150});
    return out;
  }
  function build(list,o){
    const segs=[];let cur=1;
    const mk=(d,tr,p)=>({d,tr,f1:500,f2:1500,f3:2500,av:0,ah:0,an:0,nf:3000,nbw:1500,pm:cur,trill:false,...p});
    list.forEach((p,i)=>{
      if(p.pause){segs.push(mk(p.pause,12,{pm:p.pm||cur}));return;}
      if(p.v){
        cur=1+(p.stress?0.12*o.accent*3:0);
        const pv=list[i-1],f=V[p.c].slice();if(pv&&pv.soft&&p.c!=='и'&&p.c!=='I')f[1]+=0.4*(2100-f[1]);
        const d=p.stress?135:p.red?60:p.known?75:105;
        segs.push(mk(d,45,{f1:f[0],f2:f[1],f3:f[2],av:p.stress?1:p.red?.75:.85,ah:.005}));
        return;
      }
      const c=p.c,s=p.soft;
      if(SN[c]){
        let[f1,f2,f3,av,d]=SN[c];if(s)f2=Math.max(f2,1900);
        segs.push(mk(d*1.2,25,{f1,f2,f3,av,trill:c==='р'}));
      }else if(FR[c]){
        let[nf,bw,an,vo,d]=FR[c];if(s&&c!=='щ'&&c!=='ч')nf*=1.2;
        segs.push(mk(d*1.2,30,{f1:s?300:350,f2:s?2000:1500,f3:2600,av:vo?.35:0,an:an*o.hiss,nf,nbw:bw}));
      }else if(ST[c]){
        let[nf,bw,loc,vo]=ST[c];if(s){loc=2000;nf*=1.15;}
        const nx=list[i+1],F=nx&&nx.v?V[nx.c]:[500,1500,2500],v=vo?.3:0;
        segs.push(mk(vo?60:75,10,{f1:250,f2:loc,f3:2400,av:v}));
        segs.push(mk(12,3,{f1:250,f2:loc,f3:2400,av:v,an:.3*o.burst,nf,nbw:bw}));
        if(!vo)segs.push(mk(28,4,{f1:F[0],f2:F[1],f3:F[2],ah:.06*o.burst}));
      }
    });
    return segs;
  }
  return {tokens,build};
}

// ====================================================================
//  ENGLISH: text -> phonemes -> segments
// ====================================================================
function makeEn() {
  const VW={aa:[730,1090,2440],ae:[660,1720,2410],ah:[640,1190,2390],ao:[570,840,2410],eh:[530,1840,2480],er:[490,1350,1690],ih:[390,1990,2550],iy:[270,2290,3010],uh:[440,1020,2240],uw:[300,870,2240],ax:[500,1500,2500]};
  const DIPH={ay:['aa','ih'],ey:['eh','ih'],ow:['ao','uw'],aw:['aa','uw'],oy:['ao','ih']};
  const SN={m:[250,1000,2200,.55,75],n:[250,1500,2500,.55,70],ng:[250,1300,2300,.55,80],l:[400,900,2600,.7,75],r:[400,1100,1500,.7,80],w:[300,700,2200,.7,65],y:[280,2200,3000,.7,55]};
  const FR={s:[5500,2400,.7,0,110],z:[4600,2200,.5,1,100],sh:[2700,1300,.95,0,130],zh:[2500,1300,.75,1,115],f:[4500,3500,.15,0,90],v:[4500,3500,.15,1,80],th:[4500,3500,.12,0,90],dh:[4000,3000,.1,1,60],hh:[1800,2600,.5,0,80]};
  const ST={p:[900,1200,800,0],b:[900,1200,800,1],t:[4500,2500,1700,0],d:[4500,2500,1700,1],k:[2300,1500,1500,0],g:[2300,1500,1500,1]};
  const DIG=['zero','one','two','three','four','five','six','seven','eight','nine'];
  const isV=c=>c in VW||c in DIPH;
  const fv=c=>VW[c]||VW[DIPH[c][0]];
  const D={};
  ('the:dh ax|a:ax|an:ax n|and:ae n d|of:ah v|to:t uw|in:ih n|on:aa n|at:ae t|for:f er|but:b ah t|or:ao r|as:ae z|it:ih t|if:ih f|'+
  'you:y uw1|your:y ao1 r|i:ay1|am:ae1 m|is:ih1 z|are:aa1 r|was:w ah1 z|were:w er1|be:b iy|been:b ih1 n|have:hh ae1 v|has:hh ae1 z|do:d uw1|does:d ah1 z|done:d ah1 n|go:g ow1|goes:g ow1 z|gone:g ao1 n|'+
  'said:s eh1 d|says:s eh1 z|say:s ey1|they:dh ey1|them:dh eh1 m|then:dh eh1 n|there:dh eh1 r|their:dh eh1 r|this:dh ih1 s|that:dh ae1 t|these:dh iy1 z|those:dh ow1 z|than:dh ae1 n|with:w ih1 dh|'+
  'what:w ah1 t|when:w eh1 n|where:w eh1 r|who:hh uw1|why:w ay1|how:hh aw1|which:w ih1 ch|would:w uh1 d|could:k uh1 d|should:sh uh1 d|'+
  'zero:z iy1 r ow|one:w ah1 n|two:t uw1|three:th r iy1|four:f ao1 r|five:f ay1 v|six:s ih1 k s|seven:s eh1 v ax n|eight:ey1 t|nine:n ay1 n|ten:t eh1 n|'+
  'hello:hh ax l ow1|hi:hh ay1|goblin:g aa1 b l ih n|red:r eh1 d|me:m iy1|we:w iy1|he:hh iy1|she:sh iy1|my:m ay1|by:b ay1|no:n ow1|so:s ow1|yes:y eh1 s|'+
  'love:l ah1 v|give:g ih1 v|live:l ih1 v|come:k ah1 m|some:s ah1 m|none:n ah1 n|from:f r ah1 m|people:p iy1 p ax l|because:b ih k ah1 z|thank:th ae1 ng k|thanks:th ae1 ng k s|please:p l iy1 z|'+
  'very:v eh1 r iy|every:eh1 v r iy|want:w aa1 n t|here:hh iy1 r|hear:hh iy1 r|other:ah1 dh er|another:ax n ah1 dh er|mother:m ah1 dh er|brother:b r ah1 dh er|today:t ax d ey1|tonight:t ax n ay1 t|'+
  'world:w er1 l d|word:w er1 d|work:w er1 k|know:n ow1|now:n aw1|new:n uw1|only:ow1 n l iy|over:ow1 v er|never:n eh1 v er|ever:eh1 v er|any:eh1 n iy|many:m eh1 n iy|once:w ah1 n s|great:g r ey1 t|good:g uh1 d|'+
  'get:g eh1 t|got:g aa1 t|girl:g er1 l|gift:g ih1 f t|begin:b ih g ih1 n|doing:d uw1 ih ng|going:g ow1 ih ng|something:s ah1 m th ih ng|nothing:n ah1 th ih ng|thing:th ih1 ng|think:th ih1 ng k|'+
  'dont:d ow1 n t|cant:k ae1 n t|wont:w ow1 n t|im:ay1 m|ill:ay1 l|ive:ay1 v|its:ih1 t s|thats:dh ae1 t s|youre:y uh1 r|isnt:ih1 z ax n t|didnt:d ih1 d ax n t|doesnt:d ah1 z ax n t|lets:l eh1 t s|whats:w ah1 t s|theres:dh eh1 r z|hes:hh iy1 z|shes:sh iy1 z|'+
  'speak:s p iy1 k|voice:v oy1 s|dark:d aa1 r k|night:n ay1 t|light:l ay1 t|fight:f ay1 t|fire:f ay1 er|gold:g ow1 l d|treasure:t r eh1 zh er|monster:m aa1 n s t er|computer:k ah m p y uw1 t er|'+
  'water:w ao1 t er|little:l ih1 t ax l|table:t ey1 b ax l|again:ax g eh1 n|against:ax g eh1 n s t|before:b ih f ao1 r|after:ae1 f t er|about:ax b aw1 t|around:ax r aw1 n d|away:ax w ey1|'+
  'both:b ow1 th|most:m ow1 s t|post:p ow1 s t|old:ow1 l d|told:t ow1 l d|cold:k ow1 l d|child:ch ay1 l d|find:f ay1 n d|kind:k ay1 n d|mind:m ay1 n d|wild:w ay1 l d|'+
  'door:d ao1 r|floor:f l ao1 r|poor:p uh1 r|blood:b l ah1 d|flood:f l ah1 d|oh:ow1|okay:ow k ey1|ok:ow k ey1|english:ih1 ng g l ih sh|kill:k ih1 l|death:d eh1 th|head:hh eh1 d|dead:d eh1 d|bread:b r eh1 d|heart:hh aa1 r t|earth:er1 th|learn:l er1 n').split('|').forEach(e=>{const[k,v]=e.split(':');D[k]=v;});
  'ey1,b iy1,s iy1,d iy1,iy1,eh1 f,jh iy1,ey1 ch,ay1,jh ey1,k ey1,eh1 l,eh1 m,eh1 n,ow1,p iy1,k y uw1,aa1 r,eh1 s,t iy1,y uw1,v iy1,d ah1 b ax l y uw,eh1 k s,w ay1,z iy1'.split(',').forEach((v,i)=>{const k=String.fromCharCode(97+i);if(!D[k])D[k]=v;});
  D.a='ax';
  const WEAK=new Set('the a an and of to in on at for but or as it if be he she we me my by with is are was were am do'.split(' '));
  const y=re=>new RegExp(re,'y');
  const R=[
   [y('(?<=[aeiouy].*[td])ed$'),'ax d'],[y('(?<=[aeiouy].*(?:[pkfsx]|sh|ch|c))ed$'),'t'],[y('(?<=[aeiouy].+)ed$'),'d'],
   [y('(?<=[sxz]|sh|ch)es$'),'ax z'],[y('(?<=[aeiouy].*[bdglmnrvaeiouy])es$'),'z'],[y('(?<=[aeiouy].*)es$'),'s'],
   [y('a(?=[bcdfgklmnprstvz]e$)'),'ey'],[y('i(?=[bcdfgklmnprstvz]e$)'),'ay'],[y('o(?=[bcdfgklmnprstvz]e$)'),'ow'],[y('u(?=[bcdfgklmnprstvz]e$)'),'uw'],[y('e(?=[bcdfgklmnprstvz]e$)'),'iy'],
   [y('(?<=[^aeiouy])le$'),'ax l'],[y('(?<=[aeiouy][^aeiouy]+)e$'),''],
   [y('tion'),'sh ax n'],[y('sion'),'zh ax n'],[y('ture'),'ch er'],[y('ough'),'ow'],[y('eigh'),'ey'],[y('igh'),'ay'],[y('^gh'),'g'],[y('gh'),''],
   [y('ee|ea'),'iy'],[y('oo(?=k)'),'uh'],[y('oo'),'uw'],[y('ou'),'aw'],[y('ow$'),'ow'],[y('ow'),'aw'],[y('oa'),'ow'],[y('ai|ay'),'ey'],[y('oi|oy'),'oy'],[y('au|aw'),'ao'],[y('ie'),'iy'],[y('ew|ue'),'uw'],[y('ei'),'ey'],
   [y('ar'),'aa r'],[y('or'),'ao r'],[y('er|ir|ur'),'er'],
   [y('ch'),'ch'],[y('ck'),'k'],[y('sh'),'sh'],[y('th'),'th'],[y('ph'),'f'],[y('wh'),'w'],[y('ng'),'ng'],[y('nk'),'ng k'],[y('qu'),'k w'],[y('^kn'),'n'],[y('^wr'),'r'],[y('(?<=m)b$'),''],
   [y('c(?=[eiy])'),'s'],[y('c'),'k'],[y('g(?=[eiy])'),'jh'],[y('g'),'g'],
   [y('(?<=[aeiouy])s(?=[aeiouy])'),'z'],[y('(?<=[aeiouybdglmnrv])s$'),'z'],[y('s'),'s'],
   [y('x'),'k s'],[y('j'),'jh'],[y('q'),'k'],[y('^y'),'y'],[y('(?<=[^aeiouy])y$'),'iy'],[y('y'),'ih']
  ];
  const S={a:'ae',e:'eh',i:'ih',o:'aa',u:'ah',b:'b',d:'d',f:'f',h:'hh',k:'k',l:'l',m:'m',n:'n',p:'p',r:'r',t:'t',v:'v',w:'w',z:'z'};
  function rules(w){
    w=w.replace(/([bdfgklmnprstz])\1/g,'$1');
    const o=[];let i=0;
    while(i<w.length){
      let hit=false;
      for(const[re,p]of R){re.lastIndex=i;const m=re.exec(w);if(m){if(p)o.push(...p.split(' '));i+=m[0].length||1;hit=true;break;}}
      if(!hit){if(S[w[i]])o.push(S[w[i]]);i++;}
    }
    return o;
  }
  function parse(ph,dict,weak){
    const vi=[];ph.forEach((p,i)=>{if(isV(p.replace(/1$/,'')))vi.push(i);});
    const anyS=vi.some(j=>/1$/.test(ph[j])),out=[];
    ph.forEach((p,i)=>{
      let c=p.replace(/1$/,''),st=/1$/.test(p);
      if(isV(c)){
        if(!dict&&i===vi[0])st=true;
        if(dict&&!anyS&&vi.length===1&&!weak)st=true;
        if(!st&&!dict&&!(c in DIPH)&&c!=='er'&&c!=='iy'&&c!=='uw')c='ax';
        out.push({c,v:1,stress:st,red:!st});
      }else if(c==='ch'){out.push({c:'t',aff:1},{c:'sh'});}
      else if(c==='jh'){out.push({c:'d',aff:1},{c:'zh'});}
      else if(SN[c]||FR[c]||ST[c])out.push({c});
    });
    return out;
  }
  function tokens(text){
    text=text.toLowerCase().replace(/\d/g,m=>' '+DIG[+m]+' ');
    const out=[],re=/\{[^}]*\}|[a-z']+|[,.!?;:—-]+|\s+/g,PZ={',':260,';':220,':':220,'—':200,'-':60,'.':480,'!':480,'?':480};
    let lastWord=false;
    for(const t of text.match(re)||[]){
      let ph=null,dict=false,weak=false;
      if(t[0]==='{'){ph=t.slice(1,-1).trim().split(/\s+/).filter(Boolean);dict=true;}
      else if(/^[a-z']/.test(t)){
        const w=t.replace(/'/g,'');if(!w)continue;
        weak=WEAK.has(w);
        if(D[w]){ph=D[w].split(' ');dict=true;}else ph=rules(w);
      }
      if(ph){
        const p=parse(ph,dict,weak);if(!p.length)continue;
        if(lastWord)out.push({pause:60});
        out.push(...p);lastWord=true;
      }else if(!/^\s/.test(t)){out.push({pause:PZ[t[0]]||100,pm:t[0]===','?1.1:0});lastWord=false;}
    }
    out.push({pause:150});
    return out;
  }
  function build(list,o){
    const segs=[];let cur=1;
    const mk=(d,tr,p)=>({d,tr,f1:500,f2:1500,f3:2500,av:0,ah:0,an:0,nf:3000,nbw:1500,pm:cur,trill:false,...p});
    list.forEach((p,i)=>{
      if(p.pause){segs.push(mk(p.pause,12,{pm:p.pm||cur}));return;}
      if(p.v){
        cur=1+(p.stress?0.12*o.accent*3:0);
        const av=p.stress?1:p.red?.75:.85;
        if(DIPH[p.c]){
          const a=VW[DIPH[p.c][0]],b=VW[DIPH[p.c][1]];
          segs.push(mk(p.stress?100:55,40,{f1:a[0],f2:a[1],f3:a[2],av,ah:.005}));
          segs.push(mk(p.stress?85:45,70,{f1:b[0],f2:b[1],f3:b[2],av:av*.9,ah:.005}));
        }else{
          const f=VW[p.c];
          segs.push(mk(p.stress?(p.c==='er'?150:130):p.red?55:80,45,{f1:f[0],f2:f[1],f3:f[2],av,ah:.005}));
        }
        return;
      }
      const c=p.c;
      if(SN[c]){
        const[f1,f2,f3,av,d]=SN[c];
        segs.push(mk(d*1.2,25,{f1,f2,f3,av}));
      }else if(FR[c]){
        const[nf,bw,an,vo,d]=FR[c];
        segs.push(mk(d*1.2,30,{f1:350,f2:1500,f3:2600,av:vo?.35:0,an:an*o.hiss,nf,nbw:bw}));
      }else if(ST[c]){
        let[nf,bw,loc,vo]=ST[c];
        const nx=list[i+1],F=nx&&nx.v?fv(nx.c):[500,1500,2500],v=vo?.3:0;
        if(c==='k'||c==='g')loc=F[1]>1700?2000:1400;
        const asp=nx&&nx.v&&nx.stress?42:24;
        segs.push(mk(p.aff?42:vo?60:75,10,{f1:250,f2:loc,f3:2400,av:v}));
        segs.push(mk(12,3,{f1:250,f2:loc,f3:2400,av:v,an:.3*o.burst,nf,nbw:bw}));
        if(!vo&&!p.aff)segs.push(mk(asp,4,{f1:F[0],f2:F[1],f3:F[2],ah:.06*o.burst}));
      }
    });
    return segs;
  }
  return {tokens,build};
}

// ====================================================================
//  Shared formant synthesizer (simplified Klatt)
// ====================================================================
function render(segs,o,question){
  const N=segs.map(s=>Math.max(1,Math.round(s.d*FS/1000/o.speed)));
  const total=N.reduce((a,b)=>a+b,0),out=new Float32Array(total);
  const keys=['f1','f2','f3','av','ah','an','nf','nbw','pm'];
  const P={f1:500,f2:1500,f3:2500,av:0,ah:0,an:0,nf:3000,nbw:1500,pm:1};
  const rs=Array.from({length:6},()=>[0,0]),co=Array.from({length:6},()=>[0,0,0]);
  const setC=(k,f,bw)=>{const r=Math.exp(-Math.PI*bw/FS),B=2*r*Math.cos(2*Math.PI*f/FS),C=-r*r;co[k]=[1-B-C,B,C];};
  let ph=0,pos=0,seed=12345,xp=0;
  const setN=(f,bw)=>{setC(5,f,bw);const c=co[5],w=2*Math.PI*f/FS;const re=1-c[1]*Math.cos(w)-c[2]*Math.cos(2*w),im=c[1]*Math.sin(w)+c[2]*Math.sin(2*w);const pk=c[0]/Math.hypot(re,im);const pg=pk*pk*Math.min(1,bw*1.57/(FS/2));c[0]/=Math.sqrt(Math.max(pg,1e-4));};
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  const qStart=total-0.35*FS;
  segs.forEach((s,si)=>{
    const n=N[si],trn=Math.max(1,Math.min(n,Math.round(s.tr*FS/1000/o.speed))),from={...P};
    for(let i=0;i<n;i++,pos++){
      const a=Math.min(1,(i+1)/trn);
      for(const k of keys)P[k]=from[k]+(s[k]-from[k])*a;
      let f0=o.pitch*P.pm*(1-0.15*o.accent*(pos/total));
      if(question&&pos>qStart)f0*=1+0.5*(pos-qStart)/(0.35*FS);
      ph+=f0/FS;if(ph>=1)ph-=1;
      const g=ph<0.6?0.5*(1-Math.cos(Math.PI*ph/0.6)):ph<0.75?Math.cos(Math.PI*(ph-0.6)/0.3):0;
      const av=P.av*(s.trill?0.55+0.45*Math.sin(6.2832*28*pos/FS):1);
      let yv=av*(g-0.4)+P.ah*rnd();
      if(pos%8===0){const k=o.fm;setC(0,P.f1*k,90);setC(1,P.f2*k,120);setC(2,P.f3*k,180);setC(3,3400*k,250);setC(4,4300*k,320);setN(Math.min(P.nf,9000),Math.max(300,P.nbw));}
      for(let k=0;k<5;k++){const c=co[k],r=rs[k],v=c[0]*yv+c[1]*r[0]+c[2]*r[1];r[1]=r[0];r[0]=v;yv=v;}
      const c5=co[5],r5=rs[5],nv=c5[0]*rnd()+c5[1]*r5[0]+c5[2]*r5[1];r5[1]=r5[0];r5[0]=nv;
      const fr=P.an*nv*(1-Math.min(1,P.av*3)*0.4*(1-g));
      const x=yv*0.3+fr*0.45;
      out[pos]=x-0.65*xp;xp=x;
    }
  });
  const a=1-Math.exp(-2*Math.PI*6200/FS);let l1=0,l2=0;
  for(let i=0;i<total;i++){l1+=a*(out[i]-l1);l2+=a*(l1-l2);out[i]=l2;}
  const pk=()=>{const s=Float32Array.from(out,Math.abs).sort();return Math.max(s[Math.floor(total*0.995)],1e-6);};
  const m0=pk();let env=0;
  const atk=1-Math.exp(-1/(FS*0.002)),rel=1-Math.exp(-1/(FS*0.08));
  for(let i=0;i<total;i++){const v=Math.abs(out[i]);env+=(v>env?atk:rel)*(v-env);out[i]*=Math.min(3.5,Math.max(0.4,Math.pow(0.3*m0/Math.max(env,0.03*m0),0.55)));}
  const mx=pk();
  const hold=1+Math.floor(o.crush*2),bits=Math.round(16-o.crush*6),stp=Math.pow(2,bits-1);
  let held=0;
  for(let i=0;i<total;i++){if(i%hold===0)held=Math.tanh(out[i]*o.vol/mx)*0.98;out[i]=Math.round(held*stp)/stp;}
  return out;
}

// split long text into chunks of ~160 chars at sentence / comma boundaries
function split(t){
  const out=[];
  for(const s of (t.match(/[^.!?\n]+[.!?]*/g)||[])){
    let cur='';
    for(const p of (s.match(/[^,;:]+[,;:]*/g)||[s])){
      if(cur&&cur.length+p.length>160){out.push(cur);cur='';}
      cur+=p;
    }
    if(cur.trim())out.push(cur);
  }
  return out;
}

const ENGINES={ru:makeRu(),en:makeEn()};
const RANGES={speed:[0.6,1.6,0.8],pitch:[70,220,105],accent:[0,1,0.5],fm:[0.8,1.35,1],crush:[0,1,0.1],vol:[0.8,3,1.5],hiss:[0,1.5,0.5],burst:[0,1,0.6]};

function options(opts){
  opts=opts||{};
  const o={};
  for(const k in RANGES){
    const [lo,hi,def]=RANGES[k],v=parseFloat(opts[k]);
    o[k]=Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):def;
  }
  return o;
}

/** text -> Float32Array (mono, 22050 Hz, range -1..1). opts: lang ('en'|'ru'), speed, pitch, accent, fm, crush, vol, hiss, burst */
function synthesize(text,opts){
  const lang=(opts&&opts.lang)||'en';
  const eng=ENGINES[lang];
  if(!eng)throw new Error('Unsupported language: '+lang+' (use "en" or "ru")');
  const o=options(opts),parts=[];
  let n=0;
  for(const chunk of split(String(text))){
    const list=eng.tokens(chunk);
    if(list.length<2)continue;
    const data=render(eng.build(list,o),o,/\?\s*$/.test(chunk.trim()));
    parts.push(data);n+=data.length;
  }
  const all=new Float32Array(n);let k=0;
  for(const p of parts){all.set(p,k);k+=p.length;}
  return all;
}

/** Float32Array -> Uint8Array containing a 16-bit mono PCM WAV file */
function toWav(f){
  const n=f.length,b=new ArrayBuffer(44+n*2),v=new DataView(b);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,FS,true);v.setUint32(28,FS*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,f[i]))*32767,true);
  return new Uint8Array(b);
}

return {synthesize,toWav,sampleRate:FS,languages:Object.keys(ENGINES),defaults:Object.fromEntries(Object.entries(RANGES).map(([k,v])=>[k,v[2]])),ranges:RANGES};
});
