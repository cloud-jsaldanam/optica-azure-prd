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

  // Navegación
  const [tabActiva, setTabActiva] = useState('registro');
  const [tabGraficoSecundario, setTabGraficoSecundario] = useState('mensual'); // 'mensual' o 'diario'

  // Estados de Gráficas
  const [dataTopVentas, setDataTopVentas] = useState(null);
  const [dataMensual, setDataMensual] = useState(null);
  const [dataDiaria, setDataDiaria] = useState(null);

  // CAMPOS COMPLETOS DE LA ORDEN DE TRABAJO (Auto-vaciado habilitado)
  const [dni, setDni] = useState(''); const [nombres, setNombres] = useState(''); const [direccion, setDireccion] = useState(''); const [telefono, setTelefono] = useState(''); const [total, setTotal] = useState(''); const [aCuenta, setACuenta] = useState(''); const [montura, setMontura] = useState(''); const [tipoTrabajo, setTipoTrabajo] = useState(''); const [tratado, setTratado] = useState(''); const [fechaEntrega, setFechaEntrega] = useState(''); const [od, setOd] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' }); const [oi, setOi] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' }); const [cercaAdd, setCercaAdd] = useState(''); const [cargandoVenta, setCargandoVenta] = useState(false);

  // Estados de Búsqueda
  const [listaDirectorio, setListaDirectorio] = useState([]);
  const [busquedaDni, setBusquedaDni] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [ordenesCliente, setOrdenesCliente] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const saldoCalculado = (Number(total) || 0) - (Number(aCuenta) || 0);

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
        
        // 1. Gráfico TOP VENTAS (Detallado)
        if (d.topVentas) setDataTopVentas({ labels: d.topVentas.map(v => v.label), datasets: [{ label: 'S/', data: d.topVentas.map(v => v.total), backgroundColor: '#0284c7' }] });
        
        // 2. Gráfico ANALÍTICA MENSUAL (Historial S/)
        if (d.analiticaMensual) setDataMensual({ labels: d.analiticaMensual.map(m => m.mes), datasets: [{ label: 'Ventas Totales (S/)', data: d.analiticaMensual.map(m => m.total), backgroundColor: '#059669' }] });

        // 3. Gráfico ANALÍTICA DIARIA (Flujo Órdenes)
        if (d.analiticaDiaria) setDataDiaria({ labels: d.analiticaDiaria.map(d => d.dia), datasets: [{ label: 'Cantidad Órdenes', data: d.analiticaDiaria.map(d => d.cantidad), backgroundColor: '#f97316' }] });

      }
    } catch (e) {}
  };

  const cargarDirectorio = async () => {
    try {
      const res = await fetchSeguro('/api/clientes');
      if (res.ok) setListaDirectorio((await res.json()).clientes || []);
    } catch (e) {}
  };

  useEffect(() => { if (token) { cargarDashboard(); cargarDirectorio(); } }, [token, tabActiva]);

  const handleLogin = async (e) => {
    e.preventDefault(); setCargandoLogin(true);
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, password }) });
    if (res.ok) {
      const d = await res.json();
      localStorage.setItem('jwt_optica', d.token); localStorage.setItem('user_optica', d.usuario); localStorage.setItem('role_optica', d.role);
      setToken(d.token); setOperadorActual(d.usuario); setRolActual(d.role);
    } else setErrorLogin("Error de acceso");
    setCargandoLogin(false);
  };

  const purgarClienteCompleto = async (e, cid, nombre) => {
    e.stopPropagation();
    if (!window.confirm(`¿BORRADO TOTAL? Se eliminará a ${nombre} y TODO su historial de la base de datos física.`)) return;
    const res = await fetchSeguro(`/api/venta?id=${cid}`, { method: 'DELETE' });
    if (res.ok) {
      setMensajeExito("Limpieza total completada.");
      setListaDirectorio(prev => prev.filter(c => `cli_${c.dni}` !== cid));
      setClienteEncontrado(null); setOrdenesCliente([]); setBusquedaDni('');
      cargarDashboard();
    }
  };

  // REGISTRO DE VENTA CON AUTO-VACIADO INTEGRAL
  const registrarVenta = async (e) => {
    e.preventDefault(); setCargandoVenta(true);
    const payload = { dni, nombres, direccion, telefono, montura, tipoTrabajo, tratado, fechaEntrega, aCuenta, saldo: saldoCalculado, total, refraccion: { od, oi, cercaAdd } };
    const res = await fetchSeguro('/api/venta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { 
      setMensajeExito("Generado con éxito."); 
      // AUTO-VACIADO DE LAS 22 VARIABLES
      setDni(''); setNombres(''); setDireccion(''); setTelefono(''); setTotal(''); setACuenta(''); setMontura(''); setTipoTrabajo(''); setTratado(''); setFechaEntrega('');
      setOd({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' }); setOi({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' }); setCercaAdd('');
      cargarDashboard(); cargarDirectorio(); 
    }
    setCargandoVenta(false);
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Óptica MV</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Usuario" className="w-full p-3 border rounded-xl" value={usuario} onChange={e=>setUsuario(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full p-3 border rounded-xl" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="w-full bg-sky-600 text-white p-3 rounded-xl font-bold">Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-2"><span className="bg-sky-600 text-white font-bold px-2 py-1 rounded">Óptica MV</span><h1 className="font-bold text-slate-700">Sistema de gestión optométrica</h1></div>
        <div className="flex items-center space-x-4"><span className="text-xs font-bold text-sky-700">{operadorActual} ({rolActual})</span><button onClick={()=>{localStorage.clear(); setToken('');}} className="text-xs text-rose-600 font-bold border border-rose-200 px-3 py-1 rounded-lg">Salir</button></div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-grow">
        {/* ==========================================
            SECCIÓN DE GRÁFICAS REDISEÑADA
            ========================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Métrica de Ingreso (S/) - Detallada con Nombres */}
          <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col">
            <h2 className="text-xs font-bold text-slate-400 mb-2 uppercase">Recientes (S/) | Orden + Paciente</h2>
            <div className="h-44">{dataTopVentas && <Bar data={dataTopVentas} options={{maintainAspectRatio:false, plugins:{legend:{display:false}}}} />}</div>
          </div>
          
          {/* 2. Analítica de Crecimiento y Flujo - Modular con pestañas */}
          <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase">Analítica de Ventas</h2>
              <div className="flex bg-slate-100 rounded-lg p-0.5 border text-[10px]">
                <button onClick={()=>setTabGraficoSecundario('mensual')} className={`px-3 py-1 rounded-md font-bold ${tabGraficoSecundario==='mensual'?'bg-white text-sky-700 shadow':'text-slate-500'}`}>Mensual (S/)</button>
                <button onClick={()=>setTabGraficoSecundario('diario')} className={`px-3 py-1 rounded-md font-bold ${tabGraficoSecundario==='diario'?'bg-white text-sky-700 shadow':'text-slate-500'}`}>Día de Semana (#)</button>
              </div>
            </div>
            <div className="h-44">
              {tabGraficoSecundario === 'mensual' && dataMensual && <Bar data={dataMensual} options={{maintainAspectRatio:false, plugins:{legend:{display:false}}}} />}
              {tabGraficoSecundario === 'diario' && dataDiaria && <Bar data={dataDiaria} options={{maintainAspectRatio:false, plugins:{legend:{display:false}}}} />}
            </div>
          </div>
        </div>

        <div className="flex bg-white rounded-xl p-1 border shadow-sm mb-4">
          <button onClick={()=>setTabActiva('registro')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tabActiva==='registro'?'bg-sky-600 text-white':'text-slate-400'}`}>Módulo 1: Registrar Venta</button>
          <button onClick={()=>setTabActiva('historial')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tabActiva==='historial'?'bg-sky-600 text-white':'text-slate-400'}`}>Módulo 2: Auditoría</button>
        </div>

        {mensajeExito && <div className="bg-emerald-500 text-white p-3 rounded-xl text-center font-bold text-sm animate-pulse">{mensajeExito}</div>}

        {tabActiva === 'registro' && (
          <form onSubmit={registrarVenta} className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white p-6 rounded-2xl border shadow-sm">
             <div className="md:col-span-4 space-y-4">
                <h3 className="font-bold border-b pb-2">Paciente</h3>
                <input type="text" placeholder="DNI *" required maxLength={8} className="w-full p-2 border rounded" value={dni} onChange={e=>setDni(e.target.value)} />
                <input type="text" placeholder="Nombre completo *" required className="w-full p-2 border rounded" value={nombres} onChange={e=>setNombres(e.target.value)} />
                <input type="text" placeholder="Dirección" className="w-full p-2 border rounded" value={direccion} onChange={e=>setDireccion(e.target.value)} />
                <input type="text" placeholder="Teléfono" className="w-full p-2 border rounded" value={telefono} onChange={e=>setTelefono(e.target.value)} />
             </div>
             <div className="md:col-span-8 space-y-4">
                <h3 className="font-bold border-b pb-2">Venta</h3>
                <input type="number" placeholder="Total S/ *" required className="w-full p-2 border rounded" value={total} onChange={e=>setTotal(e.target.value)} />
                <input type="number" placeholder="A Cuenta S/ *" required className="w-full p-2 border rounded" value={aCuenta} onChange={e=>setACuenta(e.target.value)} />
                <div className="text-sm">Saldo: <span className="font-bold text-rose-600">S/ {saldoCalculado}</span></div>
                <button className="w-full bg-emerald-600 text-white p-4 rounded-xl font-bold mt-4 shadow-lg">{cargandoVenta ? 'Guardando...' : 'Guardar Transacción e Imprimir'}</button>
             </div>
          </form>
        )}

        {tabActiva === 'historial' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 bg-white p-4 rounded-2xl border shadow-sm sticky top-24 self-start">
              <h3 className="font-bold mb-4 flex justify-between">Directorio <button onClick={cargarDirectorio} className="text-sky-600 text-xs">Refrescar</button></h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {listaDirectorio.map(c => (
                  <div key={c.dni} onClick={()=> {setBusquedaDni(c.dni); fetchSeguro(`/api/cliente?dni=${c.dni}`).then(r=>r.json()).then(d=>{setClienteEncontrado(d.cliente); setOrdenesCliente(d.ordenes);});}} className={`p-3 rounded-xl hover:bg-sky-50 cursor-pointer flex justify-between items-center group ${busquedaDni===c.dni?'bg-sky-100 border-l-4 border-sky-600': 'bg-slate-50'}`}>
                    <div><p className="text-xs font-bold">{c.nombres}</p><p className="text-[10px] text-slate-500">{c.dni}</p></div>
                    {rolActual === 'admin' && <button onClick={(e)=>purgarClienteCompleto(e, `cli_${c.dni}`, c.nombres)} className="text-rose-500 opacity-0 group-hover:opacity-100 font-bold text-lg px-2">×</button>}
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-8 space-y-4">
                {ordenesCliente.map(o => (
                  <div key={o.id} onClick={()=>setOrdenSeleccionada(o)} className="bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow">
                    <div><span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded font-bold">{o.numeroOrden}</span><p className="text-sm font-bold mt-1">S/ {o.total}</p></div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">{new Date(o.fechaOrden).toLocaleDateString()}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${o.saldo>0?'bg-rose-100 text-rose-700':'bg-emerald-100 text-emerald-700'}`}>{o.saldo>0?'Pagar':'Liquidado'}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {ordenSeleccionada && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border flex flex-col max-h-[90vh]">
              <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><div><h3 className="font-bold text-base">Orden: {ordenSeleccionada.numeroOrden}</h3></div><button onClick={() => setOrdenSeleccionada(null)} className="text-slate-400 font-bold text-lg px-2 py-1">&times;</button></div>
              <div className="p-6 overflow-y-auto flex-1"><p>Desglose completo de refracción y caja de la orden {ordenSeleccionada.numeroOrden}</p></div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-white p-8 mt-12">
        <div className="max-w-7xl mx-auto text-center space-y-2">
          <p className="font-bold text-sky-400">Óptica MV</p>
          <p className="text-sm text-slate-400">📍 Jr Huancavelica 319 - Lima</p>
          <p className="text-xs text-slate-500 pt-4 border-t border-slate-800">Desarrollado por <span className="text-white font-bold">Jonathan Saldaña</span></p>
        </div>
      </footer>
    </div>
  );
}