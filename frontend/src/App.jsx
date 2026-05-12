import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_optica') || '');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Pestaña activa: 'registro' | 'historial'
  const [tabActiva, setTabActiva] = useState('registro');

  // Analíticas
  const [dataVentas, setDataVentas] = useState(null);
  const [dataClientes, setDataClientes] = useState(null);

  // Estados del Formulario Paciente
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');

  // Estados de Cobro
  const [total, setTotal] = useState('');
  const [aCuenta, setACuenta] = useState('');
  const [montura, setMontura] = useState('');
  const [tipoTrabajo, setTipoTrabajo] = useState('');
  const [tratado, setTratado] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');

  // Estados de Refracción
  const [od, setOd] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [oi, setOi] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [cercaAdd, setCercaAdd] = useState('');

  // Buscador e Historial
  const [busquedaDni, setBusquedaDni] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [ordenesCliente, setOrdenesCliente] = useState([]);
  const [estadoBusqueda, setEstadoBusqueda] = useState('');

  // Feedback Visual
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const saldoCalculado = (Number(total) || 0) - (Number(aCuenta) || 0);

  const cargarDashboard = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.topVentas) {
          setDataVentas({
            labels: data.topVentas.map(v => v.numeroOrden),
            datasets: [{ label: 'Monto (S/)', data: data.topVentas.map(v => v.total), backgroundColor: '#0284c7' }]
          });
        }
        if (data.topClientes) {
          setDataClientes({
            labels: data.topClientes.map(c => c.nombres ? c.nombres.split(' ')[0] : 'Anon'),
            datasets: [{ label: 'Órdenes', data: data.topClientes.map(c => c.cantidadComprada), backgroundColor: '#059669' }]
          });
        }
      }
    } catch (err) { console.error("Error cargando analíticas:", err); }
  };

  useEffect(() => { if (token) cargarDashboard(); }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('jwt_optica', data.token);
        setToken(data.token);
      } else { setErrorLogin(data.error || 'Credenciales erróneas'); }
    } catch (err) { setErrorLogin('Sin respuesta del servidor de autenticación'); }
  };

  const handleLogout = () => { localStorage.removeItem('jwt_optica'); setToken(''); };

  // Ejecuta la búsqueda automática al completar 8 dígitos en el registro
  const autoBuscarRegistro = async (numeroDni) => {
    if (numeroDni.length !== 8) return;
    try {
      const res = await fetch(`/api/cliente?dni=${numeroDni}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.cliente) {
          setNombres(data.cliente.nombres || '');
          setDireccion(data.cliente.direccion || '');
          setTelefono(data.cliente.telefono || '');
          setMensajeExito(`Paciente recurrente detectado: ${data.cliente.nombres}`);
          setTimeout(() => setMensajeExito(''), 4000);
        }
      }
    } catch (err) { console.error("Fallo de red en autocompletado", err); }
  };

  // Búsqueda manual para el Módulo de Historial
  const ejecutarBusquedaManual = async (e) => {
    e.preventDefault();
    setEstadoBusqueda('Buscando en Cosmos DB...'); setClienteEncontrado(null); setOrdenesCliente([]);
    try {
      const res = await fetch(`/api/cliente?dni=${busquedaDni}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setClienteEncontrado(data.cliente);
        setOrdenesCliente(data.ordenes || []);
        setEstadoBusqueda('');
      } else {
        setEstadoBusqueda('No se encontraron registros para este DNI.');
      }
    } catch (err) { setEstadoBusqueda('Error de conexión al consultar el expediente.'); }
  };

  // Guardar Transacción en Azure
  const registrarVenta = async (e) => {
    e.preventDefault(); setErrorForm(''); setMensajeExito('');
    if (!dni || !nombres) { setErrorForm('Por favor ingrese el DNI y Nombre del paciente.'); return; }
    
    const payload = {
      dni, nombres, direccion, telefono, montura, tipoTrabajo, tratado, fechaEntrega,
      aCuenta: Number(aCuenta), saldo: saldoCalculado,
      refraccion: { od, oi, cercaAdd }
    };

    try {
      const res = await fetch('/api/venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMensajeExito(`¡Venta registrada exitosamente! Orden generada: ${data.numeroOrden}`);
        // Limpiar formulario básico
        setTotal(''); setACuenta(''); setMontura(''); setTipoTrabajo(''); setTratado(''); setFechaEntrega('');
        setOd({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
        setOi({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
        setCercaAdd('');
        cargarDashboard();
      } else { setErrorForm(data.error || 'No se pudo registrar la transacción.'); }
    } catch (err) { setErrorForm('Fallo de red al intentar conectar con la API.'); }
  };

  const handleUpdateOd = (field, val) => setOd(prev => ({ ...prev, [field]: val }));
  const handleUpdateOi = (field, val) => setOi(prev => ({ ...prev, [field]: val }));

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800">Óptica Core Prd</h2>
          <p className="text-xs text-slate-500 mt-1">Acceso seguro Azure Serverless</p>
        </div>
        {errorLogin && <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-3 rounded text-xs mb-4 font-medium">{errorLogin}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="text-xs font-bold text-slate-600 block mb-1">USUARIO</label><input type="text" required value={usuario} onChange={(e)=>setUsuario(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="admin" /></div>
          <div><label className="text-xs font-bold text-slate-600 block mb-1">CONTRASEÑA</label><input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="••••••••••••" /></div>
          <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white p-3 rounded-lg font-bold text-sm transition-colors shadow-sm">Autenticar Sesión</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Cabecera */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-sky-600 text-white font-bold px-2.5 py-1 rounded text-sm">Azure</div>
          <h1 className="font-extrabold text-slate-800 text-lg">Sistema Optométrico Integrado</h1>
        </div>
        <button onClick={handleLogout} className="text-xs text-rose-600 hover:text-rose-800 font-bold px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded transition-colors">Cerrar Sesión</button>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {/* Módulo de Dashboard Superior */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 text-center mb-2 uppercase tracking-wider">Top Ventas (S/)</h2>
            <div className="h-40">{dataVentas && <Bar data={dataVentas} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 text-center mb-2 uppercase tracking-wider">Top Clientes Recurrentes</h2>
            <div className="h-40">{dataClientes && <Bar data={dataClientes} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}</div>
          </div>
        </div>

        {/* Navegación Modular (Pestañas) */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
          <button onClick={() => setTabActiva('registro')} className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${tabActiva === 'registro' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Módulo 1: Nueva Transacción</button>
          <button onClick={() => setTabActiva('historial')} className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${tabActiva === 'historial' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Módulo 2: Búsqueda e Historial</button>
        </div>

        {/* Notificaciones Globales */}
        {mensajeExito && <div className="bg-emerald-50 border-l-4 border-emerald-600 text-emerald-800 p-4 rounded-r-xl font-medium text-sm shadow-sm">{mensajeExito}</div>}
        {errorForm && <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-800 p-4 rounded-r-xl font-medium text-sm shadow-sm">{errorForm}</div>}

        {/* ==========================================
            MÓDULO 1: REGISTRO DE VENTA Y REFRACCIÓN
           ========================================== */}
        {tabActiva === 'registro' && (
          <form onSubmit={registrarVenta} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Datos del Paciente */}
            <div className="lg:col-span-4 bg-white p-5 rounded-b-xl rounded-tr-xl border border-slate-200 space-y-4 shadow-sm self-start">
              <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 tracking-wide">DATOS DEL PACIENTE</h2>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">DNI *</label><input type="text" maxLength="8" required value={dni} onChange={(e)=>{setDni(e.target.value); if(e.target.value.length===8) autoBuscarRegistro(e.target.value);}} placeholder="Ej. 49885422" className="w-full p-2 border rounded font-bold text-sm outline-none focus:border-sky-500" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">NOMBRES Y APELLIDOS *</label><input type="text" required value={nombres} onChange={(e)=>setNombres(e.target.value)} placeholder="Ej. Jonathan Saldaña" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-500" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">DIRECCIÓN</label><input type="text" value={direccion} onChange={(e)=>setDireccion(e.target.value)} placeholder="Ej. Comas, Lima" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-500" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TELÉFONO DE CONTACTO</label><input type="text" value={telefono} onChange={(e)=>setTelefono(e.target.value)} placeholder="Ej. 949129625" className="w-full p-2 border rounded text-sm outline-none focus:border-sky-500" /></div>
            </div>

            {/* Columna Derecha: Refracción Visual y Cobro */}
            <div className="lg:col-span-8 bg-white p-5 rounded-b-xl rounded-tl-xl border border-slate-200 space-y-6 shadow-sm">
              {/* Tabla Optométrica */}
              <div>
                <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3 tracking-wide">REFRACCIÓN OPTOMÉTRICA</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 text-[10px] font-bold border-b">
                        <th className="p-2">OJO</th><th className="p-2">R/P</th><th className="p-2">ESF</th><th className="p-2">CIL</th><th className="p-2">EJE</th><th className="p-2">DIP</th><th className="p-2">ALT</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-700 divide-y">
                      <tr>
                        <td className="p-2 font-bold text-sky-700">OD</td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={od.rp} onChange={(e)=>handleUpdateOd('rp', e.target.value)} placeholder="+/-" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={od.esf} onChange={(e)=>handleUpdateOd('esf', e.target.value)} placeholder="-1.25" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={od.cil} onChange={(e)=>handleUpdateOd('cil', e.target.value)} placeholder="-0.75" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={od.eje} onChange={(e)=>handleUpdateOd('eje', e.target.value)} placeholder="180°" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={od.dip} onChange={(e)=>handleUpdateOd('dip', e.target.value)} placeholder="62" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={od.alt} onChange={(e)=>handleUpdateOd('alt', e.target.value)} placeholder="18" /></td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-sky-700">OI</td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={oi.rp} onChange={(e)=>handleUpdateOi('rp', e.target.value)} placeholder="+/-" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={oi.esf} onChange={(e)=>handleUpdateOi('esf', e.target.value)} placeholder="-1.00" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={oi.cil} onChange={(e)=>handleUpdateOi('cil', e.target.value)} placeholder="-0.50" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={oi.eje} onChange={(e)=>handleUpdateOi('eje', e.target.value)} placeholder="175°" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={oi.dip} onChange={(e)=>handleUpdateOi('dip', e.target.value)} placeholder="62" /></td>
                        <td><input type="text" className="w-full p-1 border rounded text-center" value={oi.alt} onChange={(e)=>handleUpdateOi('alt', e.target.value)} placeholder="18" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3.5 max-w-xs"><label className="text-[10px] font-bold text-slate-500 block mb-1">ADICIÓN CERCA (ADD)</label><input type="text" value={cercaAdd} onChange={(e)=>setCercaAdd(e.target.value)} placeholder="Ej. +2.00" className="w-full p-1.5 border rounded text-xs outline-none focus:border-sky-500" /></div>
              </div>

              {/* Especificaciones del Lente */}
              <div>
                <h2 className="text-xs font-extrabold text-slate-700 border-b pb-2 mb-3 tracking-wide">ESPECIFICACIONES DE PRODUCTO</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">CÓDIGO DE MONTURA</label><input type="text" value={montura} onChange={(e)=>setMontura(e.target.value)} placeholder="Ej. RayBan RX5154" className="w-full p-2 border rounded text-xs outline-none focus:border-sky-500" /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TIPO DE CRISTAL / LENTE</label><input type="text" value={tipoTrabajo} onChange={(e)=>setTipoTrabajo(e.target.value)} placeholder="Ej. Resina UV400" className="w-full p-2 border rounded text-xs outline-none focus:border-sky-500" /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1">TRATAMIENTO ESPECIAL</label><input type="text" value={tratado} onChange={(e)=>setTratado(e.target.value)} placeholder="Ej. Antireflejo / BlueDefense" className="w-full p-2 border rounded text-xs outline-none focus:border-sky-500" /></div>
                </div>
              </div>

              {/* Módulo Financiero */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-[10px] font-extrabold text-slate-400 mb-3 tracking-wider uppercase">Liquidación Financiera</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">MONTO TOTAL (S/)</label><input type="number" required value={total} onChange={(e)=>setTotal(e.target.value)} placeholder="300" className="w-full p-2 border rounded bg-white font-extrabold text-slate-800 text-sm outline-none focus:border-sky-500" /></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">ABONO A CUENTA (S/)</label><input type="number" required value={aCuenta} onChange={(e)=>setACuenta(e.target.value)} placeholder="100" className="w-full p-2 border rounded bg-white font-extrabold text-emerald-600 text-sm outline-none focus:border-sky-500" /></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">SALDO PENDIENTE</label><div className="w-full p-2 border rounded bg-slate-200/70 font-extrabold text-rose-600 text-sm">{saldoCalculado}</div></div>
                  <div><label className="text-[10px] font-bold text-slate-600 block mb-1">FECHA DE ENTREGA</label><input type="date" value={fechaEntrega} onChange={(e)=>setFechaEntrega(e.target.value)} className="w-full p-2 border rounded bg-white text-xs text-slate-700 outline-none focus:border-sky-500" /></div>
                </div>
              </div>

              {/* Botón Transaccional */}
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl font-extrabold text-sm transition-colors shadow-md tracking-wide">Grabar Expediente y Emitir Orden de Venta</button>
            </div>
          </form>
        )}

        {/* ==========================================
            MÓDULO 2: BUSCADOR CENTRAL E HISTORIAL
           ========================================== */}
        {tabActiva === 'historial' && (
          <div className="bg-white p-6 rounded-b-xl rounded-tr-xl border border-slate-200 space-y-6 shadow-sm">
            {/* Buscador Superior */}
            <form onSubmit={ejecutarBusquedaManual} className="max-w-xl space-y-2">
              <label className="text-xs font-extrabold text-slate-700 block tracking-wide">AUDITORÍA DE EXPEDIENTES POR DNI</label>
              <div className="flex space-x-3">
                <input type="text" maxLength="8" required value={busquedaDni} onChange={(e)=>setBusquedaDni(e.target.value)} placeholder="Ingrese número de DNI a inspeccionar..." className="flex-1 p-2.5 border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500" />
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors">Buscar Expediente</button>
              </div>
              {estadoBusqueda && <p className="text-xs text-sky-700 font-bold mt-1">{estadoBusqueda}</p>}
            </form>

            {/* Renderizado de Resultados del Cliente */}
            {clienteEncontrado && (
              <div className="border-t pt-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border">
                <div><span className="text-[10px] font-bold text-slate-400 block">PACIENTE LOCALIZADO</span><p className="font-extrabold text-slate-800 text-sm">{clienteEncontrado.nombres}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 block">DNI REGISTRADO</span><p className="font-bold text-slate-700 text-sm">{clienteEncontrado.dni}</p></div>
                <div><span className="text-[10px] font-bold text-slate-400 block">TELÉFONO / DIRECCIÓN</span><p className="text-xs text-slate-600">{clienteEncontrado.telefono || 'Sin tel'} - {clienteEncontrado.direccion || 'Sin dir'}</p></div>
              </div>
            )}

            {/* Listado Histórico de Transacciones */}
            <div>
              <h3 className="text-xs font-extrabold text-slate-700 mb-3 tracking-wide">HISTÓRICO DE ÓRDENES Y COMPRAS ANTERIORES</h3>
              {ordenesCliente.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-xl text-slate-400 text-xs font-medium">
                  {clienteEncontrado ? 'Este paciente no posee transacciones previas registradas.' : 'Realice una búsqueda para desplegar el historial clínico y financiero.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {ordenesCliente.map((ord) => (
                    <div key={ord.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      {/* Cabecera Orden */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2"><span className="bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded text-[10px] border border-sky-100">{ord.numeroOrden}</span><span className="text-xs text-slate-400 font-medium">{new Date(ord.fechaOrden).toLocaleDateString()}</span></div>
                        <p className="text-xs font-bold text-slate-800">{ord.montura || 'Montura Estándar'} • <span className="text-slate-600 font-normal">{ord.tipoTrabajo} ({ord.tratado})</span></p>
                      </div>

                      {/* Resumen Refracción Guardada */}
                      {ord.refraccion && (
                        <div className="text-[10px] bg-slate-50 px-3 py-1.5 rounded border space-y-0.5 self-stretch md:self-auto text-slate-600">
                          <div><strong className="text-sky-800 font-bold">OD:</strong> Esf: {ord.refraccion.od?.esf || '-'} | Cil: {ord.refraccion.od?.cil || '-'}</div>
                          <div><strong className="text-sky-800 font-bold">OI:</strong> Esf: {ord.refraccion.oi?.esf || '-'} | Cil: {ord.refraccion.oi?.cil || '-'}</div>
                        </div>
                      )}

                      {/* Estado Financiero */}
                      <div className="text-right flex md:flex-col justify-between w-full md:w-auto items-center md:items-end border-t md:border-t-0 pt-2 md:pt-0">
                        <span className="text-xs font-extrabold text-slate-800">Total: S/ {ord.total}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ord.saldo > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          {ord.saldo > 0 ? `Saldo: S/ ${ord.saldo}` : 'Liquidado al 100%'}
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