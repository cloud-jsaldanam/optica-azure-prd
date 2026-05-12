import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import * as jwt from "jsonwebtoken";

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";

const client = new CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");

// Catálogo multi-usuario para trazabilidad en clínica
const USUARIOS_AUTORIZADOS: Record<string, { pass: string, nombre: string }> = {
    "admin": { pass: "OpticaSegura2026*", nombre: "Administrador Principal" },
    "optometra1": { pass: "ClinicaLima2026*", nombre: "Optómetra - Módulo 1" },
    "optometra2": { pass: "ClinicaLima2026*", nombre: "Optómetra - Módulo 2" }
};

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const path = context.bindingData?.path || req.params?.path;

    // 1. ENDPOINT: AUTENTICACIÓN MULTI-USUARIO
    if (path === "login" && req.method === "POST") {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const usuario = payload.usuario?.trim();
            const password = payload.password?.trim();

            const userMeta = USUARIOS_AUTORIZADOS[usuario];
            if (userMeta && password === userMeta.pass) {
                const token = jwt.sign(
                    { user: usuario, nombre: userMeta.nombre, role: "especialista", ts: Date.now() }, 
                    JWT_SECRET_CORE, 
                    { expiresIn: "24h" }
                );
                context.res = { status: 200, body: { token, usuario: userMeta.nombre }, headers: { "Content-Type": "application/json" } };
                return;
            }
            context.res = { status: 401, body: { error: "Credenciales de acceso no autorizadas" }, headers: { "Content-Type": "application/json" } };
        } catch (err) { 
            context.res = { status: 500, body: { error: "Fallo del servidor al procesar la identidad" }, headers: { "Content-Type": "application/json" } }; 
        }
        return;
    }

    // MIDDLEWARE DE AUTORIZACIÓN (Prioridad a x-optica-auth)
    const authHeader = req.headers?.['x-optica-auth'] || req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { status: 401, body: { error: "Sesión denegada. Token ausente o formato inválido." }, headers: { "Content-Type": "application/json" } }; 
        return;
    }

    let sesionActual;
    try { 
        sesionActual = jwt.verify(authHeader.split(" ")[1], JWT_SECRET_CORE) as any; 
    } catch (err) { 
        context.res = { status: 401, body: { error: `Firma rechazada: ${err.message}` }, headers: { "Content-Type": "application/json" } }; 
        return; 
    }

    // 2. ENDPOINT: DIRECTORIO GLOBAL
    if (path === "clientes" && req.method === "GET") {
        try {
            const { resources: clientes } = await container.items
                .query("SELECT c.dni, c.nombres, c.telefono, c.direccion FROM c WHERE c.tipo = 'cliente' ORDER BY c.nombres ASC")
                .fetchAll();
            context.res = { status: 200, body: { clientes }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: "Error de lectura en base de datos" }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 3. ENDPOINT: CONSULTA DE EXPEDIENTE
    if (path === "cliente" && req.method === "GET") {
        const dni = req.query?.dni?.trim();
        if (!dni) { context.res = { status: 400, body: { error: "DNI requerido" }, headers: { "Content-Type": "application/json" } }; return; }
        try {
            const { resource: cliente } = await container.item(`cli_${dni}`, "cliente").read();
            const { resources: ordenes } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId ORDER BY c.fechaOrden DESC",
                    parameters: [{ name: "@cliId", value: `cli_${dni}` }]
                }).fetchAll();
            context.res = { status: 200, body: { cliente: cliente || null, ordenes: ordenes || [] }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: "Error consultando el repositorio" }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 4. ENDPOINT: CREACIÓN DE ORDEN CON TRAZABILIDAD
    if (path === "venta" && req.method === "POST") {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            if (!payload.dni || !payload.nombres) { context.res = { status: 400, body: { error: "Datos primarios obligatorios" }, headers: { "Content-Type": "application/json" } }; return; }
            const timestamp = new Date().toISOString();
            
            const clienteObj = { id: `cli_${payload.dni}`, tipo: "cliente", dni: payload.dni, nombres: payload.nombres, direccion: payload.direccion || "", telefono: payload.telefono || "", fechaRegistro: timestamp };
            await container.items.upsert(clienteObj);

            const numeroOrden = `ORD-${Date.now().toString().slice(-6)}`;
            const ordenObj = {
                id: `ord_${numeroOrden}`, 
                tipo: "orden", 
                numeroOrden, 
                fechaOrden: timestamp, 
                clienteId: `cli_${payload.dni}`,
                montura: payload.montura || "", 
                tipoTrabajo: payload.tipoTrabajo || "", 
                tratado: payload.tratado || "",
                refraccion: payload.refraccion || null, 
                aCuenta: Number(payload.aCuenta || 0), 
                saldo: Number(payload.saldo || 0),
                total: Number(payload.total || 0), 
                fechaEntrega: payload.fechaEntrega || "", 
                vendedor: sesionActual.nombre || "Especialista Clínico" // Trazabilidad inyectada
            };
            await container.items.create(ordenObj);
            context.res = { status: 201, body: { mensaje: "Transacción guardada con éxito", numeroOrden, cliente: clienteObj }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: "Error de escritura en Cosmos DB" }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 5. ENDPOINT: ELIMINACIÓN DE REGISTROS ERRÓNEOS
    if (path === "venta" && req.method === "DELETE") {
        const idOrden = req.query?.id?.trim();
        const partitionKey = req.query?.pk?.trim(); // Requiere el id de partición (tipo)
        if (!idOrden) { context.res = { status: 400, body: { error: "Identificador de orden requerido para eliminación" }, headers: { "Content-Type": "application/json" } }; return; }
        try {
            await container.item(idOrden, partitionKey || "orden").delete();
            context.res = { status: 200, body: { mensaje: "Registro eliminado de la auditoría exitosamente" }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: "No se pudo eliminar el documento de Cosmos DB" }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 6. ENDPOINT: DASHBOARD
    if (path === "dashboard" && req.method === "GET") {
        try {
            const { resources: topVentas } = await container.items.query("SELECT TOP 5 c.numeroOrden, c.total, c.fechaOrden FROM c WHERE c.tipo = 'orden' ORDER BY c.fechaOrden DESC").fetchAll();
            const { resources: topClientesRaw } = await container.items.query("SELECT TOP 5 c.clienteId, COUNT(1) as cantidadComprada FROM c WHERE c.tipo = 'orden' GROUP BY c.clienteId ORDER BY COUNT(1) DESC").fetchAll();
            const topClientes = await Promise.all(topClientesRaw.map(async (item) => {
                try {
                    const { resource: cli } = await container.item(item.clienteId, "cliente").read();
                    return { nombres: cli?.nombres || item.clienteId, cantidadComprada: item.cantidadComprada };
                } catch (e) { return { nombres: item.clienteId, cantidadComprada: item.cantidadComprada }; }
            }));
            context.res = { status: 200, body: { topVentas, topClientes }, headers: { "Content-Type": "application/json" } }; return;
        } catch (error) { context.res = { status: 500, body: { error: "Fallo en motor analítico" }, headers: { "Content-Type": "application/json" } }; return; }
    }
    
    context.res = { status: 404, body: { error: "Firma de API solicitada no implementada" }, headers: { "Content-Type": "application/json" } };
};

export default httpTrigger;