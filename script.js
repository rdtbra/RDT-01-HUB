/**
 * RDT Canvas Hub v1.1
 * Atualizações: Seletor de Cores e Migração Inteligente
 */

(() => {
  // --- Elementos Globais ---
  const viewport = document.getElementById("viewport");
  const world = document.getElementById("world");
  const grid = document.getElementById("grid");
  const configModal = document.getElementById("configModal");

  // --- Paleta de Cores do Sistema ---
  const PALETTE = [
    "#6366f1", // Indigo (Default)
    "#ef4444", // Red
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#3b82f6", // Blue
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#64748b"  // Slate
  ];

  // --- Estado da Aplicação ---
  const STATE = {
    cam: { x: window.innerWidth / 2 - 400, y: 100, z: 1 },
    envelopes: [],
    config: { delay: 300 }
  };

  const STORAGE_KEY_AUTOSAVE = "rdt-canvas-autosave";
  const STORAGE_KEY_CONFIG = "rdt-canvas-config";

  // --- Inicialização ---
  function init() {
    loadConfig();
    if (window.RDT_DATA) {
      loadData(window.RDT_DATA);
    } else {
      const saved = localStorage.getItem(STORAGE_KEY_AUTOSAVE);
      if (saved) {
        try { loadData(JSON.parse(saved)); } 
        catch (e) { createDefaultEnvelope(); }
      } else {
        createDefaultEnvelope();
      }
    }
    setupEventListeners();
    applyCam();
    render();
  }

  function loadData(data) {
    if (data.cam) STATE.cam = data.cam;
    if (data.envelopes) STATE.envelopes = data.envelopes;
  }

  function loadConfig() {
    const cfg = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (cfg) try { STATE.config = { ...STATE.config, ...JSON.parse(cfg) }; } catch (e) {}
  }

  function createDefaultEnvelope() {
    STATE.envelopes = [{
      id: `env-${Date.now()}`,
      name: "Comece Aqui",
      color: PALETTE[0],
      x: 100, y: 100,
      isOpen: true,
      team: [],
      referenceUrl: "",
      icon: "",
      description: "Bem-vindo ao seu novo Canvas Hub.",
      tags: []
    }];
  }

  function saveState() {
    const dataToSave = { cam: STATE.cam, envelopes: STATE.envelopes };
    localStorage.setItem(STORAGE_KEY_AUTOSAVE, JSON.stringify(dataToSave));
  }

  // --- Renderização ---
  function render() {
    STATE.envelopes.forEach(env => {
      let el = document.getElementById(env.id);
      
      if (!el) {
        el = document.createElement("div");
        el.id = env.id;
        el.className = "envelope";
        world.appendChild(el);
        
        el.addEventListener("pointerdown", (e) => {
          if (e.target.closest(".env-header") && !e.target.closest("input, button, [contenteditable]")) {
            startDragEnvelope(e, env);
          }
        });
      }

      el.style.left = `${env.x}px`;
      el.style.top = `${env.y}px`;
      
      // Aplica a cor na borda quando aberto
      if (env.isOpen) {
        el.classList.add("open");
        el.style.borderColor = env.color;
      } else {
        el.classList.remove("open");
        el.style.borderColor = ""; // Reseta para cor padrão do CSS
      }

      const stateHash = `${env.isOpen}-${env.team.length}-${env.tags.length}-${env.name}-${env.color}`;
      if (el.dataset.hash !== stateHash || env._forceUpdate) {
        renderEnvelopeContent(el, env);
        el.dataset.hash = stateHash;
        delete env._forceUpdate;
      }
    });
  }

  function renderEnvelopeContent(el, env) {
    const isOpen = env.isOpen;
    
    const headerHTML = `
      <div class="env-header">
        <div class="env-color" style="background: ${env.color}"></div>
        <div class="env-title" contenteditable="true" spellcheck="false">${env.name}</div>
        <div class="env-controls">
          ${!isOpen ? `<button class="btn btn-sm btn-danger btn-del-env" title="Apagar">🗑</button>` : ''}
          <button class="btn btn-sm btn-toggle">${isOpen ? '✖' : '⤢'}</button>
        </div>
      </div>
    `;

    if (!isOpen) {
      el.innerHTML = headerHTML + `
        <div class="env-closed-body">
          <div class="tag-counter">${env.tags.length} etiquetas • ${env.team.length} membros</div>
          <button class="btn btn-primary btn-toggle" style="width:100%">Abrir</button>
        </div>
      `;
    } else {
      // Gera HTML da paleta de cores
      const colorPickerHTML = `
        <div class="color-picker">
          ${PALETTE.map(c => `
            <div class="color-option ${env.color === c ? 'selected' : ''}" 
                 style="background: ${c}" 
                 data-color="${c}">
            </div>
          `).join('')}
        </div>
      `;

      el.innerHTML = headerHTML + `
        <div class="env-open-body">
          <div class="col-left">
            <div class="env-icon-wrapper">
              ${env.icon ? `<img src="${env.icon}" class="env-icon-img">` : `<span style="color:#666">Sem Ícone</span>`}
            </div>
            
            <!-- Seletor de Cores Inserido Aqui -->
            ${colorPickerHTML}

            <div style="display:flex; gap:5px">
              <button class="btn btn-sm btn-primary btn-ref" style="flex:1" ${!env.referenceUrl ? 'disabled' : ''}>📚 Referência</button>
              <button class="btn btn-sm btn-danger btn-del-env">🗑</button>
            </div>
            <textarea class="desc-area" placeholder="Descrição e observações...">${env.description || ''}</textarea>
          </div>
          
          <div class="col-right">
            <div class="tabs-header">
              <button class="tab-btn active" data-tab="team">Equipe IA (${env.team.length})</button>
              <button class="tab-btn" data-tab="tags">Etiquetas (${env.tags.length})</button>
            </div>
            
            <div class="tab-content active" id="tab-team-${env.id}">
              <div class="team-actions" style="margin-bottom:10px">
                <button class="btn btn-sm btn-primary btn-open-team">🚀 Abrir Selecionados</button>
              </div>
              <div class="team-list">
                ${renderTeamList(env)}
              </div>
            </div>
            
            <div class="tab-content" id="tab-tags-${env.id}">
              <div class="tags-list">
                ${renderTagsList(env)}
              </div>
              <button class="btn btn-sm btn-add-tag" style="margin-top:10px; width:100%">+ Nova Etiqueta</button>
            </div>
          </div>
        </div>
      `;
    }
    attachEnvelopeEvents(el, env);
  }

  function renderTeamList(env) {
    if (!env.team.length) return `<div style="text-align:center; color:#666; font-size:12px">Nenhum membro na equipe.</div>`;
    return env.team.map((member, idx) => `
      <div class="team-item">
        <input type="checkbox" class="chk-member" data-idx="${idx}" ${member.checked ? 'checked' : ''}>
        <span class="team-code">${member.code}</span>
        <a href="${member.url}" target="_blank" class="team-label" style="text-decoration:none; color:inherit">${member.label}</a>
        <button class="btn btn-sm btn-icon" onclick="window.open('${member.url}', '_blank')">↗</button>
      </div>
    `).join('');
  }

  function renderTagsList(env) {
    if (!env.tags.length) return `<div style="text-align:center; color:#666; font-size:12px">Arraste etiquetas para cá ou crie novas.</div>`;
    return env.tags.map(tag => `
      <div class="tag-item" data-id="${tag.id}">
        <div class="tag-img" title="Arraste para mover">
          <img src="${tag.img}" onerror="this.style.display='none'">
        </div>
        <div class="tag-content">
          <textarea class="tag-input" placeholder="Texto da etiqueta...">${tag.text}</textarea>
          <div class="tag-actions">
            <button class="btn btn-sm btn-icon btn-expand-tag">⤢</button>
            <button class="btn btn-sm btn-icon btn-danger btn-del-tag">🗑</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // --- Eventos ---
  function attachEnvelopeEvents(el, env) {
    // Toggle e Renomear
    el.querySelectorAll('.btn-toggle').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); env.isOpen = !env.isOpen; env._forceUpdate = true; render(); saveState(); });
    const titleEl = el.querySelector('.env-title');
    if (titleEl) {
      titleEl.onblur = () => { env.name = titleEl.innerText; saveState(); };
      titleEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } };
    }
    el.querySelectorAll('.btn-del-env').forEach(btn => btn.onclick = () => { if (confirm(`Apagar envelope "${env.name}"?`)) { STATE.envelopes = STATE.envelopes.filter(e => e.id !== env.id); el.remove(); saveState(); } });

    if (env.isOpen) {
      // Descrição e Referência
      const descArea = el.querySelector('.desc-area'); if (descArea) descArea.oninput = () => { env.description = descArea.value; saveState(); };
      const btnRef = el.querySelector('.btn-ref'); if (btnRef) btnRef.onclick = () => window.open(env.referenceUrl, '_blank');

      // Seletor de Cores (NOVO)
      el.querySelectorAll('.color-option').forEach(opt => {
        opt.onclick = () => {
          env.color = opt.dataset.color;
          env._forceUpdate = true; // Força re-render para atualizar borda e header
          render();
          saveState();
        };
      });

      // Tabs
      el.querySelectorAll('.tab-btn').forEach(tab => {
        tab.onclick = () => {
          el.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
          el.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          el.querySelector(`#tab-${tab.dataset.tab}-${env.id}`).classList.add('active');
        };
      });

      // Equipe
      el.querySelectorAll('.chk-member').forEach(chk => { chk.onchange = () => { env.team[chk.dataset.idx].checked = chk.checked; saveState(); }; });
      const btnOpenTeam = el.querySelector('.btn-open-team'); if (btnOpenTeam) btnOpenTeam.onclick = () => openTeamLinks(env);

      // Tags
      const btnAddTag = el.querySelector('.btn-add-tag');
      if (btnAddTag) {
        btnAddTag.onclick = () => {
          env.tags.push({ id: Date.now(), text: "", img: `https://placehold.co/60x60/333/FFF?text=TAG` });
          env._forceUpdate = true; render(); saveState();
        };
      }
      el.querySelectorAll('.tag-input').forEach(input => { input.oninput = (e) => { const t = env.tags.find(tag => tag.id === parseInt(e.target.closest('.tag-item').dataset.id)); if (t) { t.text = e.target.value; saveState(); } }; });
      el.querySelectorAll('.btn-expand-tag').forEach(btn => btn.onclick = (e) => e.target.closest('.tag-item').classList.toggle('expanded'));
      el.querySelectorAll('.btn-del-tag').forEach(btn => btn.onclick = (e) => { if (confirm("Apagar etiqueta?")) { const tid = parseInt(e.target.closest('.tag-item').dataset.id); env.tags = env.tags.filter(t => t.id !== tid); env._forceUpdate = true; render(); saveState(); } });
      el.querySelectorAll('.tag-img').forEach(img => { img.onpointerdown = (e) => { const t = env.tags.find(tag => tag.id === parseInt(img.closest('.tag-item').dataset.id)); startDragTag(e, t, env); }; });
    }
  }

  // --- Drag Logic (Envelope & Tag) ---
  function startDragEnvelope(e, env) {
    e.preventDefault();
    const el = document.getElementById(env.id);
    el.style.zIndex = 200;
    const startX = e.clientX, startY = e.clientY, startEnvX = env.x, startEnvY = env.y, z = STATE.cam.z;
    const move = (ev) => { env.x = startEnvX + (ev.clientX - startX) / z; env.y = startEnvY + (ev.clientY - startY) / z; el.style.left = `${env.x}px`; el.style.top = `${env.y}px`; };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); el.style.zIndex = env.isOpen ? 100 : ""; saveState(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function startDragTag(e, tag, sourceEnv) {
    e.preventDefault();
    const ghost = document.createElement("div"); ghost.className = "ghost-drag"; ghost.innerHTML = `<img src="${tag.img}"><span>${tag.text || 'Etiqueta'}</span>`; document.body.appendChild(ghost);
    const updateGhost = (x, y) => { ghost.style.left = `${x + 10}px`; ghost.style.top = `${y + 10}px`; }; updateGhost(e.clientX, e.clientY);
    let targetEnvId = null;
    const move = (ev) => {
      updateGhost(ev.clientX, ev.clientY); ghost.style.display = "none"; const elem = document.elementFromPoint(ev.clientX, ev.clientY); ghost.style.display = "flex";
      const envEl = elem ? elem.closest(".envelope") : null;
      document.querySelectorAll(".envelope.drag-over").forEach(el => el.classList.remove("drag-over"));
      if (envEl && envEl.classList.contains("open")) { targetEnvId = envEl.id; envEl.classList.add("drag-over"); } else { targetEnvId = null; }
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); ghost.remove();
      document.querySelectorAll(".envelope.drag-over").forEach(el => el.classList.remove("drag-over"));
      if (targetEnvId && targetEnvId !== sourceEnv.id) {
        const targetEnv = STATE.envelopes.find(e => e.id === targetEnvId);
        if (targetEnv) { sourceEnv.tags = sourceEnv.tags.filter(t => t.id !== tag.id); targetEnv.tags.push(tag); sourceEnv._forceUpdate = true; targetEnv._forceUpdate = true; render(); saveState(); }
      }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // --- Câmera ---
  function applyCam() { world.style.transform = `translate(${STATE.cam.x}px, ${STATE.cam.y}px) scale(${STATE.cam.z})`; grid.style.transform = `translate(${STATE.cam.x * 0.2}px, ${STATE.cam.y * 0.2}px) scale(${STATE.cam.z})`; }
  let isPanning = false, panStart = {};
  viewport.addEventListener("pointerdown", (e) => { if (e.target.closest(".envelope")) return; isPanning = true; viewport.classList.add("dragging"); panStart = { x: e.clientX, y: e.clientY, cx: STATE.cam.x, cy: STATE.cam.y }; viewport.setPointerCapture(e.pointerId); });
  viewport.addEventListener("pointermove", (e) => { if (!isPanning) return; STATE.cam.x = panStart.cx + (e.clientX - panStart.x); STATE.cam.y = panStart.cy + (e.clientY - panStart.y); applyCam(); });
  viewport.addEventListener("pointerup", () => { if (isPanning) saveState(); isPanning = false; viewport.classList.remove("dragging"); });
  viewport.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); const d = -e.deltaY, f = d > 0 ? 1.1 : 0.9, r = viewport.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, wx = (mx - STATE.cam.x) / STATE.cam.z, wy = (my - STATE.cam.y) / STATE.cam.z; let nz = Math.max(0.1, Math.min(5, STATE.cam.z * f)); STATE.cam.x = mx - wx * nz; STATE.cam.y = my - wy * nz; STATE.cam.z = nz; applyCam(); clearTimeout(window.saveTimeout); window.saveTimeout = setTimeout(saveState, 1000); }, { passive: false });

  // --- Funcionalidades Específicas ---
  function openTeamLinks(env) {
    const toOpen = env.team.filter(m => m.checked);
    if (!toOpen.length) return alert("Nenhum item selecionado.");
    let delay = 0;
    toOpen.forEach(item => { setTimeout(() => window.open(item.url, "_blank", "noopener"), delay); delay += STATE.config.delay; });
  }

  // --- MIGRAÇÃO LEGACY (Aprimorada) ---
  function importLegacyFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      try {
        let jsonStr = content.replace(/window\.GROUPS\s*=\s*/, '').trim().replace(/;$/, '');
        const groups = new Function(`return ${jsonStr}`)();

        if (Array.isArray(groups)) {
          let xOffset = 100;
          groups.forEach(g => {
            // Criação do Envelope
            const newEnv = {
              id: g.id || `env-${Date.now()}-${Math.random()}`,
              name: g.name,
              color: g.color || PALETTE[0],
              x: xOffset,
              y: 100,
              isOpen: false,
              team: g.items || [], // Mantém os links de IA na equipe
              referenceUrl: g.iconHref || "",
              icon: g.icon || "",
              description: "",
              tags: []
            };

            // --- LÓGICA NOVA: Material vira Etiqueta ---
            // Se houver um material de referência (iconHref), cria uma etiqueta para ele
            if (g.iconHref) {
              newEnv.tags.push({
                id: Date.now() + Math.random(),
                text: "Material de Referência (Importado)",
                img: g.icon || "https://placehold.co/60x60/4f46e5/FFF?text=REF"
              });
            }

            STATE.envelopes.push(newEnv);
            xOffset += 300;
          });
          
          render();
          saveState();
          alert(`Migração concluída! ${groups.length} envelopes criados.`);
        }
      } catch (err) {
        console.error(err);
        alert("Falha na importação. Certifique-se que é um arquivo *groups.js válido.");
      }
    };
    reader.readAsText(file);
  }

  function exportDataJS() {
    const content = `window.RDT_DATA = ${JSON.stringify({ cam: STATE.cam, envelopes: STATE.envelopes }, null, 2)};`;
    const blob = new Blob([content], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "data.js"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // --- Toolbar Actions ---
  document.getElementById("btnAddEnv").onclick = () => { STATE.envelopes.push({ id: `env-${Date.now()}`, name: "Novo Envelope", color: PALETTE[0], x: -STATE.cam.x + window.innerWidth/2 - 140, y: -STATE.cam.y + window.innerHeight/2 - 100, isOpen: true, team: [], referenceUrl: "", icon: "", description: "", tags: [] }); render(); saveState(); };
  document.getElementById("btnResetCam").onclick = () => { STATE.cam = { x: window.innerWidth/2 - 400, y: 100, z: 1 }; applyCam(); saveState(); };
  document.getElementById("btnExport").onclick = exportDataJS;
  document.getElementById("btnLoad").onclick = () => document.getElementById("fileInputData").click();
  document.getElementById("fileInputData").onchange = (e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => { try { loadData(JSON.parse(ev.target.result.replace(/^window\.RDT_DATA\s*=\s*/, '').replace(/;?\s*$/, ''))); applyCam(); render(); saveState(); alert("Carregado!"); } catch (err) { alert("Erro ao ler."); } }; r.readAsText(f); e.target.value = ''; } };
  document.getElementById("btnImportLegacy").onclick = () => document.getElementById("fileInputLegacy").click();
  document.getElementById("fileInputLegacy").onchange = (e) => { if (e.target.files[0]) importLegacyFile(e.target.files[0]); e.target.value = ''; };
  document.getElementById("btnConfig").onclick = () => { document.getElementById("cfgDelay").value = STATE.config.delay; configModal.classList.remove("hidden"); };
  document.getElementById("btnCancelConfig").onclick = () => configModal.classList.add("hidden");
  document.getElementById("btnSaveConfig").onclick = () => { STATE.config.delay = parseInt(document.getElementById("cfgDelay").value) || 300; localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(STATE.config)); configModal.classList.add("hidden"); };

  // --- Setup ---
  function setupEventListeners() {
    // Atalhos de teclado globais podem vir aqui
  }

  init();
})();