(function(){
  const { useState, useEffect, useMemo, useRef } = React;
  const h = React.createElement;

  // Storage
  const LS_KEY = 'expenseshare_v1';
  const LS_THEME = 'expenseshare_theme';
  const LS_SEEN = 'expenseshare_seen_landing';
  const defaultState = { groups: [] };
  function loadState(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return defaultState; const d=JSON.parse(raw); return d&&d.groups? d: defaultState; }catch(e){ return defaultState; } }
  function saveState(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }

  // Utils
  const uid = () => Math.random().toString(36).slice(2,9);
  const currency = (n) => (n||0).toLocaleString('en-IN',{style:'currency',currency:'INR'});

  // Fun: Confetti burst
  function ensureFxLayer(){ let el = document.querySelector('.fx-layer'); if(!el){ el = document.createElement('div'); el.className='fx-layer'; document.body.appendChild(el);} return el; }
  function burstConfetti(count=60){ const layer = ensureFxLayer(); const colors=['#2563eb','#f59e0b','#10b981','#ef4444','#7c3aed','#0ea5e9']; const vw = window.innerWidth; for(let i=0;i<count;i++){ const s=document.createElement('div'); s.className='confetti'; s.style.left = Math.random()*vw + 'px'; s.style.top = (-Math.random()*80)+'px'; s.style.background = colors[i%colors.length]; s.style.animationDelay = (Math.random()*0.4)+'s'; layer.appendChild(s); setTimeout(()=> layer.removeChild(s), 1600); } }

  // Debt simplification
  function simplifyDebts(members, expenses){
    const idx = Object.fromEntries(members.map((m,i)=>[m,i]));
    const net = new Array(members.length).fill(0);
    for(const ex of expenses){
      const pi = idx[ex.payer];
      for(const s of ex.splits){
        const j = idx[s.member];
        net[pi]+=s.amount; net[j]-=s.amount;
      }
    }
    const res=[]; const eps=1e-6;
    function maxI(a){let m=0; for(let i=1;i<a.length;i++) if(a[i]>a[m]) m=i; return m;}
    function minI(a){let m=0; for(let i=1;i<a.length;i++) if(a[i]<a[m]) m=i; return m;}
    function settle(){
      const mx=maxI(net), mn=minI(net);
      if(Math.abs(net[mx])<eps && Math.abs(net[mn])<eps) return;
      const amt = Math.min(net[mx], -net[mn]);
      if(amt>eps){ res.push({from: members[mn], to: members[mx], amount: amt}); net[mx]-=amt; net[mn]+=amt; settle(); }
    }
    settle();
    return res;
  }

  // Components
  function Modal(props){
    if(!props.open) return null;
    return h('div', {className:'modal'},
      h('div', {className:'modal-back', onClick: props.onClose}),
      h('div', {className:'modal-card'},
        h('div', {className:'modal-head'},
          h('h3', null, props.title || ''),
          h('button', {className:'btn', onClick: props.onClose, 'aria-label':'Close'}, '✕')
        ),
        h('div', {style:{display:'grid', gap:'12px'}}, props.children),
        h('div', {style:{marginTop:'12px', display:'flex', gap:'8px', justifyContent:'flex-end'}}, props.actions)
      )
    );
  }

  function CreateGroupModal({ open, onClose, onCreate }){
    const [name, setName] = useState('');
    const [memberInput, setMemberInput] = useState('');
    const [members, setMembers] = useState([]);
    function addMember(){ const m = memberInput.trim(); if(!m) return; if(members.includes(m)) return; setMembers([...members, m]); setMemberInput(''); }
    function handleCreate(){ if(!name.trim() || members.length<1) return; onCreate({ id: uid(), name: name.trim(), members, expenses: [] }); setName(''); setMembers([]); setMemberInput(''); onClose(); }
    return h(Modal, { open, onClose, title:'Create Group', actions: [
      h('button', { key:'c', className:'btn', onClick:onClose }, 'Cancel'),
      h('button', { key:'cr', className:'btn btn-primary', disabled:!name.trim()||members.length<1, onClick:handleCreate }, 'Create')
    ]},
      h('div', null,
        h('div',{className:'label'}, 'Group Name'),
        h('input',{className:'input', value:name, onChange:e=>setName(e.target.value), placeholder:'Trip to Goa'})
      ),
      h('div', null,
        h('div',{className:'label'}, 'Members'),
        h('div',{className:'row'},
          h('input',{className:'input', value:memberInput, placeholder:'Add member name', onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault(); addMember();}}, onChange:e=>setMemberInput(e.target.value)}),
          h('button',{className:'btn', onClick:addMember}, 'Add')
        ),
        h('div',{className:'wrap'}, members.map(m=> h('span',{key:m,className:'badge'}, m, h('button',{className:'btn', style:{padding:'2px 6px'}, onClick:()=>setMembers(members.filter(x=>x!==m))}, '×'))))
      )
    );
  }

  function ExpenseModal({ open, onClose, group, onAdd }){
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [payer, setPayer] = useState(group? group.members[0]: '');
    const [splitType, setSplitType] = useState('equal');
    const [splits, setSplits] = useState(group? group.members.map(m=>({member:m, value:''})): []);

    useEffect(()=>{ if(group){ setPayer(group.members[0]||''); setSplits(group.members.map(m=>({member:m,value:''}))); } }, [group&&group.id, open]);

    const total = parseFloat(amount||'0')||0;

    function computeSplits(){
      if(!group) return [];
      if(splitType==='equal'){ const each = total/(group.members.length||1); return group.members.map(m=>({member:m, amount:+each.toFixed(2)})); }
      if(splitType==='exact'){ return splits.map(s=>({member:s.member, amount:+((parseFloat(s.value||'0')||0).toFixed(2))})); }
      if(splitType==='percent'){ return splits.map(s=>({member:s.member, amount:+(((parseFloat(s.value||'0')||0)/100*total).toFixed(2))})); }
      if(splitType==='shares'){ const ss = splits.map(s=>({member:s.member, share:parseFloat(s.value||'0')||0})); const sum = ss.reduce((a,b)=>a+b.share,0); return ss.map(s=>({member:s.member, amount: sum? +(total*(s.share/sum)).toFixed(2):0})); }
      return [];
    }

    const computed = computeSplits();
    const sumComputed = computed.reduce((a,b)=>a+(b.amount||0),0);
    const exactValid = splitType!=='exact' || Math.abs(sumComputed-total)<0.01;
    const percentValid = splitType!=='percent' || Math.abs(splits.reduce((a,b)=>a+(parseFloat(b.value||'0')||0),0)-100)<0.01;
    const canSave = description.trim() && total>0 && payer && exactValid && percentValid;

    function handleSave(){ if(!canSave) return; const entry={ id:uid(), description:description.trim(), amount: total, payer, splitType, splits: computed, createdAt: Date.now() }; onAdd(entry); setDescription(''); setAmount(''); setSplitType('equal'); onClose(); }

    return h(Modal, { open, onClose, title:'Add Expense', actions:[
      h('button',{key:'c',className:'btn',onClick:onClose},'Cancel'),
      h('button',{key:'s',className:'btn btn-primary',disabled:!canSave,onClick:handleSave},'Save')
    ]},
      h('div',{className:'grid grid-2'},
        h('div',null,
          h('div',{className:'label'},'Description'),
          h('input',{className:'input',value:description,onChange:e=>setDescription(e.target.value),placeholder:'Dinner'})
        ),
        h('div',null,
          h('div',{className:'label'},'Amount'),
          h('input',{className:'input',type:'number',step:'0.01',value:amount,onChange:e=>setAmount(e.target.value),placeholder:'100'})
        ),
        h('div',null,
          h('div',{className:'label'},'Payer'),
          h('select',{value:payer,onChange:e=>setPayer(e.target.value)}, (group?group.members:[]).map(m=> h('option',{key:m,value:m},m)))
        ),
        h('div',null,
          h('div',{className:'label'},'Split Type'),
          h('select',{value:splitType,onChange:e=>setSplitType(e.target.value)},
            h('option',{value:'equal'},'Split Equally'),
            h('option',{value:'exact'},'Split by Exact Amounts'),
            h('option',{value:'percent'},'Split by Percentage'),
            h('option',{value:'shares'},'Split by Shares')
          )
        )
      ),
      splitType!=='equal' && h('div',null,
        h('div',{className:'label'}, `Assign ${splitType==='exact'?'Amounts': splitType==='percent'?'Percentages':'Shares'}`),
        h('div',{className:'grid grid-2'},
          (splits||[]).map((s,i)=> h('div',{key:s.member,className:'row'},
            h('span',{style:{width:'110px',fontSize:'14px'}}, s.member),
            h('input',{className:'input',type:'number',step:'0.01',value:s.value,onChange:e=>{const v=e.target.value; const c=[...splits]; c[i]={...c[i], value:v}; setSplits(c);},placeholder: splitType==='percent'? 'e.g. 25':'e.g. 10'}),
            h('span',{className:'small'}, splitType==='percent'? '%': splitType==='exact'? '$':'sh')
          ))
        ),
        splitType==='exact' && h('div',{className:'small'}, `Sum: ${currency(sumComputed)} / ${currency(total)} ${exactValid? '': ' (must match total)'}`),
        splitType==='percent' && h('div',{className:'small'}, `Sum: ${(splits||[]).reduce((a,b)=>a+(parseFloat(b.value||'0')||0),0)}% ${percentValid? '': ' (must be 100%)'}`)
      ),
      h('div',{className:'card',style:{padding:'12px'}},
        h('div',{className:'label'},'Preview'),
        h('ul',{className:'list'}, (computed||[]).map(s=> h('li',{key:s.member,style:{display:'flex',justifyContent:'space-between'}}, h('span',null,s.member), h('span',null,currency(s.amount)))))
      )
    );
  }

  function GroupCard({ group, onOpen }){
    const total = group.expenses.reduce((a,b)=>a+b.amount,0);
    return h('button',{className:'card card-pad', onClick:onOpen, style:{textAlign:'left'}},
      h('div',{className:'row',style:{justifyContent:'space-between'}},
        h('div',null,
          h('div',{style:{fontWeight:700}}, group.name),
          h('div',{className:'small'}, `${group.members.length} members • ${group.expenses.length} expenses`)
        ),
        h('div',{style:{textAlign:'right'}},
          h('div',{className:'small'},'Total'),
          h('div',{style:{fontWeight:700}}, currency(total))
        )
      )
    );
  }

  function DuesSummary({ members, expenses, onSettle }){
    const deps = useMemo(()=> simplifyDebts(members, expenses), [members.join('|'), expenses.map(e=>e.id+e.amount).join('|')]);
    if(deps.length===0) return h('div',{className:'small'}, 'All settled up 🎉');
    return h('ul',{className:'list'}, deps.map((d,i)=> h('li',{key:i},
      h('div',{className:'dues'},
        h('div',null, h('b',null,d.from), ' owes ', h('b',null,d.to)),
        h('div',{className:'row'},
          h('span',{className:'amt'}, currency(d.amount)),
          h('button',{className:'btn btn-success', onClick:()=>onSettle(d)}, 'Settle Up')
        )
      )
    )));
  }

  function PieChart({ labels, values, colors }){
    // Donut chart via stroked circles with dasharray, plus legend and center label
    const total = values.reduce((a,b)=>a+b,0) || 1;
    const size = 260, r = 90, cx = size/2, cy = size/2, stroke = 32;
    const C = 2*Math.PI*r;
    let offset = 0;
    const segments = values.map((v,i)=>{
      const frac = v/total; const len = frac*C; return { len, frac, color: colors[i%colors.length]||'#888', label: labels[i] };
    });
    const maxIdx = values.reduce((m,_,i)=> values[i] > values[m] ? i : m, 0);
    const centerTop = labels[maxIdx] || '';
    const centerVal = values[maxIdx] || 0;
    const legendChips = labels.map((lb,i)=> h('span',{key:i,className:'chip'},
      h('span',{className:'dot', style:{background: colors[i%colors.length]||'#888'}}), lb || '—'
    ));

    return h('div',{className:'pie'},
      h('svg',{viewBox:`0 0 ${size} ${size}`, width:'100%', height:size, style:{overflow:'visible'}},
        h('circle',{cx, cy, r, fill:'none', stroke:'#e5e7eb', strokeWidth:stroke}),
        segments.map((s,i)=>{ const el = h('circle',{
          key:i, cx, cy, r, fill:'none', stroke:s.color, strokeWidth:stroke, strokeLinecap:'butt',
          strokeDasharray:`${s.len} ${C}`, strokeDashoffset: -(offset), transform:`rotate(-90 ${cx} ${cy})`,
          style:{ transition:'stroke-dashoffset .8s ease, stroke-dasharray .8s ease' }
        }); offset += s.len; return el; }),
        h('circle',{cx, cy, r:r-stroke/2-2, fill:'#fff'}),
        h('text',{x:cx, y:cy-4, textAnchor:'middle', style:{fontWeight:700, fontSize:'14px', fill:'#0f172a'}}, centerTop||'—'),
        h('text',{x:cx, y:cy+16, textAnchor:'middle', className:'small'}, currency(centerVal))
      ),
      h('div',{className:'legend'}, legendChips)
    );
  }

  function GroupDashboard({ group, onBack, onUpdateGroup }){
    const [showExpense, setShowExpense] = useState(false);
    const totalSpent = group.expenses.reduce((a,b)=>a+b.amount,0);
    const byPayer = Object.fromEntries(group.members.map(m=>[m,0]));
    for(const ex of group.expenses) byPayer[ex.payer]+=ex.amount;

    function handleAdd(exp){ onUpdateGroup({...group, expenses:[exp, ...group.expenses]}); burstConfetti(40); }
    function handleSettle({from,to,amount}){
      const payment = { id:uid(), description:`Settlement: ${from} -> ${to}`, amount, payer:from, splitType:'exact', splits:[{member:to, amount}], createdAt:Date.now() };
      onUpdateGroup({...group, expenses:[payment, ...group.expenses]});
      burstConfetti(50);
    }

    const labels = group.members; const values = labels.map(l=>byPayer[l]);
    const colors = ['#2563eb','#16a34a','#f59e0b','#ef4444','#7c3aed','#0891b2','#dc2626','#0ea5e9'];

    return h('div',{style:{height:'100%',display:'flex',flexDirection:'column'}},
      h('div',{className:'card card-pad', style:{borderRadius:0,border:'none',borderBottom:'1px solid var(--border)'}},
        h('div',{className:'row',style:{justifyContent:'space-between'}},
          h('div',{className:'row',style:{gap:'12px'}},
            h('button',{className:'btn', onClick:onBack}, '← Back'),
            h('div',null,
              h('div',{style:{fontWeight:700,fontSize:'18px'}}, group.name),
              h('div',{className:'small'}, group.members.join(', '))
            )
          ),
          h('div',{className:'kpi'},
            h('div',{className:'title'}, 'Total Spent'),
            h('div',{className:'value'}, currency(totalSpent))
          )
        )
      ),
      h('div',{className:'container',style:{width:'100%'}},
        h('div',{className:'grid grid-3'},
          h('div',{className:'grid', style:{gridColumn:'span 2'}},
            h('div',{className:'card card-pad'},
              h('div',{className:'card-head'},
                h('div',{style:{fontWeight:700}}, 'Expenses'),
                h('button',{className:'btn btn-primary', onClick:()=>setShowExpense(true)}, '+ Add Expense')
              ),
              h('div',{className:'table-wrap'},
                group.expenses.length===0? h('div',{className:'small', style:{padding:'12px'}}, 'No expenses yet'):
                h('table',{className:'table'},
                  h('thead',null,
                    h('tr',null,
                      h('th',null,'Description'),
                      h('th',null,'Payer'),
                      h('th',null,'Amount')
                    )
                  ),
                  h('tbody',null,
                    group.expenses.map(ex=> h('tr',{key:ex.id},
                      h('td',null,
                        h('div',{style:{fontWeight:600}}, ex.description),
                        h('div',{className:'cell-muted'}, new Date(ex.createdAt).toLocaleString())
                      ),
                      h('td',null, ex.payer),
                      h('td',null, h('b',null, currency(ex.amount)))
                    ))
                  )
                )
              )
            ),
            h('div',{className:'card card-pad'},
              h('div',{style:{fontWeight:700, marginBottom:'8px'}}, 'Summary of Dues'),
              h(DuesSummary,{members:group.members, expenses:group.expenses, onSettle:handleSettle})
            )
          ),
          h('div',{className:'grid', style:{gap:'16px'}},
            h('div',{className:'card card-pad'}, h(PieChart,{labels, values, colors})),
            h('div',{className:'card card-pad'},
              h('div',{style:{fontWeight:700, marginBottom:'8px'}}, 'Export / Reset'),
              h('div',{className:'row'},
                h('button',{className:'btn', onClick:()=>{
                  const data={group}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
                  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${group.name.replace(/\s+/g,'_')}.json`; a.click(); URL.revokeObjectURL(url);
                }}, 'Export JSON'),
                h('button',{className:'btn btn-danger', onClick:()=>{ if(!confirm('Reset all expenses in this group?')) return; onUpdateGroup({...group, expenses: []}); }}, 'Reset Group')
              )
            )
          )
        )
      ),
      h(ExpenseModal,{open:showExpense, onClose:()=>setShowExpense(false), group, onAdd:handleAdd})
    );
  }

  // Landing Page
  function Landing({ onEnter, onNewGroup }){
    return h('section',{className:'landing'},
      h('div',{className:'bg-blobs'}, h('div',{className:'blob b1'}), h('div',{className:'blob b2'}), h('div',{className:'blob b3'})),
      h('div',{className:'hero'},
        h('h1',null,'Split expenses beautifully.'),
        h('p',null,'Create groups, add expenses with flexible splits, and let ExpenseShare simplify who owes whom. All in your browser, with data saved locally.'),
        h('div',{className:'cta'},
          h('button',{className:'btn btn-primary', onClick:onEnter}, 'Enter Dashboard'),
          h('button',{className:'btn', onClick:onNewGroup}, 'Create First Group')
        ),
        h('div',{className:'features'},
          h('div',{className:'feature'}, h('b',null,'Smart Splits'), h('div',{className:'small'},'Equal, exact, percentage, or shares.')),
          h('div',{className:'feature'}, h('b',null,'Min Cash Flow'), h('div',{className:'small'},'See the fewest transactions to settle up.')),
          h('div',{className:'feature'}, h('b',null,'Local & Private'), h('div',{className:'small'},'No accounts. Your data stays in your browser.'))
        )
      )
    );
  }

  function App(){
    const [state, setState] = useState(loadState());
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [zoom, setZoom] = useState(1.04);
    const [funEnabled, setFunEnabled] = useState(true);
    const [theme, setTheme] = useState(()=> localStorage.getItem(LS_THEME) || 'light');
    const [showLanding, setShowLanding] = useState(()=> localStorage.getItem(LS_SEEN)? false : true);
    useEffect(()=>{ saveState(state); }, [state]);
    useEffect(()=>{ document.documentElement.setAttribute('data-theme', theme); localStorage.setItem(LS_THEME, theme); }, [theme]);

    const groups = state.groups;
    const activeGroup = groups.find(g=>g.id===activeGroupId)||null;

    const overall = useMemo(()=>{ let pos=0, spent=0, expenses=0; for(const g of groups){ const dues=simplifyDebts(g.members,g.expenses); for(const d of dues) pos+=d.amount; for(const e of g.expenses){ spent+=e.amount; expenses++; } } return {unsettled:pos, spent, expenses}; }, [groups.map(g=>g.id+g.expenses.length+g.members.length).join('|')]);
    const coinPositions = useMemo(()=>{
      // A few floating coins for fun on the main page
      const n = 6; const arr=[]; for(let i=0;i<n;i++){ arr.push({ left: Math.round(8+Math.random()*80)+'%', top: Math.round(18+Math.random()*55)+'%', delay: (Math.random()*1.2).toFixed(2)+'s' }); } return arr;
    }, [groups.length]);

    const recent = useMemo(()=>{
      const items=[]; for(const g of groups){ for(const e of g.expenses){ items.push({ ...e, groupName:g.name }); } } items.sort((a,b)=> b.createdAt - a.createdAt); return items.slice(0,6);
    }, [groups.map(g=>g.id+g.expenses.length).join('|')]);
    const leaderboard = useMemo(()=>{
      const map = new Map();
      for(const g of groups){ for(const e of g.expenses){ map.set(e.payer, (map.get(e.payer)||0)+e.amount); } }
      const arr = Array.from(map.entries()).map(([name, total])=>({name,total}));
      arr.sort((a,b)=> b.total - a.total);
      return arr.slice(0,6);
    }, [groups.map(g=>g.id+g.expenses.length).join('|')]);

    const fileRef = React.useRef(null);
    function importJSON(){ fileRef.current?.click(); }
    function onImportFile(ev){ const f=ev.target.files?.[0]; if(!f) return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(data?.group){ createGroup(data.group); } else if(data?.groups){ setState({ groups: data.groups }); } else { alert('Invalid JSON format. Expect {group} or {groups}.'); } } catch(e){ alert('Failed to parse JSON'); } ev.target.value=''; }; reader.readAsText(f); }
    function addDemo(){
      const demo = {
        id: uid(), name: 'Demo Trip', members: ['Aarav','Diya','Kabir','Meera'], expenses: [
          { id: uid(), description:'Taxi from airport', amount: 450, payer:'Aarav', splitType:'equal', splits:[{member:'Aarav',amount:112.5},{member:'Diya',amount:112.5},{member:'Kabir',amount:112.5},{member:'Meera',amount:112.5}], createdAt: Date.now()-86400000*2 },
          { id: uid(), description:'Dinner Day 1', amount: 980, payer:'Diya', splitType:'equal', splits:[{member:'Aarav',amount:245},{member:'Diya',amount:245},{member:'Kabir',amount:245},{member:'Meera',amount:245}], createdAt: Date.now()-86400000*2+3600000 },
          { id: uid(), description:'Museum tickets', amount: 600, payer:'Kabir', splitType:'equal', splits:[{member:'Aarav',amount:150},{member:'Diya',amount:150},{member:'Kabir',amount:150},{member:'Meera',amount:150}], createdAt: Date.now()-86400000 },
          { id: uid(), description:'Cafe brunch', amount: 420, payer:'Meera', splitType:'shares', splits:[{member:'Aarav',amount:120},{member:'Diya',amount:150},{member:'Kabir',amount:60},{member:'Meera',amount:90}], createdAt: Date.now()-43200000 },
        ]
      };
      createGroup(demo);
    }

    function createGroup(g){ setState(s=>({...s, groups:[g, ...s.groups]})); burstConfetti(70); }
    function updateGroup(g){ setState(s=>({...s, groups:s.groups.map(x=>x.id===g.id? g : x)})); }

    return h('div',{style:{minHeight:'100%'}},
      h('header',{className:'header'},
        h('div',{className:'header-inner'},
          h('div',{className:'brand'}, h('div',{className:'logo'},'ES'), h('div',{style:{fontWeight:700,fontSize:'18px'}}, 'ExpenseShare ✨')),
          h('div',{className:'row'},
            h('nav',{className:'nav'},
              h('button',{className:`nav-btn ${showLanding? 'active':''}`, onClick:()=> setShowLanding(true)}, 'Home'),
              h('button',{className:`nav-btn ${!showLanding? 'active':''}`, onClick:()=> setShowLanding(false)}, 'Dashboard'),
              h('button',{className:'nav-btn', onClick:()=> alert('Settings coming soon')}, 'Settings')
            ),
            h('div',{className:'subtitle', style:{marginLeft:'12px'}}, 'Unsettled: ', h('b',{className:'mono'}, currency(overall.unsettled))),
            h('button',{className:'btn', onClick:()=> setTheme(t=> t==='light'? 'dark':'light')}, theme==='light'? '🌙 Dark' : '☀️ Light')
          )
        )
      ),
      showLanding? h('main',{className:'container main-zoom route', style:{paddingTop:'24px','--zoom': zoom}},
        h(Landing,{ onEnter:()=>{ setShowLanding(false); localStorage.setItem(LS_SEEN,'1'); }, onNewGroup:()=>{ setShowLanding(false); localStorage.setItem(LS_SEEN,'1'); setShowCreate(true); } })
      ) :
      !activeGroup? h('main',{className:'container main-zoom route', style:{paddingTop:'24px','--zoom': zoom, position:'relative'}},
        // Background blobs and floating coins (toggle)
        funEnabled && h('div',{className:'bg-blobs'},
          h('div',{className:'blob b1'}),
          h('div',{className:'blob b2'}),
          h('div',{className:'blob b3'}),
          coinPositions.map((p,i)=> h('div',{key:i,className:'coin', style:{left:p.left, top:p.top, animationDelay:p.delay}}, '₹'))
        ),
        h('div',{className:'row',style:{justifyContent:'space-between', marginBottom:'12px'}},
          h('div',null, h('div',{style:{fontWeight:700,fontSize:'22px'}}, 'Your Groups'), h('div',{className:'subtitle'}, 'Create groups and start adding expenses')),
          h('div',{className:'row'},
            h('div',{className:'row',style:{marginRight:'8px'}},
              h('span',{className:'small'}, 'Zoom'),
              h('button',{className:'btn', onClick:()=> setZoom(z=> Math.max(0.9, +(z-0.06).toFixed(2)))}, '−'),
              h('button',{className:'btn', onClick:()=> setZoom(z=> Math.min(1.2, +(z+0.06).toFixed(2)))}, '+')
            ),
            h('label',{className:'toggle small', style:{marginRight:'8px'}},
              h('input',{type:'checkbox', checked:funEnabled, onChange:e=>setFunEnabled(e.target.checked)}),
              ' Fun effects'
            ),
            h('button',{className:'btn', onClick:()=>{ if(!confirm('This will clear ALL data. Continue?')) return; setState(defaultState); }}, 'Reset All Data'),
            h('button',{className:'btn btn-primary', onClick:()=>setShowCreate(true)}, '+ New Group')
          )
        ),
        // Stats row
        h('div',{className:'stats'},
          h('div',{className:'stat'}, h('div',{className:'t'}, 'Groups'), h('div',{className:'v'}, groups.length)),
          h('div',{className:'stat'}, h('div',{className:'t'}, 'Total Expenses'), h('div',{className:'v'}, overall.expenses)),
          h('div',{className:'stat'}, h('div',{className:'t'}, 'Total Spent'), h('div',{className:'v'}, currency(overall.spent)))
        ),
        h('div',{className:'grid grid-3'},
          groups.length===0? h('div',{className:'subtitle'}, 'No groups yet. Create your first group.'):
          groups.map(g=> h(GroupCard,{key:g.id, group:g, onOpen:()=>setActiveGroupId(g.id)}))
        )
        ,
        // Fill space: recent activity, leaderboard, quick actions
        h('div',{className:'home-sections'},
          h('div',{className:'section'},
            h('h3',null,'Recent Activity'),
            h('ul',{className:'activity'},
              recent.length===0? h('li',null, h('span',{className:'small'},'No recent activity')):
              recent.map(it=> h('li',{key:it.id},
                h('div',null, h('div',{style:{fontWeight:600}}, it.description), h('div',{className:'small'}, it.groupName,' • ', new Date(it.createdAt).toLocaleString())),
                h('div',null, h('span',{className:'pill'}, it.payer), ' ', h('b',null, currency(it.amount)))
              ))
            )
          ),
          h('div',{className:'section'},
            h('h3',null,'Leaderboard'),
            h('ul',{className:'leader'},
              leaderboard.length===0? h('li',null, h('span',{className:'small'},'No data yet')):
              leaderboard.map((p,i)=> h('li',{key:p.name},
                h('div',{className:'who'}, h('div',{className:'avatar'}, (p.name||'?')[0]), h('div',null, h('div',{style:{fontWeight:600}}, p.name), h('div',{className:'small'}, `Rank #${i+1}`))),
                h('div',null, h('b',null, currency(p.total)))
              ))
            ),
            h('div',{style:{marginTop:'10px'}},
              h('div',{className:'qactions'},
                h('button',{className:'btn', onClick:addDemo}, 'Add Demo Data'),
                h('button',{className:'btn', onClick:importJSON}, 'Import JSON'),
                h('input',{type:'file', accept:'application/json', ref:fileRef, onChange:onImportFile, style:{display:'none'}})
              )
            )
          )
        )
        ,
        // Floating action button for new group
        h('button',{className:'fab', onClick:()=> setShowCreate(true)}, '+ New Group')
        ,
        // Fun footer wave
        h('div',{className:'footer-wave'},
          h('svg',{viewBox:'0 0 1440 120', preserveAspectRatio:'none'},
            h('path',{fill:'#e8f0fe', d:'M0,64L48,53.3C96,43,192,21,288,37.3C384,53,480,107,576,122.7C672,139,768,117,864,96C960,75,1056,53,1152,69.3C1248,85,1344,139,1392,165.3L1440,192L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z'})
          )
        )
      ):
      h('main',{style:{height:'calc(100vh - 57px)'}}, h(GroupDashboard,{group:activeGroup,onBack:()=>setActiveGroupId(null),onUpdateGroup:updateGroup})),
      h(CreateGroupModal,{open:showCreate,onClose:()=>setShowCreate(false),onCreate:createGroup})
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(App));
})();
