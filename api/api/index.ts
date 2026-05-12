import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import * as jwt from "jsonwebtoken";

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
// Firma inyectada en memoria para evitar fallos de propagación de variables en ASWA
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";

const client = new CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const path = context.bindingData?.path || req.params?.path;

    // 1. ENDPOINT: AUTENTICACIÓN
    if (path === "login" && req.method === "POST") {
        try {
            // Soportamos tanto envío crudo como parseado por la infraestructura
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const usuario = payload.usuario?.trim();
            const password = payload.password?.trim();

            if (usuario === "admin" && password === "OpticaSegura2026*") {
                const token = jwt.sign({ user: "admin", role: "optometra" }, JWT_SECRET_CORE, { expiresIn: "24h" });
                context.res = { 
                    status: 200, 
                    body: { token }, 
                    headers: { "Content-Type": "application/json" } 
                };
                return;
            }
            context.res = { 
                status: 401, 
                body: { error: "Credenciales de acceso incorrectas" }, 
                headers: { "Content-Type": "application/json" } 
            };
        } catch (err) { 
            context.res = { 
                status: 500, 
                body: { error: "Error interno del servidor al procesar la identidad" }, 
                headers: { "Content-Type": "application/json" } 
            }; 
        }
        return;
    }

    // =========================================================================
    // MIDDLEWARE JWT: PUENTEO DE FILTRO ASWA EDGE
    // Capturamos la cabecera estándar y nuestra alternativa nativa 'x-optica-auth'
    // =========================================================================
    const authHeader = req.headers?.authorization || req.headers?.['x-optica-auth'] || req.headers?.['custom-authorization'];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { 
            status: 401, 
            body: { error: "Acceso denegado. Se requiere un token de sesión activo." }, 
            headers: { "Content-Type": "application/json" } 
        }; 
        return;
    }

    const tokenString = authHeader.split(" ")[1];
    try { 
        jwt.verify(tokenString, JWT_SECRET_CORE); 
    } catch (err) { 
        context.res = { 
            status: 401, 
            body: { error: "Firma de sesión expirada o corrupta." }, 
            headers: { "Content-Type": "application/json" } 
        }; 
        return; 
    }

    // 2. ENDPOINT: DIRECTORIO GLOBAL DE CLIENTES
    if (path === "clientes" && req.method === "GET") {
        try {
            const { resources: clientes } = await container.items
                .query("SELECT c.dni, c.nombres, c.telefono, c.direccion FROM c WHERE c.tipo = 'cliente' ORDER BY c.nombres ASC")
                .fetchAll();
            context.res = { status: 200, body: { clientes }, headers: { "Content-Type": "application/json" } }; 
            return;
        } catch (e) { 
            context.res = { status: 500, body: { error: "Error recuperando directorio global" }, headers: { "Content-Type": "application/json" } }; 
            return; 
        }
    }

    // 3. ENDPOINT: CONSULTA ESPECÍFICA E HISTORIAL
    if (path === "cliente" && req.method === "GET") {
        const dni = req.query?.dni?.trim();
        if (!dni) { 
            context.res = { status: 400, body: { error: "Parámetro DNI requerido" }, headers: { "Content-Type": "application/json" } }; 
            return; 
        }
        try {
            const { resource: cliente } = await container.item(`cli_${dni}`, "cliente").read();
            const { resources: ordenes } = await container.items
                .query({
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId ORDER BY c.fechaOrden DESC",
                    parameters: [{ name: "@cliId", value: `cli_${dni}` }]
                }).fetchAll();
            context.res = { 
                status: 200, 
                body: { cliente: cliente || null, ordenes: ordenes || [] }, 
                headers: { "Content-Type": "application/json" } 
            }; 
            return;
        } catch (e) { 
            context.res = { status: 500, body: { error: "Error de lectura en base de datos" }, headers: { "Content-Type": "application/json" } }; 
            return; 
        }
    }

    // 4. ENDPOINT: TRANSACCIÓN DE VENTA
    if (path === "venta" && req.method === "POST") {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            if (!payload.dni || !payload.nombres) { 
                context.res = { status: 400, body: { error: "Faltan datos primarios del paciente" }, headers: { "Content-Type": "application/json" } }; 
                return; 
            }
            const timestamp = new Date().toISOString();
            
            const clienteObj = {
                id: `cli_${payload.dni}`, 
                tipo: "cliente", 
                dni: payload.dni, 
                nombres: payload.nombres,
                direccion: payload.direccion || "", 
                telefono: payload.telefono || "", 
                fechaRegistro: timestamp
            };
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
                vendedor: "Admin"
            };
            await container.items.create(ordenObj);
            context.res = { 
                status: 201, 
                body: { mensaje: "Venta registrada exitosamente", numeroOrden, cliente: clienteObj }, 
                headers: { "Content-Type": "application/json" } 
            }; 
            return;
        } catch (e) { 
            context.res = { status: 500, body: { error: "Saturación al escribir en Cosmos DB" }, headers: { "Content-Type": "application/json" } }; 
            return; 
        }
    }

    // 5. ENDPOINT: MÉTRICAS Y DASHBOARD
    if (path === "dashboard" && req.method === "GET") {
        try {
            const { resources: topVentas } = await container.items
                .query("SELECT TOP 5 c.numeroOrden, c.total, c.fechaOrden FROM c WHERE c.tipo = 'orden' ORDER BY c.fechaOrden DESC")
                .fetchAll();
                
            const { resources: topClientesRaw } = await container.items
                .query("SELECT TOP 5 c.clienteId, COUNT(1) as cantidadComprada FROM c WHERE c.tipo = 'orden' GROUP BY c.clienteId ORDER BY COUNT(1) DESC")
                .fetchAll();
                
            const topClientes = await Promise.all(topClientesRaw.map(async (item) => {
                try {
                    const { resource: cli } = await container.item(item.clienteId, "cliente").read();
                    return { nombres: cli?.nombres || item.clienteId, cantidadComprada: item.cantidadComprada };
                } catch (e) { 
                    return { nombres: item.clienteId, cantidadComprada: item.cantidadComprada }; 
                }
            }));
            
            context.res = { 
                status: 200, 
                body: { topVentas, topClientes }, 
                headers: { "Content-Type": "application/json" } 
            }; 
            return;
        } catch (error) { 
            context.res = { status: 500, body: { error: "Error procesando analíticas" }, headers: { "Content-Type": "application/json" } }; 
            return; 
        }
    }
    
    context.res = { status: 404, body: { error: "Firma de API solicitada inexistente" }, headers: { "Content-Type": "application/json" } };
};

export default httpTrigger;