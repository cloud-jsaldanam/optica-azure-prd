import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import * as jwt from "jsonwebtoken";

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";

const client = new CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");

const USUARIOS_AUTORIZADOS: Record<string, { pass: string, nombre: string, role: string }> = {
    "admin": { pass: "OpticaSegura2026*", nombre: "Administrador Principal", role: "admin" },
    "magaly": { pass: "MagalyPrd2026*", nombre: "Magaly", role: "admin" },
    "flor": { pass: "47571420", nombre: "Flor", role: "especialista" }
};

const NOMBRES_MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const NOMBRES_DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const path = context.bindingData?.path || req.params?.path;

    if (path === "login" && req.method === "POST") {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const usuarioInput = payload.usuario?.trim().toLowerCase();
            const passwordInput = payload.password?.trim();
            const userMeta = USUARIOS_AUTORIZADOS[usuarioInput];
            if (userMeta && passwordInput === userMeta.pass) {
                const token = jwt.sign({ user: usuarioInput, nombre: userMeta.nombre, role: userMeta.role, ts: Date.now() }, JWT_SECRET_CORE, { expiresIn: "24h" });
                context.res = { status: 200, body: { token, usuario: userMeta.nombre, role: userMeta.role }, headers: { "Content-Type": "application/json" } };
                return;
            }
            context.res = { status: 401, body: { error: "Credenciales incorrectas" } };
        } catch (err) { context.res = { status: 500, body: { error: "Error login" } }; }
        return;
    }

    const authHeader = req.headers?.['x-optica-auth'] || req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { status: 401, body: { error: "No autorizado" } }; return;
    }
    let sesion;
    try { sesion = jwt.verify(authHeader.split(" ")[1], JWT_SECRET_CORE) as any; } 
    catch (err) { context.res = { status: 401, body: { error: "Token inválido" } }; return; }

    if (path === "clientes" && req.method === "GET") {
        try {
            const { resources: raw } = await container.items.query("SELECT * FROM c WHERE c.tipo = 'cliente'").fetchAll();
            const clientes = raw.sort((a, b) => (a.nombres || "").localeCompare(b.nombres || ""));
            context.res = { status: 200, body: { clientes } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }

    if (path === "cliente" && req.method === "GET") {
        const dni = req.query?.dni;
        try {
            const { resource: cliente } = await container.item(`cli_${dni}`, "cliente").read();
            const { resources: ordRaw } = await container.items.query({ query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id", parameters: [{ name: "@id", value: `cli_${dni}` }] }).fetchAll();
            const ordenes = ordRaw.sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
            context.res = { status: 200, body: { cliente, ordenes } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }

    if (path === "venta" && req.method === "POST") {
        try {
            const p = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const ts = new Date().toISOString();
            await container.items.upsert({ id: `cli_${p.dni}`, tipo: "cliente", dni: p.dni, nombres: p.nombres, direccion: p.direccion, telefono: p.telefono, fechaRegistro: ts });
            const num = `ORD-${Date.now().toString().slice(-6)}`;
            await container.items.create({ id: `ord_${num}`, tipo: "orden", numeroOrden: num, fechaOrden: ts, clienteId: `cli_${p.dni}`, montura: p.montura, tipoTrabajo: p.tipoTrabajo, tratado: p.tratado, refraccion: p.refraccion, aCuenta: Number(p.aCuenta), saldo: Number(p.saldo), total: Number(p.total), fechaEntrega: p.fechaEntrega, vendedor: sesion.nombre });
            context.res = { status: 201, body: { numeroOrden: num } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }

    if (path === "venta" && req.method === "DELETE") {
        if (sesion.role !== "admin") { context.res = { status: 403, body: { error: "Sin permisos" } }; return; }
        const id = req.query?.id;
        try {
            if (id.startsWith("ord_")) {
                const { resource: doc } = await container.item(id, "orden").read();
                await container.item(id, "orden").delete();
                const { resources: restantes } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cid", parameters: [{ name: "@cid", value: doc.clienteId }] }).fetchAll();
                if (restantes.length === 0) await container.item(doc.clienteId, "cliente").delete().catch(()=>{});
            } else if (id.startsWith("cli_")) {
                const { resources: ordenes } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id", parameters: [{ name: "@id", value: id }] }).fetchAll();
                for (const o of ordenes) { await container.item(o.id, "orden").delete().catch(()=>{}); }
                await container.item(id, "cliente").delete().catch(()=>{});
            }
            context.res = { status: 200, body: { mensaje: "Purgado" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }

    // ==========================================
    // ENDPOINT: DASHBOARD (Cálculos de meses y días)
    // ==========================================
    if (path === "dashboard" && req.method === "GET") {
        try {
            // Extraemos todas las órdenes sin filtros SQL complejos para eludir bloqueos de índices
            const { resources: todasOrdenes } = await container.items.query("SELECT * FROM c WHERE c.tipo = 'orden'").fetchAll();
            const ordenesValidas = todasOrdenes || [];

            // 1. TOP VENTAS DETALLADO: Traer nombre del paciente
            const sorted = [...ordenesValidas].sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
            const topRaw = sorted.slice(0, 5);
            const topVentasDetallado = await Promise.all(topRaw.map(async (o) => {
                try {
                    const { resource: c } = await container.item(o.clienteId, "cliente").read();
                    // Creamos la etiqueta detallada: "ORD-1234 | Juan Pérez"
                    return { label: `${o.numeroOrden} | ${c?.nombres || 'Cliente'}`, total: Number(o.total) };
                } catch (e) { return { label: `${o.numeroOrden}`, total: Number(o.total) }; }
            }));

            // 2. ANALÍTICA MENSUAL (Historial S/)
            const countsMeses: Record<string, number> = {};
            // Inicializar últimos 6 meses para que no salgan vacíos
            for(let i=5; i>=0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
                countsMeses[key] = 0;
            }
            
            ordenesValidas.forEach(o => {
                if(!o.fechaOrden) return;
                const key = o.fechaOrden.substring(0, 7); // YYYY-MM
                if (countsMeses[key] !== undefined) countsMeses[key] += Number(o.total);
            });

            const analiticaMensual = Object.entries(countsMeses).sort((a:any, b:any) => a[0].localeCompare(b[0])).map(([key, value]) => ({
                mes: `${NOMBRES_MESES[Number(key.substring(5))-1]}`,
                total: value
            }));

            // 3. ANALÍTICA DÍA DE SEMANA (Flujo Órdenes)
            const countsDias: Record<number, number> = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 0:0}; // Lun a Dom
            ordenesValidas.forEach(o => {
                if(!o.fechaOrden) return;
                const d = new Date(o.fechaOrden);
                const dayOfWeek = d.getDay(); // 0:Dom, 1:Lun...
                countsDias[dayOfWeek] += 1;
            });

            const analiticaDiaria = Object.entries(countsDias).map(([key, value]) => ({
                dia: NOMBRES_DIAS[Number(key)],
                cantidad: value
            }));

            context.res = { status: 200, body: { topVentas: topVentasDetallado, analiticaMensual, analiticaDiaria } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }
};
export default httpTrigger;