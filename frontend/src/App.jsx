import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_optica') || '');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  const [tabActiva, setTabActiva] = useState('registro');

  const [dataVentas, setDataVentas] = useState(null);
  const [dataClientes, setDataClientes] = useState(null);

  // Formulario Módulo 1
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

  const [od, setOd] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [oi, setOi] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [cercaAdd, setCercaAdd] = useState('');

  // Buscador Módulo 2
  const [busquedaDni, setBusquedaDni] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [ordenesCliente, setOrdenesCliente] = useState([]);
  const [estadoBusqueda, setEstadoBusqueda] = useState('');

  const [mensajeExito, setMensajeExito] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const saldoCalculado = (Number(total) || 0) - (Number(aCuenta) || 0);

  // Wrapper de peticiones para manejar expiración de token de forma centralizada
  const fetchSeguro = async (endpoint, options = {}) => {
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      throw new Error("Sesión expirada. Por favor, inicie sesión nuevamente.");
    }
    return res;
  };

  const cargarDashboard = async () => {
    if (!token) return;
    try {
      const res = await fetchSeguro('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        if (data.topVentas?.length) {
          setDataVentas({
            labels: data.topVentas.map(v => v.numeroOrden),
            datasets: [{ label: 'Monto (S/)', data: data.topVentas.map(v => v.total), backgroundColor: '#0284c7' }]
          });
        }
        if (data.topClientes?.length) {
          setDataClientes({
            labels: data.topClientes.map(c => c.nombres?.split(' ')[0] || 'Cliente'),
            datasets: [{ label: 'Órdenes', data: data.topClientes.map(c => c.cantidadComprada), backgroundColor: '#059669' }]
          });
        }
      }
    } catch (err) { /* Manejado por fetchSeguro */ }
  };

  useEffect(() => { if (token) cargarDashboard(); }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.trim(), password: password.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('jwt_optica', data.token);
        setToken(data.token);
        setErrorForm(''); // Limpiamos errores previos en UI
      } else { setErrorLogin(data.error || 'Credenciales erróneas'); }
    } catch (err) { setErrorLogin('Fallo de red al conectar con el servidor.'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_optica');
    setToken('');
    setDataVentas(null); setDataClientes(null);
  };

  const autoBuscarRegistro = async (numeroDni) => {
    if (numeroDni.length !== 8) return;
    try {
      const res = await fetchSeguro(`/api/cliente?dni=${numeroDni}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cliente) {
          setNombres(data.cliente.nombres || '');
          setDireccion(data.cliente.direccion || '');
          setTelefono(data.cliente.telefono || '');
          setMensajeExito(`Autocompletado: Datos recuperados de ${data.cliente.nombres}`);
          setTimeout(() => setMensajeExito(''), 3000);
        }
      }
    } catch (err) { /* Silencioso para no interrumpir el flujo de escritura */ }
  };

  const ejecutarBusquedaManual = async (e) => {
    e.preventDefault();
    setErrorForm(''); setMensajeExito('');
    setEstadoBusqueda('Consultando base de datos...'); 
    setClienteEncontrado(null); setOrdenesCliente([]);
    try {
      const res = await fetchSeguro(`/api/cliente?dni=${busquedaDni.trim()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cliente || data.ordenes?.length) {
          setClienteEncontrado(data.cliente);
          setOrdenesCliente(data.ordenes || []);
          setEstadoBusqueda('');
        } else {
          setEstadoBusqueda('Búsqueda completada: No existen historiales para este DNI.');
        }
      }
    } catch (err) {
      setEstadoBusqueda(err.message || 'Error de conexión al consultar el expediente.');
    }
  };

  const registrarVenta = async (e) => {
    e.preventDefault(); setErrorForm(''); setMensajeExito('');
    if (!dni || !nombres) { setErrorForm('Los campos DNI y Nombres son obligatorios.'); return; }
    
    const payload = {
      dni: dni.trim(), nombres: nombres.trim(), direccion, telefono, montura, tipoTrabajo, tratado, fechaEntrega,
      aCuenta: Number(aCuenta), saldo: saldoCalculado, total: Number(total),
      refraccion: { od, oi, cercaAdd }
    };

    try {
      const res = await fetchSeguro('/api/venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMensajeExito(`¡Transacción exitosa! Expediente guardado bajo la orden ${data.numeroOrden}`);
        // Reset de campos
        setTotal(''); setACuenta(''); setMontura(''); setTipoTrabajo(''); setTratado(''); setFechaEntrega('');
        setOd({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
        setOi({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
        setCercaAdd('');
        cargarDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else { setErrorForm(data.error || 'Fallo transaccional al registrar la orden.'); }
    } catch (err) { setErrorForm(err.message || 'Error de red al procesar la venta.'); }
  };

  const handleUpdateOd = (field, val) => setOd(prev => ({ ...prev, [field]: val }));
  const handleUpdateOi = (field, val) => setOi(prev => ({ ...prev, [field]: val }));

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800">Portal Clínico Prd</h2>
          <p className="text-xs text-slate-500 mt-1">Plataforma Segura Azure ASWA</p>
        </div>
        {errorLogin && <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-3 rounded text-xs mb-4 font-medium">{errorLogin}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="text-xs font-bold text-slate-600 block mb-1">USUARIO</label><input type="text" required value={usuario} onChange={(e)=>setUsuario(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-sky-600" placeholder="admin" /></div>
          <div><label className="text-xs font-bold text-slate-600 block mb-1">CLAVE DE ACCESO</label><input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm outline-none focus:border-sky-600" placeholder="••••••••••••" /></div>
          <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white p-3 rounded-lg font-bold text-sm shadow transition-colors">Ingresar al Sistema</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <span className="bg-sky-600 text-white font-bold px-2.5 py-1 rounded text-xs">PRD</span>
          <h1 className="font-extrabold text-slate-800 text-base md:text-lg">Gestión Clínica y Financiera</h1>
        </div>
        <button onClick={handleLogout} className="text-xs text-rose-600 font-bold px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded transition-colors">Desconectar</button>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl border shadow-sm"><h2 className="text-xs font-bold text-slate-400 text-center mb-2 uppercase">Telemetría de Ventas (S/)</h2><div className="h-40">{dataVentas ? <Bar data={dataVentas} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos registrados</div>}</div></div>
          <div className="bg-white p-4 rounded-xl border shadow-sm"><h2 className="text-xs font-bold text-slate-400 text-center mb-2 uppercase">Pacientes Frecuentes</h2><div className="h-40">{dataClientes ? <Bar data={dataClientes} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /> : <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos registrados</div>}</div></div>
        </div>

        {/* Pestañas Modulares */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
          <button onClick={() => {setTabActiva('registro'); setErrorForm(''); setMensajeExito('');}} className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${tabActiva === 'registro' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Módulo 1: Registrar Venta</button>
          <button onClick={() => {setTabActiva('historial'); setErrorForm(''); setMensajeExito('');}} className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${tabActiva === 'historial' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Módulo 2: Búsqueda e Historial</button>
        </div>

        {mensajeExito && <div className="bg-emerald-50 border-l-4 border-emerald-600 text-emerald-800 p-4 rounded-r font-medium text-sm shadow-sm">{mensajeExito}</div>}
        {errorForm && <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-4 rounded-r font-medium text-sm shadow-sm">{errorForm}</div>}

        {/* MÓDULO 1 */}
        {tabActiva === 'registro' && (
          <form onSubmit={registrarVenta} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-5 rounded-b-xl rounded-tr-xl border space-y-4 shadow-sm self-start">
              <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2">FICHA DEL PACIENTE</h2>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">DNI *</label><input type="text" maxLength="8" required value={dni} onChange={(e)=>{setDni(e.target.value); if(e.target.value.length===8) autoBuscarRegistro(e.target.value);}} placeholder="Número de 8 dígitos" className="w-full p-2 border rounded font-bold text-sm outline-none focus:border-sky-600" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">NOMBRES COMPLETOS *</label><input type="text" required value={nombres} onChange={(e)=>setNombres(e.target.value)} placeholder="Nombres y Apellidos" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">DIRECCIÓN</label><input type="text" value={direccion} onChange={(e)=>setDireccion(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TELÉFONO</label><input type="text" value={telefono} onChange={(e)=>setTelefono(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-sky-600" /></div>
            </div>

            <div className="lg:col-span-8 bg-white p-5 rounded-b-xl rounded-tl-xl border space-y-6 shadow-sm">
              <div>
                <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">PRESCRIPCIÓN OPTOMÉTRICA</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead><tr className="bg-slate-100 text-slate-600 text-[10px] font-bold border-b"><th className="p-2">OJO</th><th className="p-2">R/P</th><th className="p-2">ESF</th><th className="p-2">CIL</th><th className="p-2">EJE</th><th className="p-2">DIP</th><th className="p-2">ALT</th></tr></thead>
                    <tbody className="text-xs text-slate-700 divide-y">
                      <tr><td className="p-2 font-bold text-sky-700">OD</td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.rp} onChange={(e)=>handleUpdateOd('rp', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.esf} onChange={(e)=>handleUpdateOd('esf', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.cil} onChange={(e)=>handleUpdateOd('cil', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.eje} onChange={(e)=>handleUpdateOd('eje', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.dip} onChange={(e)=>handleUpdateOd('dip', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={od.alt} onChange={(e)=>handleUpdateOd('alt', e.target.value)} /></td></tr>
                      <tr><td className="p-2 font-bold text-sky-700">OI</td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.rp} onChange={(e)=>handleUpdateOi('rp', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.esf} onChange={(e)=>handleUpdateOi('esf', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.cil} onChange={(e)=>handleUpdateOi('cil', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.eje} onChange={(e)=>handleUpdateOi('eje', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.dip} onChange={(e)=>handleUpdateOi('dip', e.target.value)} /></td><td><input type="text" className="w-full p-1 border rounded text-center" value={oi.alt} onChange={(e)=>handleUpdateOi('alt', e.target.value)} /></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 max-w-xs"><label className="text-[10px] font-bold text-slate-500 block mb-1">ADICIÓN DE CERCA (ADD)</label><input type="text" value={cercaAdd} onChange={(e)=>setCercaAdd(e.target.value)} className="w-full p-1.5 border rounded text-xs outline-none focus:border-sky-600" /></div>
              </div>

              <div>
                <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3">DETALLES DEL LENTE / MONTURA</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">MONTURA</label><input type="text" value={montura} onChange={(e)=>setMontura(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO DE CRISTAL</label><input type="text" value={tipoTrabajo} onChange={(e)=>setTipoTrabajo(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TRATAMIENTO</label><input type="text" value={tratado} onChange={(e)=>setTratado(e.target.value)} className="w-full p-2 border rounded text-xs outline-none focus:border-sky-600" /></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border">
                <h3 className="text-[10px] font-extrabold text-slate-400 mb-3 uppercase">Estructura de Cobro</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">TOTAL (S/)</label><input type="number" required value={total} onChange={(e)=>setTotal(e.target.value)} className="w-full p-2 border rounded font-bold text-sm outline-none focus:border-sky-600" /></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">A CUENTA (S/)</label><input type="number" required value={aCuenta} onChange={(e)=>setACuenta(e.target.value)} className="w-full p-2 border rounded font-bold text-emerald-600 text-sm outline-none focus:border-sky-600" /></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">SALDO</label><div className="w-full p-2 border rounded bg-slate-200/50 font-bold text-rose-600 text-sm">{saldoCalculado}</div></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">ENTREGA</label><input type="date" value={fechaEntrega} onChange={(e)=>setFechaEntrega(e.target.value)} className="w-full p-2 border rounded text-xs text-slate-700 outline-none focus:border-sky-600" /></div>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl font-bold text-sm shadow transition-colors">Confirmar Transacción y Registrar Venta</button>
            </div>
          </form>
        )}

        {/* MÓDULO 2 */}
        {tabActiva === 'historial' && (
          <div className="bg-white p-6 rounded-b-xl rounded-tr-xl border space-y-6 shadow-sm">
            <form onSubmit={ejecutarBusquedaManual} className="max-w-xl space-y-2">
              <label className="text-xs font-extrabold text-slate-700 block">BÚSQUEDA DE EXPEDIENTES POR DNI</label>
              <div className="flex space-x-3">
                <input type="text" maxLength="8" required value={busquedaDni} onChange={(e)=>setBusquedaDni(e.target.value)} placeholder="Ingrese DNI del paciente..." className="flex-1 p-2.5 border rounded-lg text-sm outline-none focus:border-sky-600" />
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors">Consultar</button>
              </div>
              {estadoBusqueda && <p className="text-xs text-slate-500 font-medium mt-1">{estadoBusqueda}</p>}
            </form>

            {clienteEncontrado && (
              <div className="border-t pt-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div><span className="text-[10px] font-bold text-slate-400 block">PACIENTE</span><p className="font-bold text-slate-800 text-sm">{clienteEncontrado.nombres}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 block">DNI</span><p className="font-medium text-slate-700 text-sm">{clienteEncontrado.dni}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 block">CONTACTO</span><p className="text-xs text-slate-600">{clienteEncontrado.telefono || 'Sin teléfono'} - {clienteEncontrado.direccion || 'Sin dirección'}</p></div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-extrabold text-slate-700 mb-3">HISTORIAL CLÍNICO Y COMPRAS PREVIAS</h3>
              {ordenesCliente.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-xl text-slate-400 text-xs font-medium">
                  {clienteEncontrado ? 'El paciente no posee órdenes de compra en el historial.' : 'Realice una consulta para visualizar transacciones anteriores.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {ordenesCliente.map((ord) => (
                    <div key={ord.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2"><span className="bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded text-[10px] border border-sky-100">{ord.numeroOrden}</span><span className="text-xs text-slate-400 font-medium">{new Date(ord.fechaOrden).toLocaleDateString()}</span></div>
                        <p className="text-xs font-bold text-slate-800">{ord.montura || 'Sin montura'} • <span className="text-slate-600 font-normal">{ord.tipoTrabajo} ({ord.tratado || 'Estándar'})</span></p>
                      </div>

                      {ord.refraccion && (
                        <div className="text-[10px] bg-slate-50 px-3 py-1.5 rounded border space-y-0.5 text-slate-600">
                          <div><strong className="text-sky-800 font-bold">OD:</strong> Esf: {ord.refraccion.od?.esf || '-'} | Cil: {ord.refraccion.od?.cil || '-'} | Eje: {ord.refraccion.od?.eje || '-'}</div>
                          <div><strong className="text-sky-800 font-bold">OI:</strong> Esf: {ord.refraccion.oi?.esf || '-'} | Cil: {ord.refraccion.oi?.cil || '-'} | Eje: {ord.refraccion.oi?.eje || '-'}</div>
                        </div>
                      )}

                      <div className="text-right flex md:flex-col justify-between w-full md:w-auto items-center md:items-end border-t md:border-t-0 pt-2 md:pt-0">
                        <span className="text-xs font-extrabold text-slate-800">Total: S/ {ord.total}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ord.saldo > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          {ord.saldo > 0 ? `Saldo: S/ ${ord.saldo}` : 'Cancelado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}