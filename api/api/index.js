"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const cosmos_1 = require("@azure/cosmos");
const jwt = __importStar(require("jsonwebtoken"));
const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
// Constante inyectada directamente en memoria para garantizar consistencia criptográfica
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";
const client = new cosmos_1.CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");
const httpTrigger = function (context, req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const path = ((_a = context.bindingData) === null || _a === void 0 ? void 0 : _a.path) || ((_b = req.params) === null || _b === void 0 ? void 0 : _b.path);
        // 1. ENDPOINT: LOGIN Y VALIDACIÓN
        if (path === "login" && req.method === "POST") {
            try {
                const { usuario, password } = req.body || {};
                if (usuario === "admin" && password === "OpticaSegura2026*") {
                    const token = jwt.sign({ user: "admin", role: "optometra", ts: Date.now() }, JWT_SECRET_CORE, { expiresIn: "24h" });
                    context.res = {
                        status: 200,
                        body: { token },
                        headers: { "Content-Type": "application/json" }
                    };
                    return;
                }
                context.res = { status: 401, body: { error: "Credenciales de acceso no válidas" } };
            }
            catch (err) {
                context.res = { status: 500, body: { error: "Fallo transaccional durante la autenticación" } };
            }
            return;
        }
        // CAPA MIDDLEWARE: INTERCEPCIÓN Y VALIDACIÓN DE TOKENS JWT
        const authHeader = (_c = req.headers) === null || _c === void 0 ? void 0 : _c.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            context.res = { status: 401, body: { error: "Acceso denegado. Se requiere un token de sesión activo." } };
            return;
        }
        const token = authHeader.split(" ")[1];
        try {
            // Validación estricta contra la misma firma en memoria
            jwt.verify(token, JWT_SECRET_CORE);
        }
        catch (err) {
            context.res = { status: 401, body: { error: "Firma de sesión expirada o corrupta." } };
            return;
        }
        // 2. ENDPOINT: RECUPERACIÓN DE HISTORIAL DE CLIENTE (MÓDULO 2)
        if (path === "cliente" && req.method === "GET") {
            const dni = (_e = (_d = req.query) === null || _d === void 0 ? void 0 : _d.dni) === null || _e === void 0 ? void 0 : _e.trim();
            if (!dni) {
                context.res = { status: 400, body: { error: "Parámetro de identificación requerido" } };
                return;
            }
            try {
                const { resource: cliente } = yield container.item(`cli_${dni}`, "cliente").read();
                const querySpec = {
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId ORDER BY c.fechaOrden DESC",
                    parameters: [{ name: "@cliId", value: `cli_${dni}` }]
                };
                const { resources: ordenes } = yield container.items.query(querySpec).fetchAll();
                // Si no existe el cliente pero sí se hace la búsqueda, devolvemos 200 con arrays vacíos para no quebrar la UI
                context.res = {
                    status: 200,
                    body: {
                        cliente: cliente || null,
                        ordenes: ordenes || []
                    }
                };
                return;
            }
            catch (e) {
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
                yield container.items.upsert(clienteObj);
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
                yield container.items.create(ordenObj);
                context.res = {
                    status: 201,
                    body: { mensaje: "Venta registrada exitosamente", numeroOrden, cliente: clienteObj }
                };
                return;
            }
            catch (e) {
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
                const { resources: topVentas } = yield container.items.query(queryVentas).fetchAll();
                const queryClientes = {
                    query: "SELECT TOP 5 c.clienteId, COUNT(1) as cantidadComprada FROM c WHERE c.tipo = 'orden' GROUP BY c.clienteId ORDER BY COUNT(1) DESC"
                };
                const { resources: topClientesRaw } = yield container.items.query(queryClientes).fetchAll();
                const topClientes = yield Promise.all(topClientesRaw.map((item) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const { resource: cli } = yield container.item(item.clienteId, "cliente").read();
                        return { nombres: (cli === null || cli === void 0 ? void 0 : cli.nombres) || item.clienteId, cantidadComprada: item.cantidadComprada };
                    }
                    catch (e) {
                        return { nombres: item.clienteId, cantidadComprada: item.cantidadComprada };
                    }
                })));
                context.res = { status: 200, body: { topVentas, topClientes } };
                return;
            }
            catch (error) {
                context.res = { status: 500, body: { error: "Error de procesamiento analítico" } };
                return;
            }
        }
        context.res = { status: 404, body: { error: "Endpoint no mapeado en el enrutador" } };
    });
};
exports.default = httpTrigger;
