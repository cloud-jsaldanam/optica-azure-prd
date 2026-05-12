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

    // 1. ENDPOINT: LOGIN
    if (path === "login" && req.method === "POST") {
        try {
            const { usuario, password } = req.body;
            if (usuario === "admin" && password === "OpticaSegura2026*") {
                const token = jwt.sign({ user: "admin" }, JWT_SECRET, { expiresIn: "12h" });
                context.res = { status: 200, body: { token } };
            } else {
                context.res = { status: 401, body: { error: "Credenciales incorrectas" } };
            }
        } catch (err) {
            context.res = { status: 500, body: { error: "Fallo en autenticación" } };
        }
        return;
    }

    // MIDDLEWARE DE SEGURIDAD PARA EL RESTO DE RUTAS
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        context.res = { status: 401, body: { error: "Token requerido" } };
        return;
    }

    // 2. ENDPOINT: DASHBOARD
    if (path === "dashboard" && req.method === "GET") {
        try {
            const { resources: topVentas } = await container.items.query("SELECT TOP 5 c.numeroOrden, c.total FROM c WHERE c.tipo = 'orden' ORDER BY c.total DESC").fetchAll();
            context.res = { status: 200, body: { topVentas, topClientes: [] } };
        } catch (error) {
            context.res = { status: 500, body: { error: "Error en dashboard" } };
        }
        return;
    }

    // 3. ENDPOINT: REGISTRO VENTA
    if (path === "venta" && req.method === "POST") {
        try {
            const item = { 
                ...req.body, 
                id: `ord_${Date.now()}`, 
                tipo: "orden", 
                fechaOrden: new Date().toISOString() 
            };
            await container.items.create(item);
            context.res = { status: 201, body: { mensaje: "Venta registrada" } };
        } catch (e) {
            context.res = { status: 500, body: { error: "Error al guardar" } };
        }
        return;
    }

    context.res = { status: 404, body: { error: "Ruta no encontrada" } };
};

export default httpTrigger;