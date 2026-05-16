import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function App() {
  // Autenticación
  const [token, setToken] = useState(localStorage.getItem('jwt_optica') || '');
  const [operadorActual, setOperadorActual] = useState(localStorage.getItem('user_optica') || 'Especialista');
  const [rolActual, setRolActual] = useState(localStorage.getItem('role_optica') || '');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [cargandoLogin, setCargandoLogin] = useState(false);

  // Navegación modular
  const [tabActiva, setTabActiva] = useState('registro'); 
  const [tabGraficoSecundario, setTabGraficoSecundario] = useState('mensual');

  // Colecciones Analíticas
  const [dataTopVentas, setDataTopVentas] = useState(null);
  const [dataMensual, setDataMensual] = useState(null);
  const [dataDiaria, setDataDiaria] = useState(null);
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [kpisMes, setKpisMes] = useState({ ingresosTotales: 0, ingresosLiquidos: 0, totalOrdenes: 0 });

  // Paginación
  const [paginaActual, setPaginaActual] = useState(0);
  const registrosPorPagina = 5;

  // CAMPOS DE FORMULARIO
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [total, setTotal] = useState('');
  const [aCuenta, setACuenta] = useState('');
  const [montura, setMontura] = useState('');
  const [monturaPrecio, setMonturaPrecio] = useState(''); 
  const [tipoTrabajo, setTipoTrabajo] = useState('');
  const [tipoTrabajoPrecio, setTipoTrabajoPrecio] = useState(''); 
  const [tratado, setTratado] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  
  // =========================================================================
  // NUEVA ESTRUCTURA DE REFRACCIÓN (Adaptada al talonario físico)
  // =========================================================================
  const [od, setOd] = useState({ esf: '', cil: '', eje: '' });
  const [oi, setOi] = useState({ esf: '', cil: '', eje: '' });
  const [addCerca, setAddCerca] = useState('');
  const [addIntermedia, setAddIntermedia] = useState('');
  const [dipLejos, setDipLejos] = useState('');
  const [dipCerca, setDipCerca] = useState('');
  
  const [cargandoVenta, setCargandoVenta] = useState(false);

  // Directorio y Búsqueda
  const [listaDirectorio, setListaDirectorio] = useState([]);
  const [cargandoDirectorio, setCargandoDirectorio] = useState(false);
  const [busquedaDni, setBusquedaDni] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [ordenesCliente, setOrdenesCliente] = useState([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);
  const [estadoBusqueda, setEstadoBusqueda] = useState('');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [filtroDirectorio, setFiltroDirectorio] = useState('');

  // Alertas
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const saldoCalculado = (Number(total) || 0) - (Number(aCuenta) || 0);

  // Auto-cálculo inteligente del Total
  useEffect(() => {
    const mPrecio = Number(monturaPrecio) || 0;
    const tPrecio = Number(tipoTrabajoPrecio) || 0;
    if (mPrecio > 0 || tPrecio > 0) {
      setTotal((mPrecio + tPrecio).toString());
    }
  }, [monturaPrecio, tipoTrabajoPrecio]);

  const fetchSeguro = async (endpoint, options = {}) => {
    const headers = { ...options.headers, 'x-optica-auth': `Bearer ${localStorage.getItem('jwt_optica')}` };
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) { localStorage.clear(); setToken(''); window.location.reload(); }
    return res;
  };

  const cargarDashboard = async () => {
    try {
      const res = await fetchSeguro('/api/dashboard');
      if (res.ok) {
        const d = await res.json();
        const ultimas10 = d.topVentas || [];
        setVentasRecientes(ultimas10);
        if (d.kpisMes) setKpisMes(d.kpisMes);

        if (ultimas10.length > 0) {
          setDataTopVentas({ 
            labels: ultimas10.map(v => v.label || 'Venta'), 
            datasets: [{ label: 'Total (S/)', data: ultimas10.map(v => Number(v.total) || 0), backgroundColor: '#0284c7' }] 
          });
        } else { setDataTopVentas(null); }
        
        if (d.analiticaMensual && d.analiticaMensual.length > 0) {
          setDataMensual({ labels: d.analiticaMensual.map(m => m.mes || 'Mes'), datasets: [{ label: 'Ingresos (S/)', data: d.analiticaMensual.map(m => Number(m.total) || 0), backgroundColor: '#059669' }] });
        } else { setDataMensual(null); }

        if (d.analiticaDiaria && d.analiticaDiaria.length > 0) {
          setDataDiaria({ 
            labels: d.analiticaDiaria.map(d => d.dia || 'Día'), 
            datasets: [{ label: 'Cierre Ventas (S/)', data: d.analiticaDiaria.map(d => Number(d.cantidad) || 0), backgroundColor: '#f97316' }] 
          });
        } else { setDataDiaria(null); }
      }
    } catch (e) { console.error(e); }
  };

  const cargarDirectorio = async () => {
    setCargandoDirectorio(true);
    try {
      const res = await fetchSeguro('/api/clientes');
      if (res.ok) setListaDirectorio((await res.json()).clientes || []);
    } catch (e) {} 
    finally { setCargandoDirectorio(false); }
  };

  useEffect(() => { if (token) { cargarDashboard(); cargarDirectorio(); } }, [token, tabActiva]);

  const handleLogin = async (e) => {
    e.preventDefault(); setCargandoLogin(true); setErrorLogin('');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, password }) });
      if (res.ok) {
        const d = await res.json();
        localStorage.setItem('jwt_optica', d.token); localStorage.setItem('user_optica', d.usuario); localStorage.setItem('role_optica', d.role);
        setToken(d.token); setOperadorActual(d.usuario); setRolActual(d.role);
      } else setErrorLogin("Credenciales corporativas inválidas");
    } catch(e) { setErrorLogin("Error de red"); }
    setCargandoLogin(false);
  };

  const purgarClienteCompleto = async (e, cid, nombre) => {
    e.stopPropagation();
    if (!window.confirm(`¿BORRADO DEFINITIVO? Se eliminará a ${nombre} y TODO su historial.`)) return;
    const res = await fetchSeguro(`/api/venta?id=${cid}`, { method: 'DELETE' });
    if (res.ok) {
      setMensajeExito("Limpieza total completada.");
      setListaDirectorio(prev => prev.filter(c => `cli_${c.dni}` !== cid));
      setClienteEncontrado(null); setOrdenesCliente([]); setBusquedaDni('');
      cargarDashboard();
    }
  };

  const consultarExpediente = async (targetDni) => {
    if (!targetDni) return;
    setErrorForm(''); setMensajeExito(''); setEstadoBusqueda('Consultando base de datos...'); setClienteEncontrado(null); setOrdenesCliente([]);
    setCargandoBusqueda(true);
    try {
      const res = await fetchSeguro(`/api/cliente?dni=${targetDni.trim()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cliente || (data.ordenes && data.ordenes.length > 0)) {
          setClienteEncontrado(data.cliente); setOrdenesCliente(data.ordenes || []); setEstadoBusqueda('');
        } else { setEstadoBusqueda('No se encontraron historiales para este paciente.'); }
      } else { setEstadoBusqueda('No se localizó el expediente en la base de datos.'); }
    } catch(e) { setEstadoBusqueda('Error de consulta.'); } 
    finally { setCargandoBusqueda(false); }
  };

  const registrarVenta = async (e) => {
    e.preventDefault(); setCargandoVenta(true); setErrorForm(''); setMensajeExito('');
    if (!dni || !nombres) { setErrorForm('DNI y Nombres obligatorios.'); setCargandoVenta(false); return; }
    
    // Inyección de la nueva estructura de refracción
    const payload = { 
      dni: dni.trim(), nombres: nombres.trim(), direccion, telefono, 
      montura, monturaPrecio: Number(monturaPrecio), 
      tipoTrabajo, tipoTrabajoPrecio: Number(tipoTrabajoPrecio), 
      tratado, fechaEntrega, aCuenta: Number(aCuenta), saldo: saldoCalculado, total: Number(total), 
      refraccion: { od, oi, addCerca, addIntermedia, dipLejos, dipCerca } 
    };

    try {
      const res = await fetchSeguro('/api/venta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { 
        setMensajeExito("Generado con éxito."); 
        setDni(''); setNombres(''); setDireccion(''); setTelefono(''); setTotal(''); setACuenta(''); 
        setMontura(''); setMonturaPrecio(''); setTipoTrabajo(''); setTipoTrabajoPrecio(''); setTratado(''); setFechaEntrega('');
        setOd({ esf: '', cil: '', eje: '' }); setOi({ esf: '', cil: '', eje: '' });
        setAddCerca(''); setAddIntermedia(''); setDipLejos(''); setDipCerca('');
        cargarDashboard(); cargarDirectorio(); 
      } else { setErrorForm('Error al guardar la orden.'); }
    } catch(e) { setErrorForm('Fallo de red.'); }
    setCargandoVenta(false);
  };

  const eliminarOrdenRegistro = async (e, ordId, ordNum) => {
    e.stopPropagation(); 
    if (!window.confirm(`¿Eliminar definitivamente la orden ${ordNum}?`)) return;
    const res = await fetchSeguro(`/api/venta?id=${ordId}`, { method: 'DELETE' });
    if (res.ok) {
      setMensajeExito(`Orden ${ordNum} purgada.`);
      setOrdenesCliente(prev => prev.filter(o => o.id !== ordId));
      cargarDirectorio(); cargarDashboard();
    }
  };

  const handleUpdateOd = (field, val) => setOd(prev => ({ ...prev, [field]: val }));
  const handleUpdateOi = (field, val) => setOi(prev => ({ ...prev, [field]: val }));

  const opcionesElegantes = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { 
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, 
      x: { grid: { display: false }, ticks: { font: { size: 9 } } } 
    },
    elements: { bar: { borderRadius: 4 } }
  };

  const totalPaginas = Math.ceil(ventasRecientes.length / registrosPorPagina);
  const ventasPaginadas = ventasRecientes.slice(paginaActual * registrosPorPagina, (paginaActual + 1) * registrosPorPagina);

  const directorioFiltrado = (listaDirectorio || []).filter(c => 
    (c?.nombres || '').toLowerCase().includes(filtroDirectorio.toLowerCase()) ||
    (c?.dni || '').includes(filtroDirectorio)
  );

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Óptica MV</h2>
        {errorLogin && <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-xs mb-4 text-center font-bold">{errorLogin}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Usuario" className="w-full p-3 border rounded-xl" value={usuario} onChange={e=>setUsuario(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full p-3 border rounded-xl" value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit" disabled={cargandoLogin} className="w-full bg-sky-600 text-white p-3 rounded-xl font-bold">{cargandoLogin ? 'Conectando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-2"><span className="bg-sky-600 text-white font-bold px-2 py-1 rounded text-xs">Óptica MV</span><h1 className="font-bold text-slate-700 text-sm md:text-base">Sistema de gestión optométrica</h1></div>
        <div className="flex items-center space-x-4"><span className="text-xs font-bold text-sky-700 hidden md:inline">{operadorActual} ({rolActual})</span><button onClick={()=>{localStorage.clear(); setToken('');}} className="text-xs text-rose-600 font-bold border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-50">Salir</button></div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6 flex-grow">
        
        {/* TARJETAS SUPERIORES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border shadow-2xs flex items-center space-x-4 border-l-4 border-l-sky-600">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Ingreso Bruto Mensual</span>
              <span className="text-lg font-black text-slate-800">S/ {kpisMes.ingresosTotales.toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-2xs flex items-center space-x-4 border-l-4 border-l-emerald-600">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Liquidado en Caja</span>
              <span className="text-lg font-black text-emerald-600">S/ {kpisMes.ingresosLiquidos.toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-2xs flex items-center space-x-4 border-l-4 border-l-purple-600">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Volumen Operativo</span>
              <span className="text-lg font-black text-slate-800">{kpisMes.totalOrdenes} Órdenes emitidas</span>
            </div>
          </div>
        </div>

        {/* LAYOUT PRINCIPAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
            <div className="border-b pb-2">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recientes (S/) | Últimas 10 Órdenes</h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Avance de recaudación por paciente en las últimas atenciones.</p>
            </div>
            <div className="h-64 mt-4">
              {dataTopVentas ? <Bar data={dataTopVentas} options={opcionesElegantes} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-lg">Sin datos transaccionales</div>}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Analítica de Ventas</h2>
                <div className="flex bg-slate-100 rounded-lg p-0.5 border text-[10px]">
                  <button onClick={()=>setTabGraficoSecundario('mensual')} className={`px-2.5 py-1 rounded-md font-bold transition-all ${tabGraficoSecundario==='mensual'?'bg-sky-600 text-white shadow-xs':'text-slate-500 hover:text-slate-800'}`}>Meses (S/)</button>
                  <button onClick={()=>setTabGraficoSecundario('diario')} className={`px-2.5 py-1 rounded-md font-bold transition-all ${tabGraficoSecundario==='diario'?'bg-sky-600 text-white shadow-xs':'text-slate-500 hover:text-slate-800'}`}>Cierre Días</button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {tabGraficoSecundario === 'mensual' ? 'Evolución de recaudación financiera por periodo mensual.' : 'Cierre de ventas acumulado por días de la semana.'}
              </p>
            </div>
            <div className="h-64 mt-4">
              {tabGraficoSecundario === 'mensual' && (dataMensual ? <Bar data={dataMensual} options={opcionesElegantes} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-lg">Cargando métricas...</div>)}
              {tabGraficoSecundario === 'diario' && (dataDiaria ? <Bar data={dataDiaria} options={opcionesElegantes} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-lg">Cargando métricas...</div>)}
            </div>
          </div>
        </div>

        {/* SELECTOR DE 3 MÓDULOS */}
        <div className="flex bg-slate-200 p-1.5 rounded-xl border shadow-inner mb-6 max-w-xl mx-auto mt-8">
          <button onClick={() => {setTabActiva('registro'); setErrorForm(''); setMensajeExito('');}} className={`flex-1 py-2.5 rounded-lg font-extrabold text-xs transition-all ${tabActiva === 'registro' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>📋 Módulo 1: Registrar Venta</button>
          <button onClick={() => {setTabActiva('transacciones'); setErrorForm(''); setMensajeExito('');}} className={`flex-1 py-2.5 rounded-lg font-extrabold text-xs transition-all ${tabActiva === 'transacciones' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>📒 Módulo 2: Transacciones</button>
          <button onClick={() => {setTabActiva('historial'); setErrorForm(''); setMensajeExito('');}} className={`flex-1 py-2.5 rounded-lg font-extrabold text-xs transition-all ${tabActiva === 'historial' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>🔍 Módulo 3: Auditoría</button>
        </div>

        {mensajeExito && <div className="bg-emerald-500 text-white p-3 rounded-xl text-center font-bold text-sm animate-fade-in">{mensajeExito}</div>}
        {errorForm && <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-center font-bold text-sm animate-fade-in border border-rose-200">{errorForm}</div>}

        {/* =========================================================================
            MÓDULO 1: FORMULARIO CLÍNICO (Adaptado a Talonario Simple + Precios)
            ========================================================================= */}
        {tabActiva === 'registro' && (
          <form onSubmit={registrarVenta} className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white p-6 rounded-2xl border shadow-sm">
            <div className="lg:col-span-4 space-y-4">
              <h3 className="font-bold border-b pb-2 text-xs text-slate-700">FICHA DEL PACIENTE</h3>
              <input type="text" placeholder="DNI *" required maxLength={8} className="w-full p-2 border rounded font-bold text-sm outline-none focus:border-sky-600" value={dni} onChange={e=>setDni(e.target.value)} />
              <input type="text" placeholder="Nombre completo *" required className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" value={nombres} onChange={e=>setNombres(e.target.value)} />
              <input type="text" placeholder="Dirección" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" value={direccion} onChange={e=>setDireccion(e.target.value)} />
              <input type="text" placeholder="Teléfono" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" value={telefono} onChange={e=>setTelefono(e.target.value)} />
            </div>

            <div className="lg:col-span-8 space-y-6">
              
              {/* TABLA DE REFRACCIÓN REDISEÑADA COMO EN PAPEL */}
              <div>
                <h3 className="font-bold border-b pb-2 mb-3 text-xs text-slate-700">REFRACCIÓN VISUAL</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50 p-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-extrabold uppercase border-b border-slate-200">
                        <th className="p-2 w-16">OJO</th>
                        <th className="p-2">ESFERA</th>
                        <th className="p-2">CILINDRO</th>
                        <th className="p-2">EJE</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-700 divide-y divide-slate-200">
                      <tr>
                        <td className="p-2 font-black text-sky-700">O.D.</td>
                        <td className="p-1"><input type="text" className="w-full p-2 border rounded text-center font-bold outline-none focus:border-sky-600 bg-white" value={od.esf} onChange={e=>handleUpdateOd('esf',e.target.value)} /></td>
                        <td className="p-1"><input type="text" className="w-full p-2 border rounded text-center font-bold outline-none focus:border-sky-600 bg-white" value={od.cil} onChange={e=>handleUpdateOd('cil',e.target.value)} /></td>
                        <td className="p-1"><input type="text" className="w-full p-2 border rounded text-center outline-none focus:border-sky-600 bg-white" value={od.eje} onChange={e=>handleUpdateOd('eje',e.target.value)} /></td>
                      </tr>
                      <tr>
                        <td className="p-2 font-black text-sky-700">O.I.</td>
                        <td className="p-1"><input type="text" className="w-full p-2 border rounded text-center font-bold outline-none focus:border-sky-600 bg-white" value={oi.esf} onChange={e=>handleUpdateOi('esf',e.target.value)} /></td>
                        <td className="p-1"><input type="text" className="w-full p-2 border rounded text-center font-bold outline-none focus:border-sky-600 bg-white" value={oi.cil} onChange={e=>handleUpdateOi('cil',e.target.value)} /></td>
                        <td className="p-1"><input type="text" className="w-full p-2 border rounded text-center outline-none focus:border-sky-600 bg-white" value={oi.eje} onChange={e=>handleUpdateOi('eje',e.target.value)} /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* PARTE INFERIOR DEL TALONARIO: ADICIONES Y DIP */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Add. Cerca:</label>
                      <input type="text" value={addCerca} onChange={e=>setAddCerca(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600 bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Add. Intermedia:</label>
                      <input type="text" value={addIntermedia} onChange={e=>setAddIntermedia(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600 bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Dip. Lejos:</label>
                      <input type="text" value={dipLejos} onChange={e=>setDipLejos(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600 bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Dip. Cerca:</label>
                      <input type="text" value={dipCerca} onChange={e=>setDipCerca(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600 bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ESPECIFICACIONES CON TIPO DE TRABAJO Y PRECIOS DESGLOSADOS */}
              <div>
                <h3 className="font-bold border-b pb-2 mb-3 text-xs text-slate-700">ESPECIFICACIONES Y COSTOS</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-slate-500 block mb-1">MONTURA</label><input type="text" value={montura} onChange={e=>setMontura(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-emerald-600 block mb-1">PRECIO (S/)</label><input type="number" placeholder="0.00" value={monturaPrecio} onChange={e=>setMonturaPrecio(e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 bg-emerald-50/30" /></div>
                  
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO DE TRABAJO</label><input type="text" value={tipoTrabajo} onChange={e=>setTipoTrabajo(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-emerald-600 block mb-1">PRECIO (S/)</label><input type="number" placeholder="0.00" value={tipoTrabajoPrecio} onChange={e=>setTipoTrabajoPrecio(e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 bg-emerald-50/30" /></div>
                  
                  <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-bold text-slate-500 block mb-1">TRATADO</label><input type="text" value={tratado} onChange={e=>setTratado(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border">
                <h3 className="text-[10px] font-extrabold text-slate-400 mb-3 uppercase">Estructura de Cobro</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">TOTAL S/ *</label><input type="number" required value={total} onChange={e=>setTotal(e.target.value)} className="w-full p-2 border rounded font-bold text-sm bg-white outline-none focus:border-sky-600" /></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">A CTA. S/ *</label><input type="number" required value={aCuenta} onChange={e=>setACuenta(e.target.value)} className="w-full p-2 border rounded font-bold text-emerald-600 text-sm bg-white outline-none focus:border-sky-600" /></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">SALDO</label><div className="w-full p-2 border rounded bg-slate-200/60 font-bold text-rose-600 text-sm">{saldoCalculado}</div></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">ENTREGA</label><input type="date" value={fechaEntrega} onChange={e=>setFechaEntrega(e.target.value)} className="w-full p-2 border rounded text-xs bg-white outline-none focus:border-sky-600" /></div>
                </div>
              </div>

              <button type="submit" disabled={cargandoVenta} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl font-bold text-sm shadow flex items-center justify-center transition-all disabled:opacity-50">{cargandoVenta ? 'Procesando...' : 'Confirmar Transacción e Imprimir Orden'}</button>
            </div>
          </form>
        )}

        {/* MÓDULO 2: LIBRO DE TRANSACCIONES */}
        {tabActiva === 'transacciones' && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 max-w-4xl mx-auto">
            <div className="border-b pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase">Libro Transaccional Paginado</h3>
                <p className="text-xs text-slate-400 mt-0.5">Auditoría en crudo de los últimos 10 expedientes emitidos.</p>
              </div>
              <span className="bg-slate-100 text-slate-600 font-extrabold text-[10px] px-2.5 py-1 rounded border">
                Página {paginaActual + 1} de {totalPaginas || 1}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold border-b uppercase">
                    <th className="p-3">Expediente Clínico</th>
                    <th className="p-3">Ingreso Bruto</th>
                    <th className="p-3 text-right">Estado Financiero</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y">
                  {ventasPaginadas.length === 0 ? (
                    <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-xs">No hay historiales transaccionales en memoria</td></tr>
                  ) : (
                    ventasPaginadas.map((v, i) => {
                      const partes = v.label ? v.label.split('|') : ['ORD', 'Paciente'];
                      const numOrden = partes[0].trim();
                      const nombreCli = partes[1] ? partes[1].trim() : 'Paciente';
                      const esDeuda = v.saldo && Number(v.saldo) > 0;
                      return (
                        <tr key={i} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-sky-700 text-sm block">{numOrden}</span>
                            <span className="text-xs text-slate-600 font-medium">{nombreCli}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{v.fechaOrden ? new Date(v.fechaOrden).toLocaleString() : ''}</span>
                          </td>
                          <td className="p-3 font-black text-slate-800 text-sm">S/ {v.total}</td>
                          <td className="p-3 text-right">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider ${esDeuda ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                              {esDeuda ? `Deuda: S/ ${v.saldo}` : 'Liquidado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex justify-between items-center pt-4 border-t text-xs text-slate-500">
                <span>Total transacciones indexadas: <strong>{ventasRecientes.length}</strong></span>
                <div className="flex space-x-2">
                  <button onClick={() => setPaginaActual(prev => Math.max(prev - 1, 0))} disabled={paginaActual === 0} className="px-4 py-1.5 rounded-lg border bg-white hover:bg-slate-100 disabled:opacity-30 font-bold transition-all shadow-2xs">◀ Anterior</button>
                  <button onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas - 1))} disabled={paginaActual >= totalPaginas - 1} className="px-4 py-1.5 rounded-lg border bg-white hover:bg-slate-100 disabled:opacity-30 font-bold transition-all shadow-2xs">Siguiente ▶</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MÓDULO 3: AUDITORÍA CLÍNICA (Limpiado del buscador derecho) */}
        {tabActiva === 'historial' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-4 rounded-b-xl rounded-tr-xl border shadow-sm lg:sticky lg:top-24 self-start space-y-4">
              <div className="border-b pb-3">
                <h3 className="text-xs font-extrabold text-slate-700 mb-2">DIRECTORIO GLOBAL</h3>
                <button onClick={cargarDirectorio} disabled={cargandoDirectorio} className="w-full bg-slate-100 hover:bg-sky-50 text-sky-700 border border-slate-200 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center transition-all shadow-sm disabled:opacity-50">
                  {cargandoDirectorio ? '🔄 Sincronizando...' : '🔄 Sincronizar Directorio'}
                </button>
                
                <input 
                  type="text" 
                  placeholder="🔍 Filtrar por nombre o DNI..." 
                  className="w-full p-2.5 border rounded-lg text-base lg:text-xs outline-none focus:border-sky-600 bg-slate-50 mt-3 font-medium text-slate-700 placeholder:text-slate-400"
                  value={filtroDirectorio}
                  onChange={e => setFiltroDirectorio(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-60 lg:max-h-96 overflow-y-auto pr-1">
                {directorioFiltrado.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">No se encontraron coincidencias</div>
                ) : (
                  directorioFiltrado.map(c => (
                    <div key={c?.dni || Math.random()} onClick={()=> {setBusquedaDni(c?.dni || ''); consultarExpediente(c?.dni);}} className={`p-3 rounded-xl hover:bg-sky-50 cursor-pointer flex justify-between items-center group transition-colors ${busquedaDni===(c?.dni)?'bg-sky-50 border-l-4 border-sky-600': 'bg-slate-50'}`}>
                      <div><p className="text-xs font-bold text-slate-800">{c?.nombres || 'Desconocido'}</p><p className="text-[10px] text-slate-500">{c?.dni || ''}</p></div>
                      {rolActual === 'admin' && <button onClick={e=>purgarClienteCompleto(e,`cli_${c?.dni}`,c?.nombres)} title="Purgar cliente" className="text-rose-400 hover:text-rose-600 font-bold text-base px-2 opacity-0 group-hover:opacity-100">✕</button>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-8 bg-white p-5 rounded-b-xl rounded-tl-xl border space-y-6 shadow-sm">
              
              {estadoBusqueda && <p className="text-xs text-slate-500 font-medium text-center animate-pulse">{estadoBusqueda}</p>}

              {!clienteEncontrado && !estadoBusqueda && (
                 <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                   <span className="text-5xl mb-4">🔍</span>
                   <p className="text-base font-bold text-slate-500">Seleccione un paciente del directorio</p>
                   <p className="text-xs mt-1">Utilice el buscador inteligente de la izquierda para localizar su historial clínico.</p>
                 </div>
              )}

              {clienteEncontrado && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                  <div><span className="text-[10px] font-bold text-slate-400 block">PACIENTE</span><p className="font-bold text-slate-800 text-sm">{clienteEncontrado?.nombres || ''}</p></div>
                  <div><span className="text-[10px] font-bold text-slate-400 block">DOCUMENTO</span><p className="font-medium text-slate-700 text-sm">{clienteEncontrado?.dni || ''}</p></div>
                  <div><span className="text-[10px] font-bold text-slate-400 block">CONTACTO</span><p className="text-xs text-slate-600">{clienteEncontrado?.telefono || 'Sin registro'}</p></div>
                </div>
              )}

              {clienteEncontrado && (
                <div className="mt-6">
                  <h3 className="text-xs font-extrabold text-slate-700 mb-3">HISTORIAL DE ÓRDENES PREVIAS</h3>
                  {(ordenesCliente || []).length === 0 ? <div className="text-center py-8 border-2 border-dashed rounded-xl text-slate-400 text-xs">Sin transacciones registradas.</div> : (
                    <div className="space-y-3">
                      {(ordenesCliente || []).map(o => (
                        <div key={o?.id || Math.random()} onClick={()=>setOrdenSeleccionada(o)} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-sky-500 transition-all">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2"><span className="bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded text-[10px]">{o?.numeroOrden || 'ORD'}</span><span className="text-xs text-slate-400">{o?.fechaOrden ? new Date(o.fechaOrden).toLocaleDateString() : ''}</span></div>
                            <p className="text-xs font-bold text-slate-800">{o?.montura || 'Servicio'} • <span className="text-slate-600 font-normal">{o?.tipoTrabajo || ''}</span></p>
                            <span className="text-[10px] text-slate-400 block">Atendido por: <strong className="text-slate-600">{o?.vendedor || 'Especialista'}</strong></span>
                          </div>
                          <div className="text-right flex md:flex-col justify-between w-full md:w-auto items-center md:items-end gap-2 border-t md:border-t-0 pt-2 md:pt-0">
                            <div className="flex items-center space-x-3"><span className="text-xs font-extrabold text-slate-800">Total: S/ {o?.total || 0}</span>{rolActual==='admin' && <button onClick={e=>eliminarOrdenRegistro(e,o?.id,o?.numeroOrden)} className="text-[10px] text-rose-500 border border-rose-200 px-2 py-0.5 rounded font-bold hover:bg-rose-50 transition-colors">Eliminar</button>}</div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${Number(o?.saldo)>0?'bg-rose-50 text-rose-700 border border-rose-100':'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>{Number(o?.saldo)>0?`Saldo: S/ ${o.saldo}`:'Liquidado'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL INSPECCIÓN ACTUALIZADO */}
        {ordenSeleccionada && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border flex flex-col max-h-[90vh]">
              <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><div><span className="text-[10px] bg-sky-500 text-white font-bold px-2 py-0.5 rounded uppercase">Receta de Archivo</span><h3 className="font-extrabold text-base mt-0.5">Expediente: {ordenSeleccionada?.numeroOrden || ''}</h3></div><button onClick={()=>setOrdenSeleccionada(null)} className="text-slate-400 hover:text-white font-bold text-lg px-2">&times;</button></div>
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4 border-b text-xs"><div><span className="text-slate-400 block font-bold text-[10px]">REGISTRO</span><p className="font-bold text-slate-700">{ordenSeleccionada?.fechaOrden ? new Date(ordenSeleccionada.fechaOrden).toLocaleString() : ''}</p></div><div><span className="text-slate-400 block font-bold text-[10px]">ATENDIÓ</span><p className="font-bold text-sky-700">{ordenSeleccionada?.vendedor || 'N/A'}</p></div><div><span className="text-slate-400 block font-bold text-[10px]">ENTREGA</span><p className="font-bold text-slate-700">{ordenSeleccionada?.fechaEntrega || 'Inmediata'}</p></div></div>
                
                <div>
                  <h4 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">REFRACCIÓN VISUAL</h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50 p-3">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 text-[10px] font-extrabold uppercase border-b border-slate-200"><th className="p-2 w-16">OJO</th><th className="p-2">ESFERA</th><th className="p-2">CILINDRO</th><th className="p-2">EJE</th></tr></thead>
                      <tbody className="text-xs text-slate-700 divide-y divide-slate-200">
                        <tr><td className="p-2 font-black text-sky-700">O.D.</td><td className="p-2 font-bold bg-white rounded">{ordenSeleccionada?.refraccion?.od?.esf||'-'}</td><td className="p-2 font-bold bg-white rounded">{ordenSeleccionada?.refraccion?.od?.cil||'-'}</td><td className="p-2 bg-white rounded">{ordenSeleccionada?.refraccion?.od?.eje||'-'}</td></tr>
                        <tr><td className="p-2 font-black text-sky-700">O.I.</td><td className="p-2 font-bold bg-white rounded">{ordenSeleccionada?.refraccion?.oi?.esf||'-'}</td><td className="p-2 font-bold bg-white rounded">{ordenSeleccionada?.refraccion?.oi?.cil||'-'}</td><td className="p-2 bg-white rounded">{ordenSeleccionada?.refraccion?.oi?.eje||'-'}</td></tr>
                      </tbody>
                    </table>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200 text-xs">
                      {ordenSeleccionada?.refraccion?.addCerca && <div><span className="text-[10px] text-slate-400 block font-bold">ADD CERCA</span><p className="font-bold text-slate-800">{ordenSeleccionada.refraccion.addCerca}</p></div>}
                      {ordenSeleccionada?.refraccion?.addIntermedia && <div><span className="text-[10px] text-slate-400 block font-bold">ADD INTERMEDIA</span><p className="font-bold text-slate-800">{ordenSeleccionada.refraccion.addIntermedia}</p></div>}
                      {ordenSeleccionada?.refraccion?.dipLejos && <div><span className="text-[10px] text-slate-400 block font-bold">DIP LEJOS</span><p className="font-bold text-slate-800">{ordenSeleccionada.refraccion.dipLejos}</p></div>}
                      {ordenSeleccionada?.refraccion?.dipCerca && <div><span className="text-[10px] text-slate-400 block font-bold">DIP CERCA</span><p className="font-bold text-slate-800">{ordenSeleccionada.refraccion.dipCerca}</p></div>}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">PRODUCTO</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border text-xs">
                    <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-slate-400 block font-bold">MONTURA</span><p className="font-bold text-slate-800">{ordenSeleccionada?.montura||'N/A'}</p></div>
                    <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-emerald-600 block font-bold">PRECIO M.</span><p className="font-bold text-emerald-700">S/ {ordenSeleccionada?.monturaPrecio||'0.00'}</p></div>
                    <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-slate-400 block font-bold">TIPO DE TRABAJO</span><p className="font-bold text-slate-800">{ordenSeleccionada?.tipoTrabajo||'N/A'}</p></div>
                    <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-emerald-600 block font-bold">PRECIO T.</span><p className="font-bold text-emerald-700">S/ {ordenSeleccionada?.tipoTrabajoPrecio||'0.00'}</p></div>
                    <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-slate-400 block font-bold">TRATADO</span><p className="font-bold text-slate-800">{ordenSeleccionada?.tratado||'N/A'}</p></div>
                  </div>
                </div>

                <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center text-sm"><div><span className="text-[10px] font-bold text-slate-500 block uppercase">CAJA</span><p className="font-extrabold text-slate-800">Total: S/ {ordenSeleccionada?.total || 0}</p></div><div className="text-right"><span className="text-[10px] font-bold text-slate-500 block uppercase">ESTADO</span><p className={`font-extrabold ${Number(ordenSeleccionada?.saldo)>0?'text-rose-600':'text-emerald-600'}`}>{Number(ordenSeleccionada?.saldo)>0?`Saldo: S/ ${ordenSeleccionada.saldo}`:'Cancelado al 100%'}</p></div></div>
              </div>
              <div className="p-4 border-t bg-slate-50 text-right"><button onClick={()=>setOrdenSeleccionada(null)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors">Cerrar</button></div>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full bg-slate-900 text-slate-500 text-center py-6 mt-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <p className="text-xs font-bold text-slate-300">Óptica MV</p>
          <p className="text-xs text-slate-400">📍 <span className="text-slate-300">Jr Huancavelica 319 - Lima</span></p>
          <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-800/80 max-w-xs mx-auto">© 2026 Todos los derechos reservados.</p>
          <p className="text-[11px] font-bold text-slate-400">Desarrollado por <span className="text-sky-500">Jonathan Saldaña</span></p>
        </div>
      </footer>
    </div>
  );
}