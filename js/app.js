// app.js - Lógica ERP Premium con Gráficos y Búsqueda Avanzada
document.addEventListener('DOMContentLoaded', () => {
    // ===== SYSTEM CLOCK =====
    const updateClock = () => {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    setInterval(updateClock, 1000);
    updateClock();

    const currentCashierName = db.activeCashierInfo ? JSON.parse(db.activeCashierInfo).name : 'Admin';
    document.querySelector('.avatar img').src = `https://ui-avatars.com/api/?name=${currentCashierName.replace(' ', '+')}&background=2563eb&color=fff`;

    // ===== ROUTING (Views) =====
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('current-page-title');
    const pageSubTitle = document.getElementById('current-page-subtitle');

    const viewTitles = {
        'dashboard': { t: 'Dashboard', s: 'Resumen genérico del negocio' },
        'pos': { t: 'Punto de Venta', s: 'Ventas y Emisión de Documentos' },
        'inventory': { t: 'Bodega e Inventario', s: 'Maestro de Productos y Ajustes' },
        'people': { t: 'Maestro de Personas', s: 'Gestión de Clientes, Proveedores y Personal' },
        'credits': { t: 'Gestión de Crédito', s: 'Ctas. Ctes. y Cobranza de Cuotas' },
        'workers': { t: 'Cajeros', s: 'Instancias de Terminal Activas' },
        'reports': { t: 'Reportes ERP', s: 'Informes de Gestión y Exportación' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.target;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            if (viewTitles[target]) {
                pageTitle.textContent = viewTitles[target].t;
                pageSubTitle.textContent = viewTitles[target].s;
            }
            if (target === 'dashboard') loadDashboard();
            if (target === 'inventory') loadInventory();
            if (target === 'people') loadPeople();
            if (target === 'credits') loadCredits();
            if (target === 'workers') loadWorkers();
            if (target === 'reports') {
                document.getElementById('btn-generate-report').click();
                loadReportsCharts();
            }
        });
    });

    const formatMoney = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
    const getLetter = (num) => String.fromCharCode(64 + num);

    const validateRUT = (rut) => {
        if (!/^[0-9]+-[0-9kK]{1}$/.test(rut.replace(/\./g, ''))) return false;
        let tmp = rut.replace(/\./g, '').split('-');
        let digv = tmp[1].toLowerCase();
        let corpo = tmp[0];
        let sum = 0;
        let mult = 2;
        for (let i = corpo.length - 1; i >= 0; i--) {
            sum += corpo[i] * mult;
            mult = mult === 7 ? 2 : mult + 1;
        }
        let res = 11 - (sum % 11);
        let vdv = res === 11 ? '0' : (res === 10 ? 'k' : res.toString());
        return vdv === digv;
    };

    const formatRUT = (rut) => {
        let value = rut.replace(/\./g, '').replace('-', '');
        if (value.length < 2) return value;
        let c = value.slice(0, -1);
        let dv = value.slice(-1).toUpperCase();
        let formatted = c.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
        return formatted;
    };

    document.getElementById('new-client-rut').addEventListener('blur', (e) => {
        e.target.value = formatRUT(e.target.value);
    });

    // ===== 1. DASHBOARD & KPIs =====
    let dashboardChart = null;
    const loadDashboard = () => {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = db.data.sales.filter(s => s.date.startsWith(today)).reduce((sum, s) => sum + s.total, 0);
        document.getElementById('kpi-sales').textContent = formatMoney(todaySales);
        document.getElementById('kpi-credits').textContent = formatMoney(db.data.people.reduce((s,p)=>s+p.debt, 0));
        document.getElementById('kpi-stock').textContent = db.data.products.filter(p => p.stock <= p.stockCrit).length;

        // Alerts (Mora/Vencimiento)
        const alertsBody = document.getElementById('alerts-body');
        if(alertsBody) {
            alertsBody.innerHTML = '';
            const now = new Date().toISOString().split('T')[0];
            const overdue = db.data.quotas.filter(q => q.dueDate < now && q.status !== 'pagado');
            
            overdue.forEach(q => {
                const tr = document.createElement('tr');
                const diffTime = Math.abs(new Date(now) - new Date(q.dueDate));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                tr.innerHTML = `
                    <td>${q.personName}</td>
                    <td>${q.personRut}</td>
                    <td>Letra ${getLetter(q.num_quota)} / ${q.dueDate}</td>
                    <td class="text-red fw-bold">${diffDays} días</td>
                    <td>${formatMoney(q.amount)}</td>
                    <td><span class="badge badge-red">MORA</span></td>
                `;
                alertsBody.appendChild(tr);
            });

            if(overdue.length === 0) {
                alertsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No hay cuotas vencidas pendientes.</td></tr>';
            }
        }

        // Dashboard Small Chart
        const ctx = document.getElementById('chartSales').getContext('2d');
        if(dashboardChart) dashboardChart.destroy();
        dashboardChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['L','M','X','J','V','S','D'],
                datasets: [{ 
                    label: 'Ventas Semanales (Demo)', 
                    data: [120000, 190000, 300000, 500000, 200000, 300000, 450000], 
                    borderColor:'#1a73e8', 
                    backgroundColor: 'rgba(26, 115, 232, 0.1)',
                    fill: true,
                    tension: 0.4 
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    // ===== 2. POS (VENTAS & PRODUCTOS) =====
    const renderPOSProducts = (products = [], isSearch = false) => {
        const grid = document.getElementById('pos-product-grid');
        grid.innerHTML = '';
        
        // Regla: 8 productos por defecto, o todos si busca
        const list = isSearch ? products : (products.length > 0 ? products.slice(0, 8) : db.getProducts().slice(0, 8));

        list.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="img-placeholder"><i class="fas fa-box"></i></div>
                <h4 title="${p.name}">${p.name}</h4>
                <div class="price">${formatMoney(p.price)}</div>
                <div class="stock ${p.stock <= p.stockCrit ? 'text-red' : ''}">Uds: ${p.stock}</div>
            `;
            card.addEventListener('click', () => {
                db.addToCart(p);
                renderCart();
            });
            grid.appendChild(card);
        });
    };

    // Category Filtering Support
    document.querySelectorAll('#pos-categories .cat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('#pos-categories .cat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const catId = pill.dataset.cat;
            if (catId === 'all') {
                renderPOSProducts(db.getProducts(), true);
            } else {
                const filtered = db.getProducts().filter(p => p.categoryId == catId);
                renderPOSProducts(filtered, true);
            }
        });
    });

    document.getElementById('pos-search').addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
            const filtered = db.getProducts(query);
            renderPOSProducts(filtered, true);
        } else {
            renderPOSProducts();
        }
    });

    const renderCart = () => {
        const items = document.getElementById('cart-items');
        items.innerHTML = '';
        if (db.data.cart.length === 0) {
            items.innerHTML = '<div class="empty-cart-msg">No hay productos en la orden.</div>';
            document.getElementById('cart-total').textContent = '$0';
            return;
        }

        let total = 0;
        db.data.cart.forEach(item => {
            total += item.price * item.qty;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info"><h4>${item.name}</h4><p>${formatMoney(item.price)} x ${item.qty}</p></div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                </div>
            `;
            items.appendChild(div);
        });
        document.getElementById('cart-subtotal').textContent = formatMoney(total);
        document.getElementById('cart-total').textContent = formatMoney(total);
    };

    window.updateQty = (id, n) => {
        const item = db.data.cart.find(i => i.id === id);
        if(item) {
            db.updateCartQty(id, item.qty + n);
            renderCart();
        }
    }

    document.getElementById('btn-pay').addEventListener('click', () => {
        if(db.data.cart.length === 0) return alert("Carrito Vacío");
        const total = db.data.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        document.getElementById('payment-total-display').textContent = formatMoney(total);
        openModal('modal-payment');
    });

    document.getElementById('btn-confirm-payment').addEventListener('click', () => {
        const activeMethod = document.querySelector('.method-card.active');
        if (!activeMethod) return alert("Seleccione un método de pago");
        
        const method = activeMethod.dataset.method;
        const creditParams = method === 'credit' ? { installments: parseInt(document.getElementById('credit-installments').value) } : null;
        
        const result = db.registerSale(method, false, creditParams);
        if(result.success) {
            closeModal('modal-payment');
            renderCart();
            renderPOSProducts();
            db.data.currentClient = null;
            updateClientUI();
            alert(`Venta Finalizada Exitosamente. Folio: ${result.saleId}`);
        } else {
            alert(`ERROR: ${result.reason}`);
        }
    });

    // Cambiar método de pago (Selección Visual)
    document.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Mostrar/Ocultar opciones según método
            const method = card.dataset.method;
            const creditOpt = document.getElementById('credit-options');
            const cashOpt = document.getElementById('cash-options');
            
            if (method === 'credit') {
                if (creditOpt) creditOpt.classList.remove('hidden');
                if (cashOpt) cashOpt.classList.add('hidden');
            } else if (method === 'cash') {
                if (creditOpt) creditOpt.classList.add('hidden');
                if (cashOpt) cashOpt.classList.remove('hidden');
            } else {
                if (creditOpt) creditOpt.classList.add('hidden');
                if (cashOpt) cashOpt.classList.add('hidden');
            }
        });
    });

    document.getElementById('btn-clear-cart').addEventListener('click', () => {
        if(confirm("¿Limpiar toda la orden?")) {
            db.clearCart();
            renderCart();
        }
    });

    document.getElementById('btn-presale').addEventListener('click', () => {
        if(db.data.cart.length === 0) return alert("Carrito Vacío");
        const result = db.registerSale('Efectivo', true);
        if(result.success) { // Guardar como preventa
            renderCart();
            alert(`Preventa Guardada. Folio: ${result.saleId}`);
        } else {
            alert(`ERROR: ${result.reason}`);
        }
    });

    // ===== 3. AUTOTEXTO & FOLIOS (Búsqueda Global) =====
    const globalSearch = document.getElementById('global-search');
    const globalDropdown = document.getElementById('global-search-results');

    globalSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        if(q.length < 1) return globalDropdown.classList.add('hidden');
        
        globalDropdown.innerHTML = '';
        // Buscar en Folios
        const matchingSales = db.data.sales.filter(s => s.id.toLowerCase().includes(q));
        matchingSales.slice(0, 5).forEach(s => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerHTML = `<i class="fas fa-file-invoice"></i> Folio: ${s.id} | ${formatMoney(s.total)}`;
            div.onclick = () => { alert(`Venta Folio ${s.id}\nTotal: ${s.total}\nMétodo: ${s.method}`); globalDropdown.classList.add('hidden'); };
            globalDropdown.appendChild(div);
        });
        if(matchingSales.length > 0) globalDropdown.classList.remove('hidden');
        else globalDropdown.classList.add('hidden');
    });

    // ===== 4. CLIENT GENERAL ICON =====
    document.getElementById('btn-add-client').addEventListener('click', () => {
        // Enlazar al modal de cliente pos y activar pestaña "Nuevo"
        openModal('modal-client');
        document.querySelector('#modal-client [data-tab="new"]').click();
    });

    const updateClientUI = () => {
        const div = document.getElementById('selected-client');
        if(db.data.currentClient) div.innerHTML = `<i class="fas fa-user-check"></i> ${db.data.currentClient.name}`;
        else div.innerHTML = `<i class="fas fa-user-circle"></i> Mostrar Cliente General`;
    };

    // Client Search logic
    document.getElementById('btn-search-client').addEventListener('click', () => openModal('modal-client'));
    
    // Tab switching for client modal
    document.querySelectorAll('#modal-client .tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('#modal-client .tab').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('#modal-client .tab-content').forEach(x => x.classList.add('hidden'));
            t.classList.add('active');
            document.getElementById('tab-' + t.dataset.tab).classList.remove('hidden');
        });
    });

    document.getElementById('search-client-input').addEventListener('input', (e) => {
        const q = e.target.value.trim();
        const results = document.getElementById('client-search-results');
        results.innerHTML = '';
        db.getPeople(q, 'client').forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${c.name}</strong> - ${c.rut}`;
            li.onclick = () => { db.data.currentClient = c; updateClientUI(); closeModal('modal-client'); };
            results.appendChild(li);
        });
    });

    document.getElementById('btn-save-client').addEventListener('click', () => {
        const rut = document.getElementById('new-client-rut').value.trim();
        if(!validateRUT(rut)) return alert("RUT Inválido. Verifique el formato (ej: 12.345.678-9)");

        const clientData = {
            rut: rut,
            name: document.getElementById('new-client-name').value.trim(),
            giro: document.getElementById('new-client-giro').value.trim() || 'Sin Giro',
            address: document.getElementById('new-client-address').value.trim(),
            commune: document.getElementById('new-client-commune').value.trim(),
            city: document.getElementById('new-client-city').value.trim(),
            phone: document.getElementById('new-client-phone').value.trim(),
            email: document.getElementById('new-client-email').value.trim(),
            limit_credit: parseFloat(document.getElementById('new-client-limit').value) || 0,
            isClient: true,
            isProvider: false,
            isEmployee: false,
            isBlocked: false
        };

        if(!clientData.name) return alert("El nombre es obligatorio");

        const newC = db.addPerson(clientData);
        db.data.currentClient = newC;
        updateClientUI();
        closeModal('modal-client');
        alert(`Cliente ${newC.name} registrado y seleccionado exitosamente.`);
        
        // Limpiar
        ['new-client-rut', 'new-client-name', 'new-client-giro', 'new-client-address', 'new-client-commune', 'new-client-city', 'new-client-phone', 'new-client-email'].forEach(id => document.getElementById(id).value = '');
    });

    // ===== 5. CREDITOS & LETRAS (A, B, C) =====
    const loadCredits = () => {
        const body = document.getElementById('credits-body');
        body.innerHTML = '';
        const now = new Date().toISOString().split('T')[0];

        db.data.quotas.forEach(q => {
            const tr = document.createElement('tr');
            // Convertir número cuota a Letra (1->A, 2->B...)
            const quotaLabel = `Letra ${getLetter(q.num_quota)}`;
            const isVencida = q.dueDate < now && q.status !== 'pagado';
            
            tr.innerHTML = `
                <td><strong>${q.personName}</strong></td>
                <td><small>${q.saleId}</small></td>
                <td class="fw-bold text-blue">${quotaLabel}</td>
                <td><span class="${isVencida ? 'text-red fw-bold' : ''}">${q.dueDate}</span></td>
                <td>${formatMoney(q.amount)}</td>
                <td>$0</td>
                <td><span class="badge ${q.status === 'pagado' ? 'badge-green' : (isVencida ? 'badge-red' : 'badge-orange')}">${q.status.toUpperCase()}</span></td>
                <td><button class="btn-action bg-blue" onclick="payLetter('${q.id}')">Cobrar</button></td>
            `;
            body.appendChild(tr);
        });
    };

    window.payLetter = (id) => {
        const q = db.data.quotas.find(x => x.id === id);
        if(q && q.status !== 'pagado') {
            q.status = 'pagado';
            const person = db.data.people.find(p => p.id === q.personId);
            if(person) person.debt -= q.amount;
            db.save();
            loadCredits();
        }
    };

    // ===== 6. REPORTS & CHARTS (DIARIO/SEMANAL) =====
    let chartDaily = null, chartWeekly = null;
    const loadReportsCharts = () => {
        const ctxD = document.getElementById('chartDaily').getContext('2d');
        const ctxW = document.getElementById('chartWeekly').getContext('2d');
        
        if(chartDaily) chartDaily.destroy();
        if(chartWeekly) chartWeekly.destroy();

        chartDaily = new Chart(ctxD, {
            type: 'doughnut',
            data: {
                labels: ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito'],
                datasets: [{ data: [300000, 150000, 50000, 120000], backgroundColor: ['#2563eb', '#38c172', '#ffed4a', '#e3342f'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        chartWeekly = new Chart(ctxW, {
            type: 'bar',
            data: {
                labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
                datasets: [{ label: 'Ventas por Día', data: [75000, 89000, 120000, 150000, 240000, 310000, 180000], backgroundColor: '#2563eb' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    // ===== OTHER CORE LOGIC (Personas, Inventory, Workers) =====
    // Inventory
    const loadInventory = () => {
        const body = document.getElementById('inventory-body');
        body.innerHTML = '';
        db.getProducts().forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.sku}</td><td>${p.name}</td><td>Maestro</td>
                <td>${formatMoney(p.price)}</td><td>${p.stock}</td>
                <td><span class="badge ${p.active ? 'badge-green':'badge-red'}">${p.active?'Act':'Inac'}</span></td>
                <td>
                    <button class="btn-icon text-blue" onclick="editProd('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon text-red" onclick="deleteProd('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            body.appendChild(tr);
        });
    };

    let editingProductId = null;

    document.getElementById('btn-open-new-product').addEventListener('click', () => {
        editingProductId = null;
        document.getElementById('modal-product').querySelector('h2').textContent = "Maestros: Nuevo Artículo";
        // Limpiar form
        ['new-prod-sku', 'new-prod-name', 'new-prod-price', 'new-prod-stock', 'new-prod-off-name', 'new-prod-off-qty', 'new-prod-off-price'].forEach(id => document.getElementById(id).value = '');
        openModal('modal-product');
    });

    window.editProd = (id) => {
        const p = db.data.products.find(x => x.id === id);
        if(!p) return;
        editingProductId = id;
        document.getElementById('modal-product').querySelector('h2').textContent = "Maestros: Editar Artículo";
        
        document.getElementById('new-prod-sku').value = p.sku;
        document.getElementById('new-prod-name').value = p.name;
        document.getElementById('new-prod-price').value = p.price;
        document.getElementById('new-prod-stock').value = p.stock;
        document.getElementById('new-prod-margin').value = p.margin || 30;
        document.getElementById('new-prod-active').checked = p.active;
        
        openModal('modal-product');
    };

    document.getElementById('btn-save-product').addEventListener('click', () => {
        const prodData = {
            sku: document.getElementById('new-prod-sku').value.trim(),
            name: document.getElementById('new-prod-name').value.trim(),
            price: parseFloat(document.getElementById('new-prod-price').value) || 0,
            stock: parseInt(document.getElementById('new-prod-stock').value) || 0,
            margin: parseFloat(document.getElementById('new-prod-margin').value) || 30,
            active: document.getElementById('new-prod-active').checked
        };

        if(!prodData.sku || !prodData.name) return alert("Código y Nombre son obligatorios");

        if(editingProductId) {
            db.updateProduct(editingProductId, prodData);
            alert("Producto actualizado exitosamente");
        } else {
            db.addProduct(prodData);
            alert("Producto creado exitosamente");
        }

        closeModal('modal-product');
        loadInventory();
        renderPOSProducts();
    });

    window.deleteProd = (id) => {
        if(confirm("¿Seguro que desea eliminar este producto del maestro?")) {
            db.data.products = db.data.products.filter(p => p.id !== id);
            db.save();
            loadInventory();
            renderPOSProducts();
        }
    };

    const loadPeople = () => {
        const body = document.getElementById('people-body');
        body.innerHTML = '';
        db.data.people.forEach(p => {
            const roles = (p.isClient ? 'Cli ' : '') + (p.isProvider ? 'Prov ' : '') + (p.isEmployee ? 'Emp' : '');
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${p.rut}</td><td><strong>${p.name}</strong></td><td>${p.giro}</td><td>${p.phone}</td><td>${roles}</td><td><span class="badge ${p.isBlocked ? 'badge-red' : 'badge-green'}">${p.isBlocked ? 'BLOQ' : 'HABIL'}</span></td><td>#</td>`;
            body.appendChild(tr);
        });
    }

    document.getElementById('btn-open-new-person').addEventListener('click', () => openModal('modal-person'));

    document.getElementById('btn-save-person').addEventListener('click', () => {
        const person = {
            rut: document.getElementById('p-rut').value.trim(),
            name: document.getElementById('p-name').value.trim(),
            giro: document.getElementById('p-giro').value.trim(),
            address: document.getElementById('p-address').value.trim(),
            commune: document.getElementById('p-commune').value.trim(),
            city: document.getElementById('p-city').value.trim(),
            phone: document.getElementById('p-phone').value.trim(),
            email: document.getElementById('p-email').value.trim(),
            limit_credit: parseFloat(document.getElementById('p-limit').value) || 0,
            isClient: document.getElementById('p-client').checked,
            isProvider: document.getElementById('p-provider').checked,
            isEmployee: document.getElementById('p-employee').checked,
            isBlocked: document.getElementById('p-blocked').checked
        };

        if(!person.rut || !person.name) return alert("RUT y Nombre son obligatorios");

        db.addPerson(person);
        closeModal('modal-person');
        loadPeople();
        alert("Persona guardada exitosamente en el Maestro");
        
        // Limpiar form
        ['p-rut', 'p-name', 'p-giro', 'p-address', 'p-commune', 'p-city', 'p-phone', 'p-email'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('p-limit').value = 0;
    });

    // ===== 7. WORKERS & CASHIERS (TERMINALES) =====
    const loadWorkers = () => {
        const body = document.getElementById('workers-body');
        if(!body) return;
        body.innerHTML = '';
        
        db.getWorkers().forEach(w => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${w.id.toUpperCase()}</strong></td>
                <td>${w.name} ${w.rut ? '('+w.rut+')' : ''}</td>
                <td><span class="badge badge-blue"><i class="fas fa-database"></i> ${w.instanceId || 'DB_LOCAL'}</span></td>
                <td>
                    <button class="btn-action bg-orange" onclick="switchTerminal('${w.id}')"><i class="fas fa-sign-in-alt"></i> Entrar</button>
                    ${w.id !== 'admin' ? `<button class="btn-icon text-red" onclick="deleteWorker('${w.id}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                </td>
            `;
            body.appendChild(tr);
        });
    };

    document.getElementById('btn-new-worker').addEventListener('click', () => {
        openModal('modal-worker');
    });

    document.getElementById('btn-create-worker').addEventListener('click', () => {
        const workerData = {
            rut: document.getElementById('new-worker-rut').value.trim(),
            name: document.getElementById('new-worker-name').value.trim(),
            email: document.getElementById('new-worker-email').value.trim(),
            pin: document.getElementById('new-worker-pin').value.trim()
        };

        if(!workerData.rut || !workerData.name || !workerData.pin) return alert("RUT, Nombre y PIN son obligatorios");

        db.addWorker(workerData);
        alert(`Cajero ${workerData.name} creado exitosamente.`);
        closeModal('modal-worker');
        loadWorkers();

        // Limpiar form
        ['new-worker-rut', 'new-worker-name', 'new-worker-email', 'new-worker-pin'].forEach(id => document.getElementById(id).value = '');
    });

    window.switchTerminal = (id) => {
        const w = db.getWorkers().find(x => x.id === id);
        if(w) {
            if(confirm(`¿Desea cambiar la instancia de venta al terminal de ${w.name}? Se cargará su stock asilado.`)) {
                db.switchCashier({ id: w.id, name: w.name });
            }
        }
    };

    window.deleteWorker = (id) => {
        if(confirm("¿Seguro que desea eliminar este cajero y su base de datos local?")) {
            if(db.deleteWorker(id)) loadWorkers();
        }
    };

    // ===== 8. CASH DRAWER (OPEN/CLOSE) =====
    const updateCashDrawerUI = () => {
        const status = document.getElementById('cash-drawer-status');
        if(!status) return;
        if(db.data.isCashDrawerOpen) {
            status.className = 'badge badge-green';
            status.innerHTML = '<i class="fas fa-unlock"></i> Caja Abierta';
        } else {
            status.className = 'badge badge-red';
            status.innerHTML = '<i class="fas fa-lock"></i> Caja Cerrada';
        }
    };

    document.getElementById('btn-cash-drawer').addEventListener('click', () => {
        if(!db.data.isCashDrawerOpen) {
            document.getElementById('drawer-opening').classList.remove('hidden');
            document.getElementById('drawer-closing').classList.add('hidden');
        } else {
            document.getElementById('drawer-opening').classList.add('hidden');
            document.getElementById('drawer-closing').classList.remove('hidden');
            // Calcular monto estimado
            const salesTotal = db.data.sales.filter(s => s.date >= db.data.cashDrawerOpenTime && s.method === 'cash').reduce((sum, s)=> sum + s.total, 0);
            const total = (db.data.cashDrawerInitialAmount || 0) + salesTotal;
            document.getElementById('cash-estimated').textContent = formatMoney(total);
        }
        openModal('modal-cash-drawer');
    });

    document.getElementById('btn-confirm-opening').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('cash-initial').value) || 0;
        db.openCashDrawer(amount);
        updateCashDrawerUI();
        closeModal('modal-cash-drawer');
        alert("Caja Abierta Exitosamente");
    });

    document.getElementById('btn-confirm-closing').addEventListener('click', () => {
        const real = parseFloat(document.getElementById('cash-real').value) || 0;
        if(confirm("¿Desea cerrar la caja y generar el comprobante de cuadratura?")) {
            db.closeCashDrawer(real);
            updateCashDrawerUI();
            closeModal('modal-cash-drawer');
            alert("Caja Cerrada Exitosamente. Se ha registrado el cuadre.");
        }
    });

    // Modal Helpers
    const openModal = (id) => document.getElementById(id).classList.add('active');
    const closeModal = (id) => document.getElementById(id).classList.remove('active');
    document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.remove('active')));
    
    // Initial State
    document.querySelector('.nav-item[data-target="pos"]').click();
    renderPOSProducts();
    updateClientUI();
    updateCashDrawerUI();
});
