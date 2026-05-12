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

    // ELIMINACIÓN REFORZADA: Soporta borrar una Orden o borrar un Cliente Completo
    if (path === "venta" && req.method === "DELETE") {
        if (sesion.role !== "admin") { context.res = { status: 403, body: { error: "Sin permisos" } }; return; }
        const id = req.query?.id; // Puede ser ord_... o cli_...
        try {
            if (id.startsWith("ord_")) {
                const { resource: doc } = await container.item(id, "orden").read();
                await container.item(id, "orden").delete();
                // Si era la última orden, borramos al cliente también
                const { resources: restantes } = await container.items.query({ query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cid", parameters: [{ name: "@id", value: doc.clienteId }] }).fetchAll();
                if (restantes.length === 0) await container.item(doc.clienteId, "cliente").delete().catch(()=>{});
            } else if (id.startsWith("cli_")) {
                // BORRADO TOTAL POR DNI (NUKE)
                const { resources: ordenes } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id", parameters: [{ name: "@id", value: id }] }).fetchAll();
                for (const o of ordenes) { await container.item(o.id, "orden").delete().catch(()=>{}); }
                await container.item(id, "cliente").delete().catch(()=>{});
            }
            context.res = { status: 200, body: { mensaje: "Purgado completo" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }

    if (path === "dashboard" && req.method === "GET") {
        try {
            const { resources: ordenes } = await container.items.query("SELECT * FROM c WHERE c.tipo = 'orden'").fetchAll();
            const sorted = [...ordenes].sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
            const topVentas = sorted.slice(0, 5).map(o => ({ numeroOrden: o.numeroOrden, total: Number(o.total), fechaOrden: o.fechaOrden }));
            const counts: any = {};
            ordenes.forEach(o => counts[o.clienteId] = (counts[o.clienteId] || 0) + 1);
            const topCli = await Promise.all(Object.entries(counts).sort((a:any, b:any) => b[1] - a[1]).slice(0, 5).map(async ([cid, count]) => {
                const { resource: c } = await container.item(cid, "cliente").read();
                return { nombres: c?.nombres || cid, cantidadComprada: count };
            }));
            context.res = { status: 200, body: { topVentas, topClientes: topCli } }; return;
        } catch (e) { context.res = { status: 500, body: { error: e.message } }; return; }
    }
};
export default httpTrigger;