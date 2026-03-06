                    // ==UserScript==
                    // @name         FMC CRID → Notes FAST v5 (Neon Green)
                    // @namespace    http://tampermonkey.net/fmc-crid-fast
                    // @version      5
                    // @description  Ultra-fast CRID auto-fill with neon green UI
                    // @match        https://trans-logistics-eu.amazon.com/*
                    // @grant        GM_addStyle
                    // @grant        GM_setValue
                    // @grant        GM_getValue
                    // @grant        GM_deleteValue
                    // @grant        GM_addValueChangeListener
                    // @run-at       document-idle
                    // ==/UserScript==
    
    const LOCAL_VERSION = 3;
    
    fetch("https://raw.githubusercontent.com/03-25-03-smt/crid-private/main/config.json")
    .then(r => r.json())
    .then(cfg => {
    
    if(!cfg.enabled){
    throw new Error("Script disabled");
    }
    
    if(cfg.version !== LOCAL_VERSION){
    location.reload();
    }
    
    });
    
                (async function(){
                
                const CONFIG_URL = "https://raw.githubusercontent.com/03-25-03-smt/crid-private/main/config.json";
                
                const cfg = await fetch(CONFIG_URL).then(r=>r.json()).catch(()=>null);
                
                console.log("CONFIG:", cfg);
                
                if(!cfg){
                console.log("Config load failed");
                return;
                }
                
                if(!cfg.enabled){
                alert("Script disabled by developer");
                throw new Error("Script disabled");
                }
                
                const expire = new Date(cfg.expire).getTime();
                
                if(Date.now() > expire){
                alert("Script expired");
                throw new Error("Expired");
                }
                
                })();
                    
                    (function () {
                        'use strict';
                    
                        /* ═══════════════════════════════════════════
                           MULTI-TAB COMMUNICATION
                           ═══════════════════════════════════════════ */
                        let running = false, stopRequested = false;
                        let results = [];
                        let counts = { total: 0, noted: 0, skipped: 0, error: 0 };
                        let globalIndex = 0, currentPage = 1, totalPages = 1;
                    
                        GM_addValueChangeListener("crid_command", (name, oldVal, newVal, remote) => {
                            if (!remote) return;
                            if (newVal === "stop") stopRequested = true;
                            if (newVal === "start" && !running) startFullScan();
                        });
                    
                        setInterval(() => window.dispatchEvent(new Event("mousemove")), 30000);
                    
                        /* ═══════════════════════════════════════════
                           HELPERS
                           ═══════════════════════════════════════════ */
                        const sleep = ms => new Promise(r => setTimeout(r, ms));
                        const $id = s => document.getElementById(s);
                    
                        /* ═══════════════════════════════════════════
                           NEON GREEN STYLES
                           ═══════════════════════════════════════════ */
                        GM_addStyle(`
                        #crid-panel{position:fixed;top:10px;right:10px;width:640px;max-height:92vh;background:#000d00;color:#b6ffb6;border:2px solid #00ff41;border-radius:10px;z-index:999999;font-family:'Consolas','Courier New',monospace;font-size:12px;box-shadow:0 0 30px rgba(0,255,65,.4),0 0 60px rgba(0,255,65,.15);display:flex;flex-direction:column;overflow:visible}
                        #crid-panel-header{background:linear-gradient(135deg,#003300,#00cc33);padding:12px 16px;font-size:15px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:move;border-bottom:2px solid #00ff41;user-select:none;border-radius:8px 8px 0 0;color:#000;text-shadow:0 0 10px rgba(0,255,65,.5)}
                        #crid-panel-header .accent{color:#ccffcc;text-shadow:0 0 8px #00ff41}
                        .cbtn{padding:6px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;margin:0 3px;transition:all .15s;font-family:inherit;letter-spacing:.5px}
                        .cbtn:hover{transform:scale(1.05);box-shadow:0 0 12px rgba(0,255,65,.5)}.cbtn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
                        .cbtn-start{background:#00ff41;color:#000}.cbtn-stop{background:#ff2244;color:#fff}
                        .cbtn-export{background:#00ccff;color:#000}.cbtn-clear{background:#444;color:#aaa}
                        .cbtn-min{background:#00ff41;color:#000;font-size:14px;padding:4px 10px}
                        #crid-controls{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:#001200;border-bottom:1px solid #00ff41;flex-wrap:wrap}
                        #crid-counter-bar{display:flex;align-items:center;justify-content:center;gap:14px;padding:8px 14px;background:#000a00;border-bottom:1px solid #00ff41;flex-wrap:wrap}
                        .ccounter-item{display:flex;align-items:center;gap:6px;font-size:12px}
                        .ccounter-label{color:#55aa55;font-weight:600}
                        .ccounter-value{background:#00ff41;color:#000;padding:2px 12px;border-radius:12px;font-weight:700;font-size:13px;min-width:30px;text-align:center;box-shadow:0 0 8px rgba(0,255,65,.3)}
                        .ccounter-value.green{background:#00ff41}.ccounter-value.slate{background:#556655;color:#ccc}
                        .ccounter-value.red{background:#ff2244;color:#fff}.ccounter-value.amber{background:#ccff00;color:#000}
                        .ccounter-value.purple{background:#aa44ff;color:#fff}.ccounter-value.gold{background:#ffcc00;color:#000}
                        #crid-reload-notice{display:none;background:linear-gradient(135deg,#00cc33,#00ff41);color:#000;text-align:center;padding:10px;font-weight:700;font-size:13px;animation:crpulse .8s ease infinite}
                        #crid-reload-notice.visible{display:block}
                        @keyframes crpulse{0%,100%{opacity:1}50%{opacity:.6}}
                        #crid-page-indicator{display:flex;align-items:center;justify-content:center;gap:10px;padding:6px 14px;background:#002200;font-weight:700;font-size:12px;flex-wrap:wrap}
                        .cpg-badge{background:#00ff41;color:#000;padding:2px 10px;border-radius:10px;font-size:11px}
                        .cpg-stat{color:#66ff66}
                        #crid-progress-wrap{width:calc(100% - 28px);background:#111;border-radius:8px;height:22px;margin:8px 14px;overflow:hidden;position:relative;border:1px solid #00ff41}
                        #crid-progress-bar{height:100%;width:0%;background:linear-gradient(90deg,#00cc33,#00ff41,#ccff00);border-radius:8px;transition:width .3s ease;box-shadow:0 0 15px rgba(0,255,65,.4)}
                        #crid-progress-text{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8)}
                        #crid-summary{display:flex;justify-content:center;gap:14px;padding:6px 14px 2px;font-weight:700;flex-wrap:wrap}
                        .cs-noted{color:#00ff41}.cs-skipped{color:#556655}.cs-error{color:#ff6644}.cs-total{color:#66ff66}
                        #crid-results{overflow-y:auto!important;overflow-x:hidden;flex:1;padding:8px;min-height:80px;max-height:46vh}
                        #crid-results::-webkit-scrollbar{width:8px!important;display:block!important}
                        #crid-results::-webkit-scrollbar-track{background:#000d00}
                        #crid-results::-webkit-scrollbar-thumb{background:#00ff41;border-radius:4px;min-height:40px}
                        .cscan-complete-banner{background:linear-gradient(135deg,#00cc33,#00ff41);color:#000;text-align:center;padding:14px;font-size:16px;font-weight:700;border-radius:8px;margin:8px;animation:cbpulse 1.5s ease infinite}
                        @keyframes cbpulse{0%,100%{box-shadow:0 0 10px rgba(0,255,65,.3)}50%{box-shadow:0 0 30px rgba(0,255,65,.7)}}
                        .cpage-separator{background:linear-gradient(90deg,transparent,#00ff41,transparent);color:#000;text-align:center;padding:8px;font-weight:700;font-size:12px;margin:10px 0;border-radius:6px;border:1px dashed #00ff41}
                        .crid-card{background:#001500;border-radius:8px;margin-bottom:4px;border-left:4px solid #333;overflow:hidden;transition:border-color .2s}
                        .crid-card.noted{border-left-color:#00ff41}.crid-card.skipped{border-left-color:#556655}
                        .crid-card.error{border-left-color:#ff2244}.crid-card.processing{border-left-color:#ccff00;animation:procpulse .6s infinite alternate}
                        @keyframes procpulse{from{background:#001500}to{background:#002200}}
                        .crid-card-header{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;font-size:11px}
                        .crid-card-title{font-weight:700;color:#88ff88}
                        .cvbadge{padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase}
                        .cvb-pending{background:#333;color:#888}.cvb-processing{background:#ccff00;color:#000}
                        .cvb-noted{background:#00ff41;color:#000}.cvb-skipped{background:#556655;color:#ccc}
                        .cvb-error{background:#ff2244;color:#fff}
                        .crid-msg{padding:2px 10px 6px;font-size:10px;color:#88aa88}
                        #crid-speed{background:#111;color:#00ff41;border:1px solid #00ff41;border-radius:4px;padding:4px 6px;font-size:11px;font-family:inherit}
                        #crid-speed option{background:#000;color:#00ff41}
                        html,body{overflow-y:auto!important}
                        `);
                    
                        /* ═══════════════════════════════════════════
                           BUILD PANEL
                           ═══════════════════════════════════════════ */
                        const panel = document.createElement('div');
                        panel.id = 'crid-panel';
                        panel.innerHTML = `
                        <div id="crid-panel-header">
                          <div>⚡ <span class="accent">CRID → Notes</span> FAST v5.0</div>
                          <div><button class="cbtn cbtn-min" id="crid-minimize">−</button></div>
                        </div>
                        <div id="crid-body">
                          <div id="crid-controls">
                            <button class="cbtn cbtn-start" id="crid-start">⚡ START</button>
                            <button class="cbtn cbtn-stop" id="crid-stop" disabled>⏹ STOP</button>
                            <button class="cbtn cbtn-export" id="crid-export" disabled>📥 CSV</button>
                            <button class="cbtn cbtn-clear" id="crid-clear">🗑 CLEAR</button>
                            <label style="margin-left:8px;font-size:11px;color:#66ff66;">
                              Delay: <select id="crid-speed">
                                <option value="0" selected>⚡ Instant (0ms)</option>
                                <option value="50">Turbo (50ms)</option>
                                <option value="150">Fast (150ms)</option>
                                <option value="500">Normal (500ms)</option>
                                <option value="1000">Safe (1s)</option>
                              </select>
                            </label>
                          </div>
                          <div id="crid-counter-bar">
                            <div class="ccounter-item"><span class="ccounter-label">📊 Total:</span><span class="ccounter-value" id="cc-total">0</span></div>
                            <div class="ccounter-item"><span class="ccounter-label">✅ Noted:</span><span class="ccounter-value green" id="cc-noted">0</span></div>
                            <div class="ccounter-item"><span class="ccounter-label">⏭ Skip:</span><span class="ccounter-value slate" id="cc-skipped">0</span></div>
                            <div class="ccounter-item"><span class="ccounter-label">❌ Err:</span><span class="ccounter-value red" id="cc-errors">0</span></div>
                            <div class="ccounter-item"><span class="ccounter-label">📄 Pg:</span><span class="ccounter-value amber" id="cc-page">1</span></div>
                            <div class="ccounter-item"><span class="ccounter-label">📑 Of:</span><span class="ccounter-value gold" id="cc-pages">?</span></div>
                          </div>
                          <div id="crid-reload-notice">🔄 Navigating…</div>
                          <div id="crid-page-indicator">
                            <span class="cpg-stat">VRIDs: <span class="cpg-badge" id="cpg-count">—</span></span>
                            <span class="cpg-stat">Status: <span id="cpg-status" style="color:#66ff66;">Ready</span></span>
                            <span class="cpg-stat">Speed: <span id="cpg-speed" style="color:#ccff00;">—</span></span>
                          </div>
                          <div id="crid-progress-wrap">
                            <div id="crid-progress-bar"></div>
                            <div id="crid-progress-text">Ready — Click ⚡ START</div>
                          </div>
                          <div id="crid-summary">
                            <span class="cs-total">Total: <span id="csum-total">0</span></span>
                            <span class="cs-noted">✅ <span id="csum-noted">0</span></span>
                            <span class="cs-skipped">⏭ <span id="csum-skipped">0</span></span>
                            <span class="cs-error">❌ <span id="csum-error">0</span></span>
                          </div>
                          <div id="crid-results"></div>
                        </div>`;
                    
                        if (document.body) document.body.appendChild(panel);
                        else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(panel));
                    
                        /* ═══════════════════════════════════════════
                           DRAG
                           ═══════════════════════════════════════════ */
                        (() => {
                            const h = $id('crid-panel-header');
                            let d = false, ox, oy;
                            h.addEventListener('mousedown', e => {
                                if (e.target.tagName === 'BUTTON') return;
                                d = true;
                                ox = e.clientX - panel.getBoundingClientRect().left;
                                oy = e.clientY - panel.getBoundingClientRect().top;
                            });
                            document.addEventListener('mousemove', e => {
                                if (!d) return;
                                panel.style.left = (e.clientX - ox) + 'px';
                                panel.style.top = (e.clientY - oy) + 'px';
                                panel.style.right = 'auto';
                            });
                            document.addEventListener('mouseup', () => d = false);
                        })();
                    
                        const bodyEl = $id('crid-body');
                        $id('crid-minimize').addEventListener('click', function () {
                            const hidden = bodyEl.style.display === 'none';
                            bodyEl.style.display = hidden ? '' : 'none';
                            this.textContent = hidden ? '−' : '+';
                        });
                    
                        /* ═══════════════════════════════════════════
                           DATATABLE API
                           ═══════════════════════════════════════════ */
                        function getDataTable() {
                            try {
                                if (typeof jQuery !== 'undefined' && jQuery.fn.DataTable) {
                                    const tbl = jQuery('#fmc-execution-plans-vrs');
                                    if (tbl.length && jQuery.fn.DataTable.isDataTable(tbl)) return tbl.DataTable();
                                }
                            } catch (e) {}
                            return null;
                        }
                    
                        function getPageInfo() {
                            const dt = getDataTable();
                            if (dt) try { const i = dt.page.info(); return { page: i.page, pages: i.pages, total: i.recordsDisplay }; } catch (e) {}
                            return null;
                        }
                    
                        function hasMorePages() {
                            const dt = getDataTable();
                            if (dt) try { const i = dt.page.info(); return i.page < i.pages - 1; } catch (e) {}
                            const nb = document.querySelector('#fmc-execution-plans-vrs_next');
                            if (!nb) return false;
                            return !nb.classList.contains('paginate_button_disabled') && !nb.classList.contains('disabled');
                        }
                    
                        async function goToNextPage() {
                            const dt = getDataTable();
                            if (dt) {
                                const info = dt.page.info();
                                if (info.page >= info.pages - 1) return false;
                                const oldPage = info.page;
                                dt.page('next').draw('page');
                                for (let w = 0; w < 10000; w += 200) {
                                    await sleep(200);
                                    if (dt.page.info().page !== oldPage) { await sleep(150); return true; }
                                }
                                return false;
                            }
                            const nb = document.querySelector('#fmc-execution-plans-vrs_next');
                            if (!nb || nb.classList.contains('paginate_button_disabled')) return false;
                            const firstId = getRows()[0]?.id;
                            nb.click();
                            for (let w = 0; w < 10000; w += 200) {
                                await sleep(200);
                                const nr = getRows();
                                if (nr.length && nr[0].id !== firstId) { await sleep(150); return true; }
                            }
                            return false;
                        }
                    
                        /* ═══════════════════════════════════════════
                           FAST DOM — from bottom script (optimized)
                           ═══════════════════════════════════════════ */
                        function getRows() {
                            return [...document.querySelectorAll('#fmc-execution-plans-vrs tbody tr[role="row"]')]
                                .filter(tr => tr.id && /^c\d+/.test(tr.id));
                        }
                    
                        function getVrid(row) {
                            const s = row.querySelector('.vr-audit-dialog');
                            return s ? s.textContent.trim() : row.id;
                        }
                    
                        function getCRID(row) {
                            const td = row.children[19];
                            if (!td) return '';
                            const inner = td.querySelector('td');
                            if (inner) return inner.textContent.trim();
                            return td.textContent.trim();
                        }
                    
                        function getNotesButton(row) {
                            const td = row.children[6];
                            if (!td) return null;
                            return td.querySelector('button') || td;
                        }
                    
                        /* ═══════════════════════════════════════════
                           FAST DIALOG HANDLER — with safety retries
                           ═══════════════════════════════════════════ */
                        async function waitDialog(maxWait = 3000) {
                            for (let w = 0; w < maxWait; w += 40) {
                                const dlg = document.querySelector('.ui-dialog:not([style*="display: none"])');
                                if (dlg && dlg.offsetHeight > 0) return dlg;
                                await sleep(40);
                            }
                            return null;
                        }
                    
                        async function addNote(code, extraDelay) {
                            const dlg = await waitDialog(3000);
                            if (!dlg) return { ok: false, reason: 'no dialog' };
                    
                            /* Try fake input first to expand textarea */
                            const fake = dlg.querySelector('input[name="addCommentFake"]')
                                      || dlg.querySelector('input[placeholder="Add note"]')
                                      || dlg.querySelector('input.a-input-text');
                            if (fake) {
                                fake.click();
                                fake.focus();
                                await sleep(80);
                            }
                    
                            /* Find textarea — retry loop */
                            let textarea = null;
                            for (let attempt = 0; attempt < 15; attempt++) {
                                textarea = dlg.querySelector('textarea[name="addComment"]')
                                        || dlg.querySelector('textarea');
                                if (textarea) break;
                                await sleep(60);
                            }
                            if (!textarea) return { ok: false, reason: 'no textarea' };
                    
                            /* Paste */
                            textarea.focus();
                            textarea.value = code;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    
                            /* Verify — one retry */
                            if (textarea.value !== code) {
                                await sleep(50);
                                textarea.value = code;
                                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                    
                            /* Checkbox */
                            const cb = dlg.querySelector('input[name="isExternallyVisible"]')
                                    || dlg.querySelector('input[type="checkbox"]');
                            if (cb && !cb.checked) cb.click();
                    
                            /* Add Note button */
                            const btn = dlg.querySelector('button[name="saveComment"]')
                                     || [...dlg.querySelectorAll('button')].find(b => /add\s*note/i.test(b.textContent));
                            if (!btn) return { ok: false, reason: 'no Add Note button' };
                            btn.click();
                    
                            await sleep(extraDelay > 80 ? 80 : 50);
                    
                            /* Check for error */
                            const err = dlg.querySelector('.error-message, .a-alert-error, .alert-error');
                            if (err && err.textContent.trim()) return { ok: false, reason: 'save error: ' + err.textContent.trim() };
                    
                            /* Close dialog if still open */
                            await sleep(40);
                            const still = document.querySelector('.ui-dialog:not([style*="display: none"])');
                            if (still && still.offsetHeight > 0) {
                                const closeBtn = still.querySelector('.ui-dialog-titlebar-close')
                                              || [...still.querySelectorAll('button')].find(b => b.textContent.trim() === 'Close');
                                if (closeBtn) closeBtn.click();
                                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                                await sleep(60);
                            }
                    
                            return { ok: true };
                        }
                    
                        function closeAllDialogs() {
                            document.querySelectorAll('.ui-dialog .ui-dialog-titlebar-close').forEach(b => {
                                try { b.click(); } catch (_) {}
                            });
                        }
                    
                        /* ═══════════════════════════════════════════
                           UI UPDATE FUNCTIONS
                           ═══════════════════════════════════════════ */
                        function getDelay() { return parseInt($id('crid-speed').value, 10) || 0; }
                    
                        function updateUI() {
                            $id('cc-total').textContent = counts.total;
                            $id('cc-noted').textContent = counts.noted;
                            $id('cc-skipped').textContent = counts.skipped;
                            $id('cc-errors').textContent = counts.error;
                            $id('cc-page').textContent = currentPage;
                            $id('csum-total').textContent = counts.total;
                            $id('csum-noted').textContent = counts.noted;
                            $id('csum-skipped').textContent = counts.skipped;
                            $id('csum-error').textContent = counts.error;
                            const pi = getPageInfo();
                            if (pi) { totalPages = pi.pages; $id('cc-pages').textContent = pi.pages; }
                        }
                    
                        function updateProgress(cur, tot) {
                            const p = tot ? Math.round((cur / tot) * 100) : 0;
                            $id('crid-progress-bar').style.width = p + '%';
                            $id('crid-progress-text').textContent = `Pg ${currentPage} — ${cur}/${tot} — Global: ${globalIndex}`;
                        }
                    
                        function addCard(g, vrid, status, msg, code) {
                            const c = document.createElement('div');
                            c.className = 'crid-card ' + status;
                            const badgeCls = 'cvb-' + status;
                            const badgeTxt = status.toUpperCase();
                            c.innerHTML = `<div class="crid-card-header">
                                <span class="crid-card-title">#${g + 1} — ${vrid}</span>
                                <span class="cvbadge ${badgeCls}">${badgeTxt}</span>
                            </div>
                            <div class="crid-msg">${msg}${code ? ' — <b style="color:#ccff00">"' + code + '"</b>' : ''}</div>`;
                            $id('crid-results').appendChild(c);
                        }
                    
                        function addPageSep(page, count) {
                            const d = document.createElement('div');
                            d.className = 'cpage-separator';
                            d.innerHTML = `📄 PAGE ${page}/${totalPages} — ${count} VRIDs`;
                            $id('crid-results').appendChild(d);
                        }
                    
                        function showComplete() {
                            const b = document.createElement('div');
                            b.className = 'cscan-complete-banner';
                            b.innerHTML = `⚡ ALL PAGES SCANNED ⚡<br><span style="font-size:13px;">${counts.total} VRIDs across ${currentPage} page(s)<br>✅ ${counts.noted} Noted | ⏭ ${counts.skipped} Skipped | ❌ ${counts.error} Errors</span>`;
                            $id('crid-results').appendChild(b);
                            $id('crid-results').scrollTop = $id('crid-results').scrollHeight;
                            $id('crid-progress-bar').style.width = '100%';
                            $id('crid-progress-text').textContent = `✅ DONE — ${currentPage} pgs | ${counts.total} VRIDs | ✅ ${counts.noted} noted`;
                        }
                    
                        /* ═══════════════════════════════════════════
                           WAIT FOR TABLE
                           ═══════════════════════════════════════════ */
                        async function waitForTable(timeout = 15000) {
                            for (let w = 0; w < timeout; w += 300) {
                                if (getRows().length > 0) { await sleep(100); return true; }
                                await sleep(300);
                            }
                            return false;
                        }
                    
                        /* ═══════════════════════════════════════════
                           ★★★ FAST PROCESS PAGE ★★★
                           ═══════════════════════════════════════════ */
                        async function processPage() {
                            const rows = getRows();
                            const n = rows.length;
                            $id('cpg-count').textContent = n;
                            $id('cpg-status').textContent = `⚡ Processing page ${currentPage}`;
                            $id('cpg-status').style.color = '#ccff00';
                    
                            if (n === 0) return 0;
                            addPageSep(currentPage, n);
                    
                            const dl = getDelay();
                            const startTime = performance.now();
                    
                            for (let i = 0; i < n; i++) {
                                if (stopRequested) break;
                    
                                const row = rows[i];
                                const vrid = getVrid(row);
                                const code = getCRID(row);
                                const g = globalIndex++;
                    
                                /* Skip if no CRID */
                                if (!code) {
                                    counts.skipped++; counts.total++;
                                    addCard(g, vrid, 'skipped', '⏭ No CRID code', '');
                                    results.push({ index: g, page: currentPage, vrid, result: 'SKIPPED', code: '', msg: 'No CRID' });
                                    updateUI();
                                    updateProgress(i + 1, n);
                                    continue;
                                }
                    
                                /* Get notes button */
                                const btn = getNotesButton(row);
                                if (!btn) {
                                    counts.error++; counts.total++;
                                    addCard(g, vrid, 'error', '❌ Notes cell not found', code);
                                    results.push({ index: g, page: currentPage, vrid, result: 'ERROR', code, msg: 'No notes cell' });
                                    updateUI();
                                    updateProgress(i + 1, n);
                                    continue;
                                }
                    
                                /* Click and process */
                                try {
                                    row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
                                    btn.click();
                    
                                    if (dl > 0) await sleep(Math.min(dl, 100));
                    
                                    const res = await addNote(code, dl);
                    
                                    if (res.ok) {
                                        counts.noted++; counts.total++;
                                        addCard(g, vrid, 'noted', '✅ Note added', code);
                                        results.push({ index: g, page: currentPage, vrid, result: 'NOTED', code, msg: 'OK' });
                                    } else {
                                        counts.error++; counts.total++;
                                        addCard(g, vrid, 'error', '❌ ' + res.reason, code);
                                        results.push({ index: g, page: currentPage, vrid, result: 'ERROR', code, msg: res.reason });
                                        closeAllDialogs();
                                        await sleep(100);
                                    }
                                } catch (err) {
                                    counts.error++; counts.total++;
                                    addCard(g, vrid, 'error', '❌ ' + (err.message || err), code);
                                    results.push({ index: g, page: currentPage, vrid, result: 'ERROR', code, msg: String(err) });
                                    closeAllDialogs();
                                    await sleep(100);
                                }
                    
                                updateUI();
                                updateProgress(i + 1, n);
                    
                                /* Scroll results to bottom every 5 rows */
                                if (i % 5 === 0) $id('crid-results').scrollTop = $id('crid-results').scrollHeight;
                    
                                if (dl > 0) await sleep(dl);
                            }
                    
                            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
                            $id('cpg-speed').textContent = `${n} rows in ${elapsed}s`;
                    
                            $id('crid-results').scrollTop = $id('crid-results').scrollHeight;
                            return n;
                        }
                    
                        /* ═══════════════════════════════════════════
                           ★★★ MAIN SCAN LOOP ★★★
                           ═══════════════════════════════════════════ */
                        async function startFullScan() {
                            if (running) return;
                            running = true; stopRequested = false;
                            $id('crid-start').disabled = true;
                            $id('crid-stop').disabled = false;
                            $id('crid-export').disabled = true;
                    
                            globalIndex = 0; currentPage = 1;
                            results = [];
                            counts = { total: 0, noted: 0, skipped: 0, error: 0 };
                            $id('crid-results').innerHTML = '';
                            updateUI();
                    
                            const pi = getPageInfo();
                            if (pi) {
                                totalPages = pi.pages;
                                currentPage = pi.page + 1;
                                $id('cc-pages').textContent = pi.pages;
                                $id('cc-page').textContent = currentPage;
                            }
                    
                            if (!(await waitForTable())) {
                                $id('cpg-status').textContent = '❌ Table not found';
                                finishScan(); return;
                            }
                    
                            const scanStart = performance.now();
                    
                            while (!stopRequested) {
                                $id('cpg-status').textContent = `⚡ Page ${currentPage}/${totalPages}`;
                                $id('cc-page').textContent = currentPage;
                    
                                const processed = await processPage();
                                if (stopRequested || processed === 0) break;
                    
                                if (!hasMorePages()) break;
                    
                                $id('cpg-status').textContent = `🔄 → Page ${currentPage + 1}`;
                                $id('crid-reload-notice').textContent = `🔄 Page ${currentPage + 1}…`;
                                $id('crid-reload-notice').classList.add('visible');
                    
                                const nav = await goToNextPage();
                                $id('crid-reload-notice').classList.remove('visible');
                                if (!nav) break;
                    
                                currentPage++;
                                if (!(await waitForTable(15000))) break;
                    
                                const npi = getPageInfo();
                                if (npi) { totalPages = npi.pages; $id('cc-pages').textContent = npi.pages; }
                    
                                await sleep(200);
                            }
                    
                            const totalElapsed = ((performance.now() - scanStart) / 1000).toFixed(1);
                            $id('cpg-speed').textContent = `Total: ${totalElapsed}s`;
                            finishScan();
                        }
                    
                        function finishScan() {
                            showComplete();
                            running = false;
                            $id('crid-start').disabled = false;
                            $id('crid-stop').disabled = true;
                            $id('crid-export').disabled = false;
                            $id('cpg-status').textContent = `✅ Done — ${currentPage} page(s)`;
                            $id('cpg-status').style.color = '#00ff41';
                        }
                    
                        /* ═══════════════════════════════════════════
                           CSV EXPORT
                           ═══════════════════════════════════════════ */
                        function exportCSV() {
                            if (!results.length) return;
                            const h = 'Index,Page,VRID,Result,BookingCode,Message\n';
                            const r = results.map(row =>
                                [row.index + 1, row.page, `"${row.vrid}"`, `"${row.result}"`,
                                 `"${(row.code || '').replace(/"/g, '""')}"`,
                                 `"${(row.msg || '').replace(/"/g, '""')}"`].join(',')
                            ).join('\n');
                            const b = new Blob([h + r], { type: 'text/csv' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(b);
                            a.download = 'crid_fast_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.csv';
                            a.click();
                            URL.revokeObjectURL(a.href);
                        }
                    
                        /* ═══════════════════════════════════════════
                           EVENT BINDINGS
                           ═══════════════════════════════════════════ */
                        $id('crid-start').addEventListener('click', () => {
                            GM_setValue("crid_command", "start");
                            startFullScan();
                        });
                    
                        $id('crid-stop').addEventListener('click', () => {
                            GM_setValue("crid_command", "stop");
                            stopRequested = true;
                            $id('crid-stop').disabled = true;
                            $id('cpg-status').textContent = '⏹ Stopping…';
                            $id('cpg-status').style.color = '#ff2244';
                        });
                    
                        $id('crid-export').addEventListener('click', exportCSV);
                    
                        $id('crid-clear').addEventListener('click', () => {
                            if (running) return;
                            $id('crid-results').innerHTML = '';
                            results = []; counts = { total: 0, noted: 0, skipped: 0, error: 0 };
                            globalIndex = 0; currentPage = 1; totalPages = 1;
                            updateUI();
                            $id('crid-progress-bar').style.width = '0%';
                            $id('crid-progress-text').textContent = 'Ready — Click ⚡ START';
                            $id('cpg-status').textContent = 'Ready';
                            $id('cpg-status').style.color = '#66ff66';
                            $id('cpg-count').textContent = '—';
                            $id('cpg-speed').textContent = '—';
                            $id('cc-page').textContent = '1';
                            $id('cc-pages').textContent = '?';
                        });
                    
                        /* ═══════════════════════════════════════════
                           AUTO-INIT
                           ═══════════════════════════════════════════ */
                        (async () => {
                            await sleep(1500);
                            const pi = getPageInfo();
                            if (pi) {
                                totalPages = pi.pages;
                                currentPage = pi.page + 1;
                                $id('cc-pages').textContent = pi.pages;
                                $id('cc-page').textContent = currentPage;
                            }
                        })();
                    
                    })();
