/* Dependency-free, orthographic voxel office. Render on interaction or resize only. */
(() => {
  const ROOMS = [
    {id:'account',name:'Account',x:-7,z:-3.7,color:'#6587df'},
    {id:'strategy',name:'Strategy',x:0,z:-3.7,color:'#48a69c'},
    {id:'content',name:'Content',x:7,z:-3.7,color:'#9265ed'},
    {id:'creative',name:'Creative',x:-7,z:3.2,color:'#e9b953'},
    {id:'performance',name:'Performance',x:0,z:3.2,color:'#5e9edc'},
    {id:'qa',name:'QA',x:7,z:3.2,color:'#e68da9'}
  ];
  const tint=(hex,n)=>'#'+hex.slice(1).match(/../g).map(x=>Math.max(0,Math.min(255,Math.round(parseInt(x,16)*n))).toString(16).padStart(2,'0')).join('');
  class VoxelOffice {
    constructor(host,{onSelect,selected=null,counts={}}={}) {
      this.host=host;this.onSelect=onSelect;this.selected=selected;this.counts=counts;this.hover=null;this.boxes=[];
      this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');
      this.canvas.className='voxel-canvas';host.append(this.canvas);this.ctx=this.canvas.getContext('2d');
      this.labels=document.createElement('div');this.labels.className='voxel-labels';host.append(this.labels);
      this.buttons=ROOMS.map(room=>{
        const button=document.createElement('button');button.type='button';button.className='room-label';
        button.dataset.voxelRoom=room.id;button.style.setProperty('--room-color',room.color);
        button.setAttribute('aria-controls','roomDrawer');button.setAttribute('aria-expanded',String(selected===room.id));
        button.innerHTML='<span>'+room.name+'</span><small>'+((counts[room.id]||0)?counts[room.id]+' order đang mở':'Giao việc ↗')+'</small>';
        button.onclick=()=>onSelect?.(room.id);this.labels.append(button);return button;
      });
      if(!this.ctx){host.classList.add('voxel-unavailable');return;}
      this.build();
      this.pointer=e=>{const r=this.canvas.getBoundingClientRect();const hit=this.hit(e.clientX-r.left,e.clientY-r.top);if(hit!==this.hover){this.hover=hit;this.draw();this.canvas.style.cursor=hit?'pointer':'default';}};
      this.leave=()=>{if(this.hover){this.hover=null;this.draw();}};
      this.click=e=>{const r=this.canvas.getBoundingClientRect();const hit=this.hit(e.clientX-r.left,e.clientY-r.top);if(hit)onSelect?.(hit);};
      this.canvas.addEventListener('pointermove',this.pointer);this.canvas.addEventListener('pointerleave',this.leave);this.canvas.addEventListener('click',this.click);
      this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    }
    box(x,y,z,w,h,d,color,layer=1,room=null){this.boxes.push({x,y,z,w,h,d,color,layer,room});}
    plant(x,z,size=1){
      this.box(x,.22,z,.48,.44,.48,'#bda6dd');this.box(x,.75,z,.12,.8,.12,'#92765b');
      [[0,1.45,0,.56],[.3,1.15,.13,.45],[-.26,1.1,-.15,.5],[.08,1.8,.04,.4]].forEach(([dx,y,dz,s],i)=>this.box(x+dx*size,y*size,z+dz*size,s*size,s*size,s*size,['#91bb66','#709c57','#a7ca7b','#87ae57'][i]));
    }
    person(x,z,shirt,standing=false){
      const y=standing?.35:.44;
      this.box(x-.14,y,z,.19,.6,.26,'#4c4a69');this.box(x+.14,y,z,.19,.6,.26,'#4c4a69');
      this.box(x,y+.55,z,.64,.62,.4,shirt);this.box(x-.4,y+.5,z-.08,.16,.45,.2,shirt);this.box(x+.4,y+.5,z-.08,.16,.45,.2,shirt);
      this.box(x,y+1.12,z,.49,.48,.44,'#d8ab87');this.box(x,y+1.35,z+.02,.54,.19,.5,'#494050');
      this.box(x,y+1.15,z+.22,.54,.4,.12,'#494050');this.box(x-.18,y+1.22,z-.21,.16,.18,.13,'#494050');
      if(!standing){this.box(x,.55,z+.28,.78,.85,.18,shirt);this.box(x,.25,z,.85,.12,.65,'#534873');}
    }
    desk(x,z,accent){
      this.box(x,1.05,z,2.2,.18,1.25,'#e6c895');
      [-.86,.86].forEach(dx=>[-.43,.43].forEach(dz=>this.box(x+dx,.5,z+dz,.12,1,.12,'#c1accf')));
      this.box(x,1.6,z-.25,.98,.7,.13,'#5d597d');this.box(x,1.6,z-.17,.84,.55,.02,'#d8e1fc');
      this.box(x,1.25,z-.25,.1,.25,.1,'#66617b');this.box(x,1.12,z+.28,.7,.03,.3,'#c8c4e2');
      this.box(x+.72,1.3,z+.1,.19,.35,.19,accent);
      this.box(x-.16,1.63,z-.15,.38,.08,.02,accent);this.box(x-.1,1.48,z-.15,.52,.035,.02,'#989ec3');
    }
    build(){
      const b=(...args)=>this.box(...args);
      b(0,-.35,.4,22,.7,18.8,'#beb3d9',0);b(0,.01,.4,21.7,.03,18.5,'#e6e1f1',0);
      for(let x=-10;x<=10;x++)for(let z=-8;z<=9;z++)b(x,.03,z,.96,.025,.96,(x+z)%2?'#ede8f6':'#e8e2f2',0);
      b(0,-.14,10.1,5,.3,1,'#d7cfe6',0);b(0,-.3,10.7,5.7,.3,.5,'#c5bad9',0);
      ROOMS.forEach(room=>{
        const {x,z,color,id}=room;
        b(x,.08,z,6.35,.08,5.7,'#f4ecdc',.2,id);
        for(let n=-3;n<=3;n++)b(x+n*.88,.13,z,.85,.015,5.55,n%2?'#eadbc3':'#eee0c9',.2);
        b(x,1.25,z-2.8,6.4,2.5,.2,'#cbbde4');b(x-3.15,.62,z,.18,1.25,5.6,'#d6cbea');b(x+3.15,.62,z,.18,1.25,5.6,'#c3b2dd');
        for(let n=-3;n<=3;n++)b(x+n,.24,z-2.96,.93,.45,.15,'#b8a3d2');
        b(x,1.65,z-2.65,3.15,1.05,.12,'#f8f4ef');
        for(let c=0;c<4;c++)for(let r=0;r<2;r++)b(x-1.15+c*.72,1.4+r*.45,z-2.57,.4,.24,.03,[color,'#edcb87','#d4c2ed'][((c+r)%3)]);
        b(x,2.55,z-2.76,2.8,.22,.24,color);
        if(id==='strategy'||id==='account'){
          b(x,.98,z,3.5,.2,1.5,'#e3c18d');[-1.4,1.4].forEach(dx=>b(x+dx,.5,z,.18,1,1.1,'#b29acb'));
          [-.95,.95].forEach((dx,i)=>{this.person(x+dx,z+.9,i?color:'#a89ac5');b(x+dx,1.26,z,.65,.3,.08,'#74749a');});
          b(x,1.13,z-.3,.6,.04,.45,'#fff9e8');
        }else{this.desk(x-1.45,z-.2,color);this.desk(x+1.3,z-.2,color);this.person(x-1.45,z+.78,color);this.person(x+1.3,z+.78,'#b59cdd');}
        this.plant(x+2.65,z-2.12,.85);
        b(x-2.65,1.1,z-2.2,.65,2.2,.65,'#d6bb91');
        for(let r=0;r<3;r++){b(x-2.65,.35+r*.62,z-1.84,.58,.06,.08,'#f5debb');for(let c=0;c<3;c++)b(x-2.85+c*.19,.55+r*.62,z-1.98,.12,.35,.26,[color,'#efdbb7','#a99bc8'][c]);}
        b(x, .38,z+2.7,5,.75,.08,'#d7d5ed');b(x,.82,z+2.7,5,.07,.14,'#af9acb');
      });
      [-10,10].forEach(x=>[0,7.8].forEach(z=>this.plant(x,z,1)));
      b(-6,.45,7.7,2.9,.85,1,'#bca0e0');b(-6,.95,8.1,2.9,.7,.22,'#a48acd');b(-6,.63,7.6,2.6,.2,.85,'#d7c6f0');
      b(-3.9,.4,7.5,.9,.8,.9,'#e7cfa9');b(-3.9,.85,7.5,.6,.1,.6,'#faf3e3');
      b(6,.72,7.8,3.3,1.45,1,'#d0b9e6');b(6,1.5,7.8,3.5,.15,1.2,'#ede5f4');b(6,1.8,7.6,.7,.5,.1,'#8072aa');
      this.plant(8.7,7.6,.9);this.person(2.7,7.7,'#9f81db',true);
      this.boxes.sort((a,b)=>a.layer-b.layer||this.depth(a)-this.depth(b));
    }
    depth(o){return o.x*.36+o.z*.93+o.y*.3;}
    project(x,y,z){return {x:this.ox+(x*.933-z*.36)*this.scale,y:this.oy+(x*.36+z*.933)*.49*this.scale-y*.872*this.scale};}
    polygon(points,fill,stroke){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
    resize(){const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;this.width=width;this.height=height;const ratio=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';this.ctx.setTransform(ratio,0,0,ratio,0,0);this.scale=Math.min(width/29,height/15.3);this.ox=width/2+.4*this.scale;this.oy=height/2+.4*this.scale;this.draw();}
    draw(){
      if(!this.width)return;const c=this.ctx;c.clearRect(0,0,this.width,this.height);
      const ground=[[-11,-9],[11,-9],[11,10],[-11,10]].map(([x,z])=>this.project(x,-.7,z));c.save();c.shadowColor='#55408040';c.shadowBlur=24;this.polygon(ground,'#e4dcf2');c.restore();
      this.boxes.forEach(o=>{
        const x=o.x-o.w/2,X=o.x+o.w/2,z=o.z-o.d/2,Z=o.z+o.d/2,y=o.y-o.h/2,Y=o.y+o.h/2;
        let color=o.color;if(o.room&&(o.room===this.selected||o.room===this.hover))color='#c4a4f4';
        this.polygon([[X,y,z],[X,y,Z],[X,Y,Z],[X,Y,z]].map(p=>this.project(...p)),tint(color,.83));
        this.polygon([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]].map(p=>this.project(...p)),tint(color,.94));
        this.polygon([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]].map(p=>this.project(...p)),tint(color,1.04));
      });
      ROOMS.forEach((r,i)=>{const p=this.project(r.x,3.6,r.z-2.3),button=this.buttons[i];button.style.left=p.x+'px';button.style.top=p.y+'px';button.classList.toggle('selected',this.selected===r.id);});
    }
    hit(x,y){
      for(const room of [...ROOMS].reverse()){
        const poly=[[-3.15,-2.9],[3.15,-2.9],[3.15,2.9],[-3.15,2.9]].map(([dx,dz])=>this.project(room.x+dx,.2,room.z+dz));
        let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>y)!==(b.y>y))&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}if(inside)return room.id;
      }return null;
    }
    select(id){this.selected=id;this.buttons.forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.voxelRoom===id)));this.draw();}
    destroy(){this.observer?.disconnect();this.canvas.removeEventListener('pointermove',this.pointer);this.canvas.removeEventListener('pointerleave',this.leave);this.canvas.removeEventListener('click',this.click);this.canvas.remove();this.labels.remove();}
  }
  window.VoxelOffice=VoxelOffice;
})();
