import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function App() {
  // Autenticación y Permisos
  const [token, setToken] = useState(localStorage.getItem('jwt_optica') || '');
  const [operadorActual, setOperadorActual] = useState(localStorage.getItem('user_optica') || 'Especialista');
  const [rolActual, setRolActual] = useState(localStorage.getItem('role_optica') || '');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [cargandoLogin, setCargandoLogin] = useState(false);

  // Navegación Modular
  const [tabActiva, setTabActiva] = useState('registro');
  const [dataVentas, setDataVentas] = useState(null);
  const [dataClientes, setDataClientes] = useState(null);

  // CAMPOS COMPLETOS DE LA ORDEN DE TRABAJO FÍSICA
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [total, setTotal] = useState('');
  const [aCuenta, setACuenta] = useState('');
  const [montura, setMontura] = useState('');
  const [tipoTrabajo, setTipoTrabajo] = useState('');
  const [tratado, setTratado] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  
  // Refracción Optométrica Lejos
  const [od, setOd] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [oi, setOi] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [cercaAdd, setCercaAdd] = useState('');
  const [cargandoVenta, setCargandoVenta] = useState(false);

  // Estados de Búsqueda y Directorio
  const [listaDirectorio, setListaDirectorio] = useState([]);
  const [cargandoDirectorio, setCargandoDirectorio] = useState(false);
  const [busquedaDni, setBusquedaDni] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [ordenesCliente, setOrdenesCliente] = useState([]);
  const [cargandoBusqueda, setCargandoBusqueda] = useState(false);
  const [estadoBusqueda, setEstadoBusqueda] = useState('');

  // Modal de Auditoría
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);

  // Alertas visuales
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorForm, setErrorForm] = useState('');

  // Cálculo financiero
  const saldoCalculado = (Number(total) || 0) - (Number(aCuenta) || 0);

  const fetchSeguro = async (endpoint, options = {}) => {
    const tokenActual = localStorage.getItem('jwt_optica') || token;
    const headers = { ...options.headers, 'x-optica-auth': `Bearer ${tokenActual}` };
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      try {
        const errData = await res.json();
        if (res.status === 403) throw new Error(errData.error);
      } catch(e) { if(e.message) throw e; }
      
      if (res.status === 401) {
        localStorage.removeItem('jwt_optica'); localStorage.removeItem('user_optica'); localStorage.removeItem('role_optica');
        setToken('');
        throw new Error("Sesión caducada por seguridad. Vuelva a ingresar.");
      }
    }
    return res;
  };

  const cargarDashboard = async () => {
    if (!localStorage.getItem('jwt_optica')) return;
    try {
      const res = await fetchSeguro('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        if (data.topVentas && data.topVentas.length > 0) {
          setDataVentas({ 
            labels: data.topVentas.map(v => v.numeroOrden), 
            datasets: [{ label: 'Monto (S/)', data: data.topVentas.map(v => Number(v.total) || 0), backgroundColor: '#0284c7' }] 
          });
        } else { setDataVentas(null); }

        if (data.topClientes && data.topClientes.length > 0) {
          setDataClientes({ 
            labels: data.topClientes.map(c => c.nombres?.split(' ')[0] || 'Cliente'), 
            datasets: [{ label: 'Órdenes', data: data.topClientes.map(c => Number(c.cantidadComprada) || 0), backgroundColor: '#059669' }] 
          });
        } else { setDataClientes(null); }
      }
    } catch (err) { console.error(err); }
  };

  const cargarDirectorioGlobal = async () => {
    if (!localStorage.getItem('jwt_optica')) return;
    setCargandoDirectorio(true);
    try {
      const res = await fetchSeguro('/api/clientes');
      if (res.ok) {
        const data = await res.json();
        setListaDirectorio(data.clientes || []);
      }
    } catch (err) { } finally { setCargandoDirectorio(false); }
  };

  useEffect(() => { 
    if (token) { 
      cargarDashboard(); 
      if (tabActiva === 'historial') cargarDirectorioGlobal(); 
    } 
  }, [token, tabActiva]);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin(''); setCargandoLogin(true);
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: usuario.trim(), password: password.trim() }) });
      const data = await res.json();
      if (res.ok) { 
        localStorage.setItem('jwt_optica', data.token); 
        localStorage.setItem('user_optica', data.usuario || 'Especialista');
        localStorage.setItem('role_optica', data.role || 'especialista');
        setToken(data.token); 
        setOperadorActual(data.usuario || 'Especialista');
        setRolActual(data.role || 'especialista');
        setTimeout(() => { cargarDashboard(); cargarDirectorioGlobal(); }, 100);
      } else setErrorLogin(data.error || 'Credenciales incorrectas');
    } catch (err) { setErrorLogin('Fallo de conexión con el servidor.'); } 
    finally { setCargandoLogin(false); }
  };

  const consultarExpediente = async (targetDni) => {
    if (!targetDni) return;
    setErrorForm(''); setMensajeExito(''); setEstadoBusqueda(''); setCargandoBusqueda(true); setClienteEncontrado(null); setOrdenesCliente([]);
    try {
      const res = await fetchSeguro(`/api/cliente?dni=${targetDni.trim()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cliente || (data.ordenes && data.ordenes.length > 0)) { 
          setClienteEncontrado(data.cliente); 
          setOrdenesCliente(data.ordenes || []); 
        } else { setEstadoBusqueda('No se localizaron transacciones para este documento.'); }
      }
    } catch (err) { setEstadoBusqueda(err.message); } finally { setCargandoBusqueda(false); }
  };

  // =========================================================================
  // RUTINA DE VACIADO: Purga total de las cajas de texto tras guardar con éxito
  // =========================================================================
  const registrarVenta = async (e) => {
    e.preventDefault(); setErrorForm(''); setMensajeExito(''); setCargandoVenta(true);
    if (!dni || !nombres) { setErrorForm('DNI y Nombres son obligatorios.'); setCargandoVenta(false); return; }
    
    const payload = { 
      dni: dni.trim(), nombres: nombres.trim(), direccion, telefono, montura, tipoTrabajo, tratado, fechaEntrega, 
      aCuenta: Number(aCuenta), saldo: saldoCalculado, total: Number(total), 
      refraccion: { od, oi, cercaAdd } 
    };

    try {
      const res = await fetchSeguro('/api/venta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        setMensajeExito(`¡Orden ${data.numeroOrden} procesada exitosamente por ${operadorActual}!`);
        
        // VACIADO INTEGRAL DE LAS 22 VARIABLES EN MEMORIA
        setDni(''); setNombres(''); setDireccion(''); setTelefono('');
        setTotal(''); setACuenta(''); setMontura(''); setTipoTrabajo(''); setTratado(''); setFechaEntrega('');
        setOd({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' }); 
        setOi({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' }); 
        setCercaAdd('');

        cargarDashboard(); 
        cargarDirectorioGlobal();
      } else setErrorForm(data.error || 'Fallo al procesar la venta.');
    } catch (err) { setErrorForm(err.message); } finally { setCargandoVenta(false); }
  };

  const purgarClienteCompleto = async (e, cid, nombre) => {
    e.stopPropagation();
    if (!window.confirm(`¿BORRADO DEFINITIVO DEL PACIENTE?\n\nSe eliminará de forma permanente a "${nombre}" y la totalidad de sus órdenes de la base de datos.`)) return;
    
    setErrorForm(''); setMensajeExito('');
    try {
      const res = await fetchSeguro(`/api/venta?id=${cid}`, { method: 'DELETE' });
      if (res.ok) {
        setMensajeExito(`Expediente de ${nombre} purgado por completo.`);
        setListaDirectorio(prev => prev.filter(c => `cli_${c.dni}` !== cid));
        if (clienteEncontrado && `cli_${clienteEncontrado.dni}` === cid) {
          setClienteEncontrado(null); setOrdenesCliente([]); setBusquedaDni('');
        }
        cargarDashboard();
      } else {
        const errData = await res.json();
        setErrorForm(errData.error || 'No se pudo purgar el registro en Cosmos DB.');
      }
    } catch (err) { setErrorForm(err.message); }
  };

  const eliminarOrdenRegistro = async (e, ordId, ordNum) => {
    e.stopPropagation(); 
    setErrorForm(''); setMensajeExito('');
    if (!window.confirm(`¿Confirmas la eliminación definitiva de la orden ${ordNum}?`)) return;
    try {
      const res = await fetchSeguro(`/api/venta?id=${ordId}`, { method: 'DELETE' });
      if (res.ok) {
        setMensajeExito(`Orden ${ordNum} eliminada exitosamente.`);
        setOrdenesCliente(prev => prev.filter(o => o.id !== ordId));
        cargarDirectorioGlobal();
        cargarDashboard();
      } else {
        const errData = await res.json();
        setErrorForm(errData.error || 'No se pudo purgar el registro.');
      }
    } catch (err) { setErrorForm(err.message); }
  };

  const handleUpdateOd = (field, val) => setOd(prev => ({ ...prev, [field]: val }));
  const handleUpdateOi = (field, val) => setOi(prev => ({ ...prev, [field]: val }));

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 border border-slate-100">
        <div className="text-center mb-6"><h2 className="text-2xl font-extrabold text-slate-800">Óptica MV - Portal Clínico</h2><p className="text-xs text-slate-500 mt-1">Acceso Seguro Administrado</p></div>
        {errorLogin && <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-3 rounded text-xs mb-4 font-medium">{errorLogin}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="text-xs font-bold text-slate-600 block mb-1">CUENTA ASIGNADA</label><input type="text" required value={usuario} onChange={(e)=>setUsuario(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500" placeholder="Magaly / Flor / Admin" /></div>
          <div><label className="text-xs font-bold text-slate-600 block mb-1">CONTRASEÑA</label><input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500" placeholder="••••••••••••" /></div>
          <button type="submit" disabled={cargandoLogin} className="w-full bg-sky-600 hover:bg-sky-700 text-white p-3 rounded-lg font-bold text-sm shadow flex items-center justify-center transition-all disabled:opacity-50">{cargandoLogin ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : 'Iniciar Sesión'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <span className="bg-sky-600 text-white font-bold px-2.5 py-1 rounded text-xs animate-pulse">Óptica MV</span>
          <h1 className="font-extrabold text-slate-800 text-base md:text-lg">Sistema de gestión optométrica</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden md:block text-right"><span className="text-[10px] font-bold text-slate-400 block uppercase">EN TURNO ({rolActual})</span><span className="text-xs font-extrabold text-sky-700">{operadorActual}</span></div>
          <button onClick={()=>{localStorage.removeItem('jwt_optica'); localStorage.removeItem('user_optica'); localStorage.removeItem('role_optica'); setToken('');}} className="text-xs text-rose-600 font-bold px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded transition-colors">Desconectar</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6 flex-grow w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl border shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 text-center mb-2 uppercase">Métricas de Ingreso (S/)</h2>
            <div className="h-40">{dataVentas ? <Bar data={dataVentas} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-lg">A la espera de transacciones financieras...</div>}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 text-center mb-2 uppercase">Directorio Activo (Órdenes)</h2>
            <div className="h-40">{dataClientes ? <Bar data={dataClientes} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-lg">A la espera de historiales de pacientes...</div>}</div>
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
          <button onClick={() => {setTabActiva('registro'); setErrorForm(''); setMensajeExito('');}} className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${tabActiva === 'registro' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Módulo 1: Registrar Venta</button>
          <button onClick={() => {setTabActiva('historial'); setErrorForm(''); setMensajeExito('');}} className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${tabActiva === 'historial' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Módulo 2: Directorio e Historial</button>
        </div>

        {mensajeExito && <div className="bg-emerald-50 border-l-4 border-emerald-600 text-emerald-800 p-4 rounded-r font-medium text-sm shadow-sm animate-fade-in">{mensajeExito}</div>}
        {errorForm && <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-4 rounded-r font-medium text-sm shadow-sm animate-fade-in">{errorForm}</div>}

        {tabActiva === 'registro' && (
          <form onSubmit={registrarVenta} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-5 rounded-b-xl rounded-tr-xl border space-y-4 shadow-sm self-start">
              <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2">FICHA DEL PACIENTE</h2>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">DNI *</label><input type="text" maxLength="8" required value={dni} onChange={(e)=>setDni(e.target.value)} placeholder="8 dígitos" className="w-full p-2 border rounded font-bold text-sm outline-none focus:border-sky-600" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">NOMBRE COMPLETO *</label><input type="text" required value={nombres} onChange={(e)=>setNombres(e.target.value)} placeholder="Según orden física" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">DIRECCIÓN</label><input type="text" value={direccion} onChange={(e)=>setDireccion(e.target.value)} placeholder="Dirección del paciente" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TELÉFONO</label><input type="text" value={telefono} onChange={(e)=>setTelefono(e.target.value)} placeholder="Teléfono de contacto" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" /></div>
            </div>

            <div className="lg:col-span-8 bg-white p-5 rounded-b-xl rounded-tl-xl border space-y-6 shadow-sm">
              <div>
                <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">REFRACCIÓN LEJOS (Según talonario)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead><tr className="bg-slate-100 text-slate-600 text-[10px] font-bold border-b"><th className="p-2">OJO</th><th className="p-2">R.P.</th><th className="p-2">ESF</th><th className="p-2">CIL.</th><th className="p-2">EJE</th><th className="p-2">DIP</th><th className="p-2">ALT</th></tr></thead>
                    <tbody className="text-xs text-slate-700 divide-y">
                      <tr><td className="p-2 font-bold text-sky-700">O.D.</td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.rp} onChange={(e)=>handleUpdateOd('rp', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center font-bold" value={od.esf} onChange={(e)=>handleUpdateOd('esf', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center font-bold" value={od.cil} onChange={(e)=>handleUpdateOd('cil', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.eje} onChange={(e)=>handleUpdateOd('eje', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.dip} onChange={(e)=>handleUpdateOd('dip', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.alt} onChange={(e)=>handleUpdateOd('alt', e.target.value)} /></td></tr>
                      <tr><td className="p-2 font-bold text-sky-700">O.I.</td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.rp} onChange={(e)=>handleUpdateOi('rp', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center font-bold" value={oi.esf} onChange={(e)=>handleUpdateOi('esf', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center font-bold" value={oi.cil} onChange={(e)=>handleUpdateOi('cil', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.eje} onChange={(e)=>handleUpdateOi('eje', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.dip} onChange={(e)=>handleUpdateOi('dip', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.alt} onChange={(e)=>handleUpdateOi('alt', e.target.value)} /></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 max-w-xs"><label className="text-[10px] font-bold text-slate-500 block mb-1">CERCA ADD.</label><input type="text" value={cercaAdd} onChange={(e)=>setCercaAdd(e.target.value)} placeholder="Ej. +2.00" className="w-full p-1.5 border rounded text-xs outline-none focus:border-sky-600" /></div>
              </div>

              <div>
                <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">ESPECIFICACIONES DEL PRODUCTO</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">MONTURA</label><input type="text" value={montura} onChange={(e)=>setMontura(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div><div><label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO TRABAJO</label><input type="text" value={tipoTrabajo} onChange={(e)=>setTipoTrabajo(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div><div><label className="text-[10px] font-bold text-slate-500 block mb-1">TRATADO</label><input type="text" value={tratado} onChange={(e)=>setTratado(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border">
                <h3 className="text-[10px] font-extrabold text-slate-400 mb-3 uppercase">Estructura de Cobro</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">TOTAL S/</label><input type="number" required value={total} onChange={(e)=>setTotal(e.target.value)} className="w-full p-2 border rounded font-bold text-sm outline-none focus:border-sky-600 bg-white" /></div><div><label className="text-[10px] font-bold text-slate-600 block mb-1">A CTA. S/</label><input type="number" required value={aCuenta} onChange={(e)=>setACuenta(e.target.value)} className="w-full p-2 border rounded font-bold text-emerald-600 text-sm outline-none focus:border-sky-600 bg-white" /></div><div><label className="text-[10px] font-bold text-slate-600 block mb-1">SALDO</label><div className="w-full p-2 border rounded bg-slate-200/60 font-bold text-rose-600 text-sm">{saldoCalculado}</div></div><div><label className="text-[10px] font-bold text-slate-600 block mb-1">FECHA DE ENTREGA</label><input type="date" value={fechaEntrega} onChange={(e)=>setFechaEntrega(e.target.value)} className="w-full p-2 border rounded text-xs text-slate-700 outline-none focus:border-sky-600 bg-white" /></div>
                </div>
              </div>

              <button type="submit" disabled={cargandoVenta} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl font-bold text-sm shadow flex items-center justify-center transition-all disabled:opacity-50">{cargandoVenta ? 'Sincronizando expediente...' : 'Confirmar Transacción e Imprimir Orden'}</button>
            </div>
          </form>
        )}

        {tabActiva === 'historial' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-4 rounded-b-xl rounded-tr-xl border shadow-sm self-start space-y-4 sticky top-24">
              <div className="flex flex-col space-y-2 border-b pb-3"><h3 className="text-xs font-extrabold text-slate-700">DIRECTORIO GLOBAL</h3><button onClick={cargarDirectorioGlobal} disabled={cargandoDirectorio} className="w-full bg-slate-100 hover:bg-sky-50 text-sky-700 border border-slate-200 hover:border-sky-200 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center transition-all shadow-sm disabled:opacity-50">{cargandoDirectorio ? <span className="animate-spin h-3.5 w-3.5 border-b-2 border-sky-700 rounded-full mr-2"></span> : null}{cargandoDirectorio ? 'Sincronizando...' : '🔄 Sincronizar Directorio'}</button></div>
              {cargandoDirectorio ? <div className="text-center py-8 text-xs text-slate-400 animate-pulse">Cargando base de datos...</div> : listaDirectorio.length === 0 ? <div className="text-center py-8 text-xs text-slate-400 border border-dashed rounded-lg">Directorio vacío</div> : (
                <div className="divide-y max-h-[450px] overflow-y-auto pr-1">
                  {listaDirectorio.map(cli => (
                    <div key={cli.dni} onClick={() => { setBusquedaDni(cli.dni); consultarExpediente(cli.dni); }} className={`p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors flex justify-between items-center group ${busquedaDni === cli.dni ? 'bg-sky-50 border-l-4 border-sky-600' : ''}`}>
                      <div><p className="text-xs font-bold text-slate-800">{cli.nombres}</p><span className="text-[10px] text-slate-500 font-medium block mt-0.5">DNI: {cli.dni}</span></div>
                      {rolActual === 'admin' && <button onClick={(e) => purgarClienteCompleto(e, `cli_${cli.dni}`, cli.nombres)} title="Eliminar paciente y todas sus órdenes" className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 font-extrabold text-base px-2 py-0.5 rounded hover:bg-rose-50 transition-all">✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-8 bg-white p-5 rounded-b-xl rounded-tl-xl border space-y-6 shadow-sm">
              <form onSubmit={(e)=>{e.preventDefault(); consultarExpediente(busquedaDni);}} className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 block">AUDITORÍA HISTÓRICA POR DNI</label>
                <div className="flex space-x-3"><input type="text" maxLength="8" required value={busquedaDni} onChange={(e)=>setBusquedaDni(e.target.value)} placeholder="Ingrese número de documento..." className="flex-1 p-2.5 border rounded-lg text-sm outline-none focus:border-sky-600" /><button type="submit" disabled={cargandoBusqueda} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50">{cargandoBusqueda ? 'Buscando...' : 'Auditar'}</button></div>
                {estadoBusqueda && <p className="text-xs text-slate-500 font-medium mt-1">{estadoBusqueda}</p>}
              </form>

              {clienteEncontrado && (
                <div className="border-t pt-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border animate-fade-in">
                  <div><span className="text-[10px] font-bold text-slate-400 block">PACIENTE LOCALIZADO</span><p className="font-bold text-slate-800 text-sm">{clienteEncontrado.nombres}</p></div><div><span className="text-[10px] font-bold text-slate-400 block">DOCUMENTO</span><p className="font-medium text-slate-700 text-sm">{clienteEncontrado.dni}</p></div><div><span className="text-[10px] font-bold text-slate-400 block">CONTACTO</span><p className="text-xs text-slate-600">{clienteEncontrado.telefono || 'Sin registro'}</p></div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-extrabold text-slate-700 mb-3">HISTORIAL DE ÓRDENES PREVIAS (Haga clic para ver receta completa)</h3>
                {cargandoBusqueda ? <div className="text-center py-8 text-xs text-slate-400 animate-pulse">Consultando BD...</div> : ordenesCliente.length === 0 ? <div className="text-center py-8 border-2 border-dashed rounded-xl text-slate-400 text-xs font-medium">{clienteEncontrado ? 'Sin transacciones en el expediente.' : 'Seleccione un paciente de la lista.'}</div> : (
                  <div className="space-y-3">
                    {ordenesCliente.map((ord) => (
                      <div key={ord.id} onClick={() => setOrdenSeleccionada(ord)} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative group border-l-4 border-l-sky-500 hover:bg-slate-50/50">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2"><span className="bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded text-[10px] border border-sky-100">{ord.numeroOrden}</span><span className="text-xs text-slate-400 font-medium">{new Date(ord.fechaOrden).toLocaleDateString()}</span></div>
                          <p className="text-xs font-bold text-slate-800">{ord.montura || 'Cristal / Servicio'} • <span className="text-slate-600 font-normal">{ord.tipoTrabajo}</span></p>
                          <span className="text-[10px] text-slate-400 block">Atendido por: <strong className="text-slate-600">{ord.vendedor || 'Especialista'}</strong></span>
                        </div>
                        <div className="text-right flex md:flex-col justify-between w-full md:w-auto items-center md:items-end border-t md:border-t-0 pt-2 md:pt-0 gap-2">
                          <div className="flex items-center space-x-3"><span className="text-xs font-extrabold text-slate-800">Total: S/ {ord.total}</span>{rolActual === 'admin' && <button onClick={(e) => eliminarOrdenRegistro(e, ord.id, ord.numeroOrden)} className="text-[10px] text-rose-500 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-2 py-1 rounded transition-colors font-bold">Eliminar</button>}</div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ord.saldo > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>{ord.saldo > 0 ? `Saldo: S/ ${ord.saldo}` : 'Liquidado'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {ordenSeleccionada && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><div><span className="text-[10px] bg-sky-500 text-white font-bold px-2 py-0.5 rounded uppercase">Receta de Archivo</span><h3 className="font-extrabold text-base mt-0.5">Expediente: {ordenSeleccionada.numeroOrden}</h3></div><button onClick={() => setOrdenSeleccionada(null)} className="text-slate-400 hover:text-white font-bold text-lg px-2 py-1">&times;</button></div>
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4 border-b text-xs"><div><span className="text-slate-400 block font-bold text-[10px]">FECHA REGISTRO</span><p className="font-bold text-slate-700">{new Date(ordenSeleccionada.fechaOrden).toLocaleString()}</p></div><div><span className="text-slate-400 block font-bold text-[10px]">ESPECIALISTA</span><p className="font-bold text-sky-700">{ordenSeleccionada.vendedor || 'No especificado'}</p></div><div><span className="text-slate-400 block font-bold text-[10px]">FECHA DE ENTREGA</span><p className="font-bold text-slate-700">{ordenSeleccionada.fechaEntrega || 'Inmediata'}</p></div></div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">REFRACCIÓN VISUAL REGISTRADA</h4>
                  <table className="w-full text-left border-collapse min-w-[450px]">
                    <thead><tr className="bg-slate-100 text-slate-500 text-[10px] font-bold border-b"><th className="p-2">OJO</th><th className="p-2">R.P.</th><th className="p-2">ESF</th><th className="p-2">CIL.</th><th className="p-2">EJE</th><th className="p-2">DIP</th><th className="p-2">ALT</th></tr></thead>
                    <tbody className="text-xs text-slate-700 divide-y">
                      <tr><td className="p-2 font-bold text-sky-700">O.D.</td><td className="p-2 font-medium">{ordenSeleccionada.refraccion?.od?.rp || '-'}</td><td className="p-2 font-bold">{ordenSeleccionada.refraccion?.od?.esf || '-'}</td><td className="p-2 font-bold">{ordenSeleccionada.refraccion?.od?.cil || '-'}</td><td className="p-2 font-medium">{ordenSeleccionada.refraccion?.od?.eje || '-'}</td><td className="p-2">{ordenSeleccionada.refraccion?.od?.dip || '-'}</td><td className="p-2">{ordenSeleccionada.refraccion?.od?.alt || '-'}</td></tr>
                      <tr><td className="p-2 font-bold text-sky-700">O.I.</td><td className="p-2 font-medium">{ordenSeleccionada.refraccion?.oi?.rp || '-'}</td><td className="p-2 font-bold">{ordenSeleccionada.refraccion?.oi?.esf || '-'}</td><td className="p-2 font-bold">{ordenSeleccionada.refraccion?.oi?.cil || '-'}</td><td className="p-2 font-medium">{ordenSeleccionada.refraccion?.oi?.eje || '-'}</td><td className="p-2">{ordenSeleccionada.refraccion?.oi?.dip || '-'}</td><td className="p-2">{ordenSeleccionada.refraccion?.oi?.alt || '-'}</td></tr>
                    </tbody>
                  </table>
                  {ordenSeleccionada.refraccion?.cercaAdd && <p className="text-xs mt-2 text-slate-600"><strong className="text-slate-800">CERCA ADD:</strong> {ordenSeleccionada.refraccion.cercaAdd}</p>}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">ESPECIFICACIONES DE PRODUCTO</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border text-xs"><div><span className="text-[10px] text-slate-400 block font-bold">MONTURA</span><p className="font-bold text-slate-800">{ordenSeleccionada.montura || 'Ninguna'}</p></div><div><span className="text-[10px] text-slate-400 block font-bold">TIPO TRABAJO</span><p className="font-bold text-slate-800">{ordenSeleccionada.tipoTrabajo || 'Estándar'}</p></div><div><span className="text-[10px] text-slate-400 block font-bold">TRATADO</span><p className="font-bold text-slate-800">{ordenSeleccionada.tratado || 'Ninguno'}</p></div></div>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center text-sm"><div><span className="text-[10px] font-bold text-slate-500 block uppercase">Liquidación en Caja</span><p className="font-extrabold text-slate-800">Total S/: {ordenSeleccionada.total}</p></div><div className="text-right"><span className="text-[10px] font-bold text-slate-500 block uppercase">Estado Financiero</span><p className={`font-extrabold ${ordenSeleccionada.saldo > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{ordenSeleccionada.saldo > 0 ? `Saldo Pendiente: S/ ${ordenSeleccionada.saldo}` : 'Cancelado al 100%'}</p></div></div>
              </div>
              <div className="p-4 border-t bg-slate-50 text-right sticky bottom-0"><button onClick={() => setOrdenSeleccionada(null)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors">Cerrar Inspección</button></div>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full bg-slate-900 text-slate-500 text-center py-6 mt-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <p className="text-xs font-bold text-slate-300 tracking-wide">Óptica MV</p>
          <p className="text-xs text-slate-400">📍 <span className="text-slate-300">Jr Huancavelica 319 - Lima</span></p>
          <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-800/80 max-w-xs mx-auto">© 2026 Todos los derechos reservados.</p>
          <p className="text-[11px] font-bold text-slate-400">Desarrollado por <span className="text-sky-500">Jonathan Saldaña</span></p>
        </div>
      </footer>
    </div>
  );
}