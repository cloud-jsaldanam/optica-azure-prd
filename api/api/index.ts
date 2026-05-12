import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import * as jwt from "jsonwebtoken";

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
// Constante inyectada directamente en memoria para garantizar consistencia criptográfica
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";

const client = new CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const path = context.bindingData?.path || req.params?.path;

    // 1. ENDPOINT: LOGIN Y VALIDACIÓN
    if (path === "login" && req.method === "POST") {
        try {
            const { usuario, password } = req.body || {};
            if (usuario === "admin" && password === "OpticaSegura2026*") {
                const token = jwt.sign(
                    { user: "admin", role: "optometra", ts: Date.now() }, 
                    JWT_SECRET_CORE, 
                    { expiresIn: "24h" }
                );
                context.res = { 
                    status: 200, 
                    body: { token },
                    headers: { "Content-Type": "application/json" }
                };
                return;
            }
            context.res = { status: 401, body: { error: "Credenciales de acceso no válidas" } };
        } catch (err) {
            context.res = { status: 500, body: { error: "Fallo transaccional durante la autenticación" } };
        }
        return;
    }

    // CAPA MIDDLEWARE: INTERCEPCIÓN Y VALIDACIÓN DE TOKENS JWT
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { status: 401, body: { error: "Acceso denegado. Se requiere un token de sesión activo." } };
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        // Validación estricta contra la misma firma en memoria
        jwt.verify(token, JWT_SECRET_CORE);
    } catch (err) {
        context.res = { status: 401, body: { error: "Firma de sesión expirada o corrupta." } };
        return;
    }

    // 2. ENDPOINT: RECUPERACIÓN DE HISTORIAL DE CLIENTE (MÓDULO 2)
    if (path === "cliente" && req.method === "GET") {
        const dni = req.query?.dni?.trim();
        if (!dni) {
            context.res = { status: 400, body: { error: "Parámetro de identificación requerido" } };
            return;
        }
        try {
            const { resource: cliente } = await container.item(`cli_${dni}`, "cliente").read();
            const querySpec = {
                query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId ORDER BY c.fechaOrden DESC",
                parameters: [{ name: "@cliId", value: `cli_${dni}` }]
            };
            const { resources: ordenes } = await container.items.query(querySpec).fetchAll();
            
            // Si no existe el cliente pero sí se hace la búsqueda, devolvemos 200 con arrays vacíos para no quebrar la UI
            context.res = { 
                status: 200, 
                body: { 
                    cliente: cliente || null, 
                    ordenes: ordenes || [] 
                } 
            };
            return;
        } catch (e) {
            context.res = { status: 500, body: { error: "Fallo de conexión con el repositorio Cosmos DB" } };
            return;
        }
    }

    // 3. ENDPOINT: PERSISTENCIA TRANSACCIONAL DE VENTAS (MÓDULO 1)
    if (path === "venta" && req.method === "POST") {
        const payload = req.body || {};
        const { dni, nombres, refraccion, aCuenta, saldo, montura, tipoTrabajo, tratado, fechaEntrega, total } = payload;
        
        if (!dni || !nombres) {
            context.res = { status: 400, body: { error: "Los datos primarios del paciente son obligatorios" } };
            return;
        }
        const timestamp = new Date().toISOString();
        try {
            // Upsert del Cliente
            const clienteObj = {
                id: `cli_${dni}`, 
                tipo: "cliente", 
                dni, 
                nombres,
                direccion: payload.direccion || "", 
                telefono: payload.telefono || "", 
                fechaRegistro: timestamp
            };
            await container.items.upsert(clienteObj);

            // Creación de la Orden
            const numeroOrden = `ORD-${Date.now().toString().slice(-6)}`;
            const ordenObj = {
                id: `ord_${numeroOrden}`, 
                tipo: "orden", 
                numeroOrden, 
                fechaOrden: timestamp, 
                clienteId: `cli_${dni}`,
                montura: montura || "", 
                tipoTrabajo: tipoTrabajo || "", 
                tratado: tratado || "", 
                refraccion: refraccion || null,
                aCuenta: Number(aCuenta || 0), 
                saldo: Number(saldo || 0), 
                total: Number(total || 0),
                fechaEntrega: fechaEntrega || "", 
                vendedor: "Admin"
            };
            await container.items.create(ordenObj);
            
            context.res = { 
                status: 201, 
                body: { mensaje: "Venta registrada exitosamente", numeroOrden, cliente: clienteObj } 
            };
            return;
        } catch (e) {
            context.res = { status: 500, body: { error: "Error de persistencia al escribir en la base de datos" } };
            return;
        }
    }

    // 4. ENDPOINT: DASHBOARD
    if (path === "dashboard" && req.method === "GET") {
        try {
            const queryVentas = {
                query: "SELECT TOP 5 c.numeroOrden, c.total, c.fechaOrden FROM c WHERE c.tipo = 'orden' ORDER BY c.fechaOrden DESC"
            };
            const { resources: topVentas } = await container.items.query(queryVentas).fetchAll();

            const queryClientes = {
                query: "SELECT TOP 5 c.clienteId, COUNT(1) as cantidadComprada FROM c WHERE c.tipo = 'orden' GROUP BY c.clienteId ORDER BY COUNT(1) DESC"
            };
            const { resources: topClientesRaw } = await container.items.query(queryClientes).fetchAll();
            
            const topClientes = await Promise.all(topClientesRaw.map(async (item) => {
                try {
                    const { resource: cli } = await container.item(item.clienteId, "cliente").read();
                    return { nombres: cli?.nombres || item.clienteId, cantidadComprada: item.cantidadComprada };
                } catch (e) {
                    return { nombres: item.clienteId, cantidadComprada: item.cantidadComprada };
                }
            }));

            context.res = { status: 200, body: { topVentas, topClientes } };
            return;
        } catch (error) {
            context.res = { status: 500, body: { error: "Error de procesamiento analítico" } };
            return;
        }
    }

    context.res = { status: 404, body: { error: "Endpoint no mapeado en el enrutador" } };
};

export default httpTrigger;