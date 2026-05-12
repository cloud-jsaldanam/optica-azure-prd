import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import * as jwt from "jsonwebtoken";

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";

const client = new CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");

// Catálogo Multi-Usuario interno estandarizado en minúsculas
const USUARIOS_AUTORIZADOS: Record<string, { pass: string, nombre: string, role: string }> = {
    "admin": { pass: "OpticaSegura2026*", nombre: "Administrador Principal", role: "admin" },
    "magaly": { pass: "MagalyPrd2026*", nombre: "Magaly", role: "admin" },
    "flor": { pass: "47571420", nombre: "Flor", role: "especialista" }
};

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const path = context.bindingData?.path || req.params?.path;

    // 1. ENDPOINT: AUTENTICACIÓN
    if (path === "login" && req.method === "POST") {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const usuarioInput = payload.usuario?.trim().toLowerCase();
            const passwordInput = payload.password?.trim();

            const userMeta = USUARIOS_AUTORIZADOS[usuarioInput];
            if (userMeta && passwordInput === userMeta.pass) {
                const token = jwt.sign(
                    { user: usuarioInput, nombre: userMeta.nombre, role: userMeta.role, ts: Date.now() }, 
                    JWT_SECRET_CORE, 
                    { expiresIn: "24h" }
                );
                context.res = { status: 200, body: { token, usuario: userMeta.nombre, role: userMeta.role }, headers: { "Content-Type": "application/json" } };
                return;
            }
            context.res = { status: 401, body: { error: "Credenciales de acceso incorrectas" }, headers: { "Content-Type": "application/json" } };
        } catch (err) { context.res = { status: 500, body: { error: "Fallo del servidor en autenticación" }, headers: { "Content-Type": "application/json" } }; }
        return;
    }

    // MIDDLEWARE DE AUTORIZACIÓN
    const authHeader = req.headers?.['x-optica-auth'] || req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { status: 401, body: { error: "Sesión denegada. Token ausente o inválido." }, headers: { "Content-Type": "application/json" } }; return;
    }

    let sesionActual;
    try { sesionActual = jwt.verify(authHeader.split(" ")[1], JWT_SECRET_CORE) as any; } 
    catch (err) { context.res = { status: 401, body: { error: `Firma rechazada: ${err.message}` }, headers: { "Content-Type": "application/json" } }; return; }

    // 2. ENDPOINT: DIRECTORIO GLOBAL (Procesamiento en RAM)
    if (path === "clientes" && req.method === "GET") {
        try {
            const { resources: clientesRaw } = await container.items
                .query("SELECT c.dni, c.nombres, c.telefono, c.direccion FROM c WHERE c.tipo = 'cliente'")
                .fetchAll();
            
            const clientes = (clientesRaw || []).sort((a, b) => (a.nombres || "").localeCompare(b.nombres || ""));
            context.res = { status: 200, body: { clientes }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: `Error recuperando directorio: ${e.message}` }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 3. ENDPOINT: CONSULTA DE EXPEDIENTE
    if (path === "cliente" && req.method === "GET") {
        const dni = req.query?.dni?.trim();
        if (!dni) { context.res = { status: 400, body: { error: "DNI requerido" }, headers: { "Content-Type": "application/json" } }; return; }
        try {
            const { resource: cliente } = await container.item(`cli_${dni}`, "cliente").read();
            const { resources: ordenesRaw } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId",
                    parameters: [{ name: "@cliId", value: `cli_${dni}` }]
                }).fetchAll();
            
            const ordenes = (ordenesRaw || []).sort((a, b) => new Date(b.fechaOrden || 0).getTime() - new Date(a.fechaOrden || 0).getTime());
            context.res = { status: 200, body: { cliente: cliente || null, ordenes }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: `Error consultando BD: ${e.message}` }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 4. ENDPOINT: REGISTRO DE VENTA
    if (path === "venta" && req.method === "POST") {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            if (!payload.dni || !payload.nombres) { context.res = { status: 400, body: { error: "Datos primarios obligatorios" }, headers: { "Content-Type": "application/json" } }; return; }
            const timestamp = new Date().toISOString();
            
            const clienteObj = { id: `cli_${payload.dni}`, tipo: "cliente", dni: payload.dni, nombres: payload.nombres, direccion: payload.direccion || "", telefono: payload.telefono || "", fechaRegistro: timestamp };
            await container.items.upsert(clienteObj);

            const numeroOrden = `ORD-${Date.now().toString().slice(-6)}`;
            const ordenObj = {
                id: `ord_${numeroOrden}`, tipo: "orden", numeroOrden, fechaOrden: timestamp, clienteId: `cli_${payload.dni}`,
                montura: payload.montura || "", tipoTrabajo: payload.tipoTrabajo || "", tratado: payload.tratado || "",
                refraccion: payload.refraccion || null, aCuenta: Number(payload.aCuenta || 0), saldo: Number(payload.saldo || 0),
                total: Number(payload.total || 0), fechaEntrega: payload.fechaEntrega || "", vendedor: sesionActual.nombre || "Especialista"
            };
            await container.items.create(ordenObj);
            context.res = { status: 201, body: { mensaje: "Transacción guardada con éxito", numeroOrden, cliente: clienteObj }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: "Error de escritura en Cosmos DB" }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // =========================================================================
    // 5. ENDPOINT: BORRADO REFORZADO (Destruye huérfanos físicamente en cascada)
    // =========================================================================
    if (path === "venta" && req.method === "DELETE") {
        if (sesionActual.role !== "admin") {
            context.res = { status: 403, body: { error: "Operación denegada: Requiere privilegios de administrador." }, headers: { "Content-Type": "application/json" } }; return;
        }

        const idOrden = req.query?.id?.trim();
        if (!idOrden) { context.res = { status: 400, body: { error: "ID de orden requerido" }, headers: { "Content-Type": "application/json" } }; return; }
        
        try {
            // 1. Leemos la orden para saber a qué cliente pertenece
            const { resource: ordenDoc } = await container.item(idOrden, "orden").read();
            const clienteId = ordenDoc?.clienteId; // ej. cli_48385573

            // 2. Destruimos el documento de la orden de forma física
            await container.item(idOrden, "orden").delete().catch(()=>{});

            // 3. Purgado estricto: Si tenemos el clienteId, verificamos si le quedan más órdenes
            if (clienteId) {
                const { resources: ordenesRestantes } = await container.items.query({
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId",
                    parameters: [{ name: "@cliId", value: clienteId }]
                }).fetchAll();

                // Si ya no quedan órdenes para este DNI, fulminamos el perfil del cliente para limpiar el directorio
                if (!ordenesRestantes || ordenesRestantes.length === 0) {
                    await container.item(clienteId, "cliente").delete().catch(()=>{});
                }
            }

            context.res = { status: 200, body: { mensaje: `Orden purgada con éxito.` }, headers: { "Content-Type": "application/json" } }; return;
        } catch (e) { context.res = { status: 500, body: { error: `Fallo al purgar registros físicos: ${e.message}` }, headers: { "Content-Type": "application/json" } }; return; }
    }

    // 6. ENDPOINT: DASHBOARD (Mapeo estricto en RAM)
    if (path === "dashboard" && req.method === "GET") {
        try {
            const { resources: todasOrdenes } = await container.items.query("SELECT * FROM c WHERE c.tipo = 'orden'").fetchAll();
            const ordenesValidas = todasOrdenes || [];

            const ordenesOrdenadas = [...ordenesValidas].sort((a, b) => new Date(b.fechaOrden || 0).getTime() - new Date(a.fechaOrden || 0).getTime());
            const topVentas = ordenesOrdenadas.slice(0, 5).map(o => ({
                numeroOrden: o.numeroOrden,
                total: Number(o.total) || 0,
                fechaOrden: o.fechaOrden
            }));

            const conteoClientes: Record<string, number> = {};
            ordenesValidas.forEach(o => {
                if (o.clienteId) conteoClientes[o.clienteId] = (conteoClientes[o.clienteId] || 0) + 1;
            });

            const clientesOrdenados = Object.entries(conteoClientes).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topClientes = await Promise.all(clientesOrdenados.map(async ([cliId, count]) => {
                try {
                    const { resource: cli } = await container.item(cliId, "cliente").read();
                    return { nombres: cli?.nombres || cliId.replace('cli_', ''), cantidadComprada: count };
                } catch (e) { return { nombres: cliId.replace('cli_', ''), cantidadComprada: count }; }
            }));

            context.res = { status: 200, body: { topVentas, topClientes }, headers: { "Content-Type": "application/json" } }; return;
        } catch (error) { context.res = { status: 500, body: { error: `Fallo analítico: ${error.message}` }, headers: { "Content-Type": "application/json" } }; return; }
    }
    
    context.res = { status: 404, body: { error: "Ruta no implementada" }, headers: { "Content-Type": "application/json" } };
};

export default httpTrigger;