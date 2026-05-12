import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_optica') || '');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  const [dataVentas, setDataVentas] = useState(null);
  const [dataClientes, setDataClientes] = useState(null);

  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [historial, setHistorial] = useState([]);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const [total, setTotal] = useState('');
  const [aCuenta, setACuenta] = useState('');
  const [montura, setMontura] = useState('');
  const [tipoTrabajo, setTipoTrabajo] = useState('');
  const [tratado, setTratado] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');

  const [od, setOd] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [oi, setOi] = useState({ rp: '', esf: '', cil: '', eje: '', dip: '', alt: '' });
  const [cercaAdd, setCercaAdd] = useState('');

  const saldoCalculado = (Number(total) || 0) - (Number(aCuenta) || 0);

  const cargarDashboard = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDataVentas({ labels: data.topVentas.map(v => v.numeroOrden), datasets: [{ label: 'Monto (S/)', data: data.topVentas.map(v => v.total), backgroundColor: 'rgba(2, 132, 199, 0.85)' }] });
        setDataClientes({ labels: data.topClientes.map(c => c.nombres.split(' ')[0]), datasets: [{ label: 'Órdenes', data: data.topClientes.map(c => c.cantidadComprada), backgroundColor: 'rgba(5, 150, 105, 0.85)' }] });
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (token) cargarDashboard(); }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault(); setErrorLogin('');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, password }) });
      const data = await res.json();
      if (res.ok) { localStorage.setItem('jwt_optica', data.token); setToken(data.token); } 
      else { setErrorLogin(data.error || 'Credenciales erróneas'); }
    } catch (err) { setErrorLogin('Sin respuesta de la API'); }
  };

  const handleLogout = () => { localStorage.removeItem('jwt_optica'); setToken(''); };

  const buscarCliente = async (numeroDni) => {
    if (numeroDni.length < 8) return;
    setErrorForm(''); setMensajeExito('');
    try {
      const res = await fetch(`/api/cliente?dni=${numeroDni}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setNombres(data.cliente.nombres); setDireccion(data.cliente.direccion || '');
        setTelefono(data.cliente.telefono || ''); setHistorial(data.ordenes || []);
      } else { setNombres(''); setDireccion(''); setTelefono(''); setHistorial([]); }
    } catch (err) { console.error(err); }
  };

  const registrarVenta = async (e) => {
    e.preventDefault(); setErrorForm(''); setMensajeExito('');
    if (!dni || !nombres) return;
    const payload = { dni, nombres, direccion, telefono, montura, tipoTrabajo, tratado, fechaEntrega, aCuenta: Number(aCuenta), saldo: saldoCalculado, refraccion: { od, oi, cercaAdd } };
    try {
      const res = await fetch('/api/venta', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) { setMensajeExito(`Orden Generada: ${data.numeroOrden}`); buscarCliente(dni); cargarDashboard(); } 
      else { setErrorForm(data.error || 'Fallo transaccional'); }
    } catch (err) { setErrorForm('Error de red'); }
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Acceso Corporativo</h2>
        {errorLogin && <div className="bg-rose-50 text-rose-700 p-3 rounded text-xs mb-4">{errorLogin}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Usuario" required value={usuario} onChange={(e)=>setUsuario(e.target.value)} className="w-full p-3 border rounded text-sm" />
          <input type="password" placeholder="Clave" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-3 border rounded text-sm" />
          <button type="submit" className="w-full bg-sky-600 text-white p-3 rounded font-bold text-sm">Ingresar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center"><h1 className="font-bold text-slate-800">Sistema Optométrico</h1><button onClick={handleLogout} className="text-xs text-rose-600 font-bold">Salir</button></header>
      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl border"><h2 className="text-xs font-bold text-slate-400 text-center mb-2">Top Ventas</h2><div className="h-40">{dataVentas && <Bar data={dataVentas} options={{ maintainAspectRatio: false }} />}</div></div>
          <div className="bg-white p-4 rounded-xl border"><h2 className="text-xs font-bold text-slate-400 text-center mb-2">Top Clientes</h2><div className="h-40">{dataClientes && <Bar data={dataClientes} options={{ maintainAspectRatio: false }} />}</div></div>
        </div>
        {mensajeExito && <div className="bg-emerald-50 text-emerald-800 p-3 rounded text-sm font-bold">{mensajeExito}</div>}
        <form onSubmit={registrarVenta} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-4 rounded-xl border space-y-3">
            <h2 className="text-xs font-bold text-slate-600 uppercase">Paciente</h2>
            <input type="text" maxLength="8" required value={dni} onChange={(e)=>{setDni(e.target.value); if(e.target.value.length===8) buscarCliente(e.target.value);}} placeholder="DNI *" className="w-full p-2 border rounded font-bold" />
            <input type="text" required value={nombres} onChange={(e)=>setNombres(e.target.value)} placeholder="Nombres *" className="w-full p-2 border rounded text-sm" />
            <input type="text" value={direccion} onChange={(e)=>setDireccion(e.target.value)} placeholder="Dirección" className="w-full p-2 border rounded text-sm" />
            <input type="text" value={telefono} onChange={(e)=>setTelefono(e.target.value)} placeholder="Teléfono" className="w-full p-2 border rounded text-sm" />
          </div>
          <div className="lg:col-span-8 bg-white p-4 rounded-xl border space-y-4">
            <h2 className="text-xs font-bold text-slate-600 uppercase">Refracción y Cobro</h2>
            <div className="grid grid-cols-3 gap-2"><input type="text" value={montura} onChange={(e)=>setMontura(e.target.value)} placeholder="Montura" className="p-2 border rounded text-xs" /><input type="text" value={tipoTrabajo} onChange={(e)=>setTipoTrabajo(e.target.value)} placeholder="Lente" className="p-2 border rounded text-xs" /><input type="text" value={tratado} onChange={(e)=>setTratado(e.target.value)} placeholder="Tratado" className="p-2 border rounded text-xs" /></div>
            <div className="bg-slate-50 p-3 rounded grid grid-cols-4 gap-2"><div><label className="text-[9px] font-bold">TOTAL</label><input type="number" required value={total} onChange={(e)=>setTotal(e.target.value)} className="w-full p-1 border font-bold" /></div><div><label className="text-[9px] font-bold">A CTA</label><input type="number" required value={aCuenta} onChange={(e)=>setACuenta(e.target.value)} className="w-full p-1 border font-bold text-emerald-600" /></div><div><label className="text-[9px] font-bold">SALDO</label><div className="p-1 bg-white border font-bold text-rose-600">{saldoCalculado}</div></div><div><label className="text-[9px] font-bold">ENTREGA</label><input type="date" value={fechaEntrega} onChange={(e)=>setFechaEntrega(e.target.value)} className="w-full p-1 border text-xs" /></div></div>
            <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded font-bold text-sm">Registrar Venta</button>
          </div>
        </form>
      </main>
    </div>
  );
}