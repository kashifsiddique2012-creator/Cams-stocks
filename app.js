// Frontend simulation & chart (same core as prototype), with hooks to admin visibility via adminAuth API.
(function(){
  // --- State ---
  const state = {
    data: [], basePrice: 100, volatility: 30, speed: 1.0, running: false, trend: 'flat',
    cash: 100000, shares: 0, showGrid: true, chartType: 'line'
  };

  // --- Elements ---
  const volatilityRange = document.getElementById('volatility-range');
  const volatilityValue = document.getElementById('volatility-value');
  const speedRange = document.getElementById('speed-range');
  const speedValue = document.getElementById('speed-value');
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stepBtn = document.getElementById('step-btn');
  const resetBtn = document.getElementById('reset-btn');
  const trendSelect = document.getElementById('trend-select');
  const chartWrap = document.getElementById('chart-wrap');
  const liveAnnouncer = document.getElementById('live-announcer');
  const portfolioSummary = document.getElementById('portfolio-summary');
  const buyBtn = document.getElementById('buy-btn');
  const sellBtn = document.getElementById('sell-btn');
  const sharesInput = document.getElementById('shares-input');
  const themeToggle = document.getElementById('theme-toggle');
  const gridToggle = document.getElementById('grid-toggle');
  const chartType = document.getElementById('chart-type');

  // --- Utilities ---
  function randNormal(){ let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random(); return Math.sqrt(-2.0*Math.log(u))*Math.cos(2.0*Math.PI*v); }
  function biasByTrend(val){
    switch(state.trend){
      case 'bull': return val + Math.abs(randNormal())*0.5;
      case 'bear': return val - Math.abs(randNormal())*0.5;
      case 'volatile': return val + randNormal()*1.2;
      default: return val + randNormal()*0.5;
    }
  }

  // --- Simulation ---
  function stepSimulation(dt=1){
    const last = state.data.length ? state.data[state.data.length-1].price : state.basePrice;
    const volFactor = Math.max(0.01, state.volatility/20);
    let delta = randNormal() * volFactor * dt;
    delta = biasByTrend(delta);
    const newPrice = Math.max(0.1, +(last * (1 + delta/100)).toFixed(2));
    state.data.push({t: Date.now(), price: newPrice});
    if(state.data.length > 120) state.data.shift();
    announcePrice(newPrice);
    renderChart();
    updatePortfolioSummary();
  }

  let raf = null; let lastFrame = performance.now();
  function runLoop(now){
    const elapsed = (now - lastFrame)/1000; lastFrame = now;
    if(state.running){
      const steps = Math.max(1, Math.floor(state.speed * elapsed * 2));
      for(let i=0;i<steps;i++) stepSimulation(1);
    }
    raf = requestAnimationFrame(runLoop);
  }

  // --- Chart rendering (SVG) ---
  function renderChart(){
    chartWrap.innerHTML = '';
    const width = Math.min(1200, Math.max(600, chartWrap.clientWidth || 800));
    const height = 320;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS,'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('role','img');
    svg.setAttribute('aria-label','Stock price chart. Use keyboard to navigate data points.');
    svg.setAttribute('tabindex',0);

    if(state.data.length < 2){
      const text = document.createElementNS(svgNS,'text');
      text.setAttribute('x',width/2); text.setAttribute('y',height/2);
      text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#666');
      text.textContent = 'No data — press Play';
      svg.appendChild(text);
      chartWrap.appendChild(svg);
      return;
    }

    const prices = state.data.map(d=>d.price);
    const minP = Math.min(...prices) * 0.98;
    const maxP = Math.max(...prices) * 1.02;
    const pad = 40;
    const x = (i)=> pad + i*( (width-2*pad) / (state.data.length-1) );
    const y = (p)=> pad + (height-2*pad)*(1 - (p - minP)/(maxP - minP || 1));

    if(state.showGrid){
      const gridGroup = document.createElementNS(svgNS,'g');
      gridGroup.setAttribute('aria-hidden','true');
      for(let i=0;i<5;i++){
        const gy = pad + i*( (height-2*pad)/4 );
        const line = document.createElementNS(svgNS,'line');
        line.setAttribute('x1',pad); line.setAttribute('x2',width-pad);
        line.setAttribute('y1',gy); line.setAttribute('y2',gy);
        line.setAttribute('stroke','#eee'); line.setAttribute('stroke-width','1');
        gridGroup.appendChild(line);
      }
      svg.appendChild(gridGroup);
    }

    const path = document.createElementNS(svgNS,'path');
    const d = state.data.map((pt,i)=>`${i===0 ? 'M' : 'L'} ${x(i)} ${y(pt.price)}`).join(' ');
    path.setAttribute('d', d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke', getComputedStyle(document.body).getPropertyValue('--accent') || '#0077cc');
    path.setAttribute('stroke-width','2');
    svg.appendChild(path);

    const pointsGroup = document.createElementNS(svgNS,'g');
    pointsGroup.setAttribute('role','list');
    state.data.forEach((pt,i)=>{
      const cx = x(i), cy = y(pt.price);
      const circle = document.createElementNS(svgNS,'circle');
      circle.setAttribute('r',4);
      circle.setAttribute('cx',cx);
      circle.setAttribute('cy',cy);
      circle.setAttribute('fill','#fff');
      circle.setAttribute('stroke',getComputedStyle(document.body).getPropertyValue('--accent') || '#0077cc');
      circle.setAttribute('tabindex',0);
      circle.setAttribute('role','listitem');
      circle.setAttribute('aria-label', `Point ${i+1} price ${pt.price} dollars`);
      circle.addEventListener('keydown', (ev)=>{ if(ev.key === 'ArrowRight') focusPoint(i+1); else if(ev.key === 'ArrowLeft') focusPoint(i-1); else if(ev.key === 'Enter'){ liveAnnouncer.textContent = `Selected price ${pt.price} dollars at index ${i+1}`; }});
      circle.addEventListener('focus', ()=> liveAnnouncer.textContent = `Focused price ${pt.price} dollars at index ${i+1}`);
      let dragging = false;
      circle.addEventListener('pointerdown', (e)=>{ dragging = true; circle.setPointerCapture(e.pointerId); });
      circle.addEventListener('pointermove', (e)=>{ if(!dragging) return; const rect = svg.getBoundingClientRect(); const relY = Math.min(Math.max(e.clientY - rect.top, pad), height-pad); const ratio = 1 - (relY - pad)/(height-2*pad); const newPrice = +(minP + ratio*(maxP-minP)).toFixed(2); state.data[i].price = newPrice; liveAnnouncer.textContent = `Adjusted point ${i+1} to ${newPrice} dollars`; renderChart(); });
      circle.addEventListener('pointerup', (e)=>{ dragging = false; circle.releasePointerCapture && circle.releasePointerCapture(e.pointerId); });
      pointsGroup.appendChild(circle);
    });
    svg.appendChild(pointsGroup);

    const leftLabel = document.createElementNS(svgNS,'text');
    leftLabel.setAttribute('x',10);
    leftLabel.setAttribute('y',pad);
    leftLabel.setAttribute('fill','#666');
    leftLabel.textContent = `$${maxP.toFixed(2)}`;
    svg.appendChild(leftLabel);
    const rightLabel = document.createElementNS(svgNS,'text');
    rightLabel.setAttribute('x',10);
    rightLabel.setAttribute('y',height-pad+6);
    rightLabel.setAttribute('fill','#666');
    rightLabel.textContent = `$${minP.toFixed(2)}`;
    svg.appendChild(rightLabel);

    chartWrap.appendChild(svg);
  }

  function focusPoint(i){
    const svg = chartWrap.querySelector('svg'); if(!svg) return;
    const circles = Array.from(svg.querySelectorAll('circle'));
    if(i < 0) i = 0; if(i >= circles.length) i = circles.length - 1;
    circles[i].focus();
  }

  function announcePrice(price){ liveAnnouncer.textContent = `Price: $${price.toFixed(2)}`; }
  function updatePortfolioSummary(){ const last = state.data.length ? state.data[state.data.length-1].price : state.basePrice; const holdingsValue = +(state.shares * last).toFixed(2); portfolioSummary.innerHTML = `Cash: $${state.cash.toFixed(2)}<br/>Holdings: ${state.shares} shares ($${holdingsValue.toFixed(2)})`; }

  // --- Event wiring ---
  volatilityRange && volatilityRange.addEventListener('input', (e)=>{ state.volatility = +e.target.value; volatilityValue.textContent = state.volatility; });
  speedRange && speedRange.addEventListener('input', (e)=>{ state.speed = +e.target.value; speedValue.textContent = `${state.speed}x`; });
  trendSelect && trendSelect.addEventListener('change', (e)=>{ state.trend = e.target.value; });
  playBtn && playBtn.addEventListener('click', ()=>{ state.running = true; playBtn.setAttribute('aria-pressed','true'); liveAnnouncer.textContent = 'Simulation started'; });
  pauseBtn && pauseBtn.addEventListener('click', ()=>{ state.running = false; playBtn.setAttribute('aria-pressed','false'); liveAnnouncer.textContent = 'Simulation paused'; });
  stepBtn && stepBtn.addEventListener('click', ()=> stepSimulation(1));
  resetBtn && resetBtn.addEventListener('click', ()=>{ initData(); liveAnnouncer.textContent = 'Simulation reset'; });

  buyBtn && buyBtn.addEventListener('click', ()=>{
    const qty = Math.max(1, Math.floor(+sharesInput.value || 1));
    const price = state.data.length ? state.data[state.data.length-1].price : state.basePrice;
    const cost = qty * price;
    if(cost > state.cash){ liveAnnouncer.textContent = `Insufficient cash to buy ${qty} shares`; return; }
    state.cash -= cost; state.shares += qty;
    liveAnnouncer.textContent = `Bought ${qty} shares at $${price.toFixed(2)} each`; updatePortfolioSummary();
  });

  sellBtn && sellBtn.addEventListener('click', ()=>{
    const qty = Math.max(1, Math.floor(+sharesInput.value || 1));
    if(qty > state.shares){ liveAnnouncer.textContent = `You do not have ${qty} shares to sell`; return; }
    const price = state.data.length ? state.data[state.data.length-1].price : state.basePrice;
    const proceeds = qty * price; state.shares -= qty; state.cash += proceeds;
    liveAnnouncer.textContent = `Sold ${qty} shares at $${price.toFixed(2)} each`; updatePortfolioSummary();
  });

  themeToggle && themeToggle.addEventListener('change', (e)=>{ if(e.target.checked) document.documentElement.setAttribute('data-theme','high-contrast'); else document.documentElement.removeAttribute('data-theme'); });
  gridToggle && gridToggle.addEventListener('change', (e)=>{ state.showGrid = e.target.checked; renderChart(); });
  chartType && chartType.addEventListener('change', (e)=>{ state.chartType = e.target.value; renderChart(); });

  document.addEventListener('keydown', (e)=>{ if(e.altKey || e.ctrlKey || e.metaKey) return; switch(e.key){ case ' ': state.running = !state.running; playBtn && playBtn.setAttribute('aria-pressed', String(state.running)); liveAnnouncer.textContent = state.running ? 'Simulation started' : 'Simulation paused'; e.preventDefault(); break; case 'ArrowRight': stepSimulation(1); e.preventDefault(); break; } });

  // --- Init data & start loop ---
  function initData(){
    state.data = []; const now = Date.now(); let price = state.basePrice;
    for(let i=0;i<40;i++){ price = +(price * (1 + (randNormal()*0.02))).toFixed(2); state.data.push({t: now - (40-i)*1000, price}); }
    updatePortfolioSummary(); renderChart();
  }

  initData();
  raf = requestAnimationFrame(runLoop);

  // Expose for debugging
  window._accessibleStocks = { state, stepSimulation, renderChart, focusPoint };
})();