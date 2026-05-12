import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import * as jwt from "jsonwebtoken";

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "ClaveSecretaOpticaPrd2026";

const client = new CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const path = req.params.path;

    // 1. AUTENTICACIÓN
    if (path === "login" && req.method === "POST") {
        const { usuario, password } = req.body;
        if (usuario === "admin" && password === "OpticaSegura2026*") {
            const token = jwt.sign({ user: "admin", role: "optometra" }, JWT_SECRET, { expiresIn: "12h" });
            context.res = { status: 200, body: { token } };
            return;
        }
        context.res = { status: 401, body: { error: "Credenciales de acceso no válidas" } };
        return;
    }

    // VERIFICACIÓN DE IDENTIDAD (JWT)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { status: 401, body: { error: "Firma JWT inexistente." } };
        return;
    }
    const token = authHeader.split(" ")[1];
    try { jwt.verify(token, JWT_SECRET); } 
    catch (err) { context.res = { status: 401, body: { error: "Firma expirada o adulterada." } }; return; }

    // 2. RECUPERACIÓN DE HISTORIAL
    if (path === "cliente" && req.method === "GET") {
        const dni = req.query.dni;
        if (!dni) { context.res = { status: 400, body: { error: "Parámetro de búsqueda omitido" } }; return; }
        try {
            const { resource: cliente } = await container.item(`cli_${dni}`, "cliente").read();
            if (!cliente) { context.res = { status: 404, body: { error: "Expediente no localizado" } }; return; }

            const querySpec = {
                query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId ORDER BY c.fechaOrden DESC",
                parameters: [{ name: "@cliId", value: `cli_${dni}` }]
            };
            const { resources: ordenes } = await container.items.query(querySpec).fetchAll();
            context.res = { status: 200, body: { cliente, ordenes } };
            return;
        } catch (e) { context.res = { status: 500, body: { error: "Saturación transaccional" } }; return; }
    }

    // 3. PERSISTENCIA DE VENTAS
    if (path === "venta" && req.method === "POST") {
        const payload = req.body;
        const { dni, nombres, refraccion, aCuenta, saldo, montura, tipoTrabajo, tratado, fechaEntrega } = payload;
        if (!dni || !nombres) { context.res = { status: 400, body: { error: "Campos primarios omitidos" } }; return; }

        const timestamp = new Date().toISOString();
        try {
            const clienteObj = {
                id: `cli_${dni}`, tipo: "cliente", dni, nombres,
                direccion: payload.direccion || "", telefono: payload.telefono || "", fechaRegistro: timestamp
            };
            await container.items.upsert(clienteObj);

            const numeroOrden = `ORD-${Date.now().toString().slice(-6)}`;
            const ordenObj = {
                id: `ord_${numeroOrden}`, tipo: "orden", numeroOrden, fechaOrden: timestamp, clienteId: `cli_${dni}`,
                montura: montura || "", tipoTrabajo: tipoTrabajo || "", tratado: tratado || "", refraccion,
                aCuenta: Number(aCuenta || 0), saldo: Number(saldo || 0), total: Number(aCuenta || 0) + Number(saldo || 0),
                fechaEntrega: fechaEntrega || "", vendedor: "Admin"
            };
            await container.items.create(ordenObj);
            context.res = { status: 201, body: { mensaje: "Transacción confirmada", numeroOrden, cliente: clienteObj } };
            return;
        } catch (e) { context.res = { status: 500, body: { error: "Fallo de persistencia" } }; return; }
    }

    // 4. TELEMETRÍA DE NEGOCIO
    if (path === "dashboard" && req.method === "GET") {
        try {
            const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const queryVentas = {
                query: `SELECT TOP 5 c.numeroOrden, c.total FROM c WHERE c.tipo = 'orden' AND c.fechaOrden >= @inicioMes ORDER BY c.total DESC`,
                parameters: [{ name: "@inicioMes", value: primerDiaMes }]
            };
            const { resources: topVentas } = await container.items.query(queryVentas).fetchAll();

            const queryClientes = {
                query: `SELECT TOP 5 c.clienteId, COUNT(1) as cantidadComprada, SUM(c.total) as volumenTotal FROM c WHERE c.tipo = 'orden' GROUP BY c.clienteId ORDER BY COUNT(1) DESC`
            };
            const { resources: topClientesRaw } = await container.items.query(queryClientes).fetchAll();
            const topClientes = await Promise.all(topClientesRaw.map(async (item) => {
                try {
                    const { resource: cli } = await container.item(item.clienteId, "cliente").read();
                    return { nombres: cli ? cli.nombres : item.clienteId, cantidadComprada: item.cantidadComprada };
                } catch(e) { return { nombres: item.clienteId, cantidadComprada: item.cantidadComprada }; }
            }));

            context.res = { status: 200, body: { topVentas, topClientes } };
            return;
        } catch (error) { context.res = { status: 500, body: { error: "Fallo analítico" } }; return; }
    }

    context.res = { status: 404, body: { error: "Firma de API inoperante" } };
};

export default httpTrigger;