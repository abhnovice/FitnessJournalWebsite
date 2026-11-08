// One calendar drives the journal and its verification.
export const PLAN_REVISION='2026-11-09-restart-v1';
export const date=offset=>new Date(Date.UTC(2026,10,9+offset));
export function createTrainingPlan(){
  const phases=[];
  function addPhase(id,name,start,weeks,note,taskFn,days=weeks*7){
    const phase={id,name,start,weeks,note,days,items:[]};
    for(let i=0;i<days;i++)taskFn(i,Math.floor(i/7),(date(start+i).getUTCDay()+6)%7).forEach((label,n)=>phase.items.push({id:id+'-'+i+'-'+n,day:i,label}));
    phases.push(phase);
  }
  addPhase('launchpad','Launchpad',0,1,'Week 1 · 9–15 November · slow jogs and weekend walks',(i,w,d)=>[d<5?'Slow jog '+[1,2,2,3,3][d]+' km':'Walk 5 km']);
  addPhase('cardio','Cardio staircase',7,1,'Week 2 · 16–22 November · slow jogs and weekend walks',(i,w,d)=>[d<5?'Slow jog '+[3,3,4,4,4][d]+' km':'Walk 5 km']);
  const circuitCounts=[1,2,2,3,3,3,4,4,4,4,5,5,5,5,5];
  addPhase('circuit','Jog + circuit',14,3,'Weeks 3–5 · 5 km weekday jogs · 1 circuit = 5 pull-ups, 10 push-ups and 15 squats',(i,w,d)=>{
    if(d>4)return w===2?['Walk 5 km','Study Gladiator Body Workout']:['Walk 5 km'];
    const count=circuitCounts[w*5+d];
    return ['Jog 5 km','Circuit: '+count+' circuit'+(count===1?'':'s')+' · each: 5 pull-ups / 10 push-ups / 15 squats'];
  });
  const programNames=['General Fitness','Fat Loss','Strength & Size','Rounds of Fury','Juggernaut','U.N.I.T.'];
  function workoutLabel(p,w,d){
    const slot=d/2;
    if(p===0)return w===3?'Workout B · GPP #'+(slot+1):['Workout A · aerobic','Workout B · GPP #'+(w+1),'Workout C · aerobic intervals'][slot];
    if(p===1)return 'Workout '+(w<2?'A':'B')+(slot+1)+' · '+(w%2?'no-rest scheme':'rest scheme')+' + prescribed cardio';
    if(p===2)return ['Workout A + core + cardio','Workout B · GPP / week-specific scheme','Workout C + core + cardio'][slot];
    if(p===3)return '2-minute rounds · Workout '+((w+slot)%2?'B':'A');
    if(p===4)return ['Workout A · endurance + aerobic','Workout B · explosive + aerobic intervals','Workout C · maximum + intervals'][slot];
    return 'Workout '+((w+slot)%2?'B':'A')+' + week-specific cardio';
  }
  programNames.forEach((name,p)=>addPhase('gladiator-'+p,'Block '+(p+1)+' · '+name,35+p*28,4,'Four weeks · follow the program’s exercise blocks and cardio',(i,w,d)=>[d>4?'Walk 5 km':d%2?'Active recovery'+(p===3?' / easy cardio':''):workoutLabel(p,w,d)]));
  for(let b=0;b<8;b++)addPhase('byow-'+b,'BYOW · Block '+(b+1),203+b*28,b===7?3:4,'Power circuit + core superset + finishing interval',(i,w,d)=>[d>4?'Walk 5 km':d%2?'Easy cardio / recovery':'Workout '+((w+d/2)%2?'B':'A')+' · '+['strength','muscle','endurance'][d/2]+' scheme'],b===7?12:28);
  return phases;
}

// Shared presentation rules; progress and the calendar are not modified.
export function phaseAvailable(phases,checked,index){
  return phases.slice(0,index).every(p=>p.items.every(item=>checked[item.id]===true));
}
export function weekAvailable(phases,checked,index,week){
  return phaseAvailable(phases,checked,index)&&phases[index].items.filter(item=>item.day<week*7).every(item=>checked[item.id]===true);
}
export function currentPlanFocus(phases,checked,today){
  const calendar=phases.findIndex(p=>today>=date(p.start).getTime()&&today<date(p.start+p.days).getTime());
  if(calendar>=0){const week=Math.floor((today-date(phases[calendar].start).getTime())/(7*86400000));if(weekAvailable(phases,checked,calendar,week))return {phase:phases[calendar].id,week};}
  const index=phases.findIndex(p=>p.items.some(item=>!checked[item.id]));
  if(index<0)return {phase:phases.at(-1).id,week:Math.floor((phases.at(-1).days-1)/7)};
  return {phase:phases[index].id,week:Math.floor(phases[index].items.find(item=>!checked[item.id]).day/7)};
}
