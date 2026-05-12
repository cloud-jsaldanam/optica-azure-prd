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
const JWT_SECRET_CORE = "ClaveSecretaOpticaPrd2026_FirmaEstable";
const client = new cosmos_1.CosmosClient({ endpoint, key });
const container = client.database("OpticaDB").container("Registros");
// Catálogo multi-usuario para trazabilidad en clínica
const USUARIOS_AUTORIZADOS = {
    "admin": { pass: "OpticaSegura2026*", nombre: "Administrador Principal" },
    "optometra1": { pass: "ClinicaLima2026*", nombre: "Optómetra - Módulo 1" },
    "optometra2": { pass: "ClinicaLima2026*", nombre: "Optómetra - Módulo 2" }
};
const httpTrigger = function (context, req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const path = ((_a = context.bindingData) === null || _a === void 0 ? void 0 : _a.path) || ((_b = req.params) === null || _b === void 0 ? void 0 : _b.path);
        // 1. ENDPOINT: AUTENTICACIÓN MULTI-USUARIO
        if (path === "login" && req.method === "POST") {
            try {
                const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                const usuario = (_c = payload.usuario) === null || _c === void 0 ? void 0 : _c.trim();
                const password = (_d = payload.password) === null || _d === void 0 ? void 0 : _d.trim();
                const userMeta = USUARIOS_AUTORIZADOS[usuario];
                if (userMeta && password === userMeta.pass) {
                    const token = jwt.sign({ user: usuario, nombre: userMeta.nombre, role: "especialista", ts: Date.now() }, JWT_SECRET_CORE, { expiresIn: "24h" });
                    context.res = { status: 200, body: { token, usuario: userMeta.nombre }, headers: { "Content-Type": "application/json" } };
                    return;
                }
                context.res = { status: 401, body: { error: "Credenciales de acceso no autorizadas" }, headers: { "Content-Type": "application/json" } };
            }
            catch (err) {
                context.res = { status: 500, body: { error: "Fallo del servidor al procesar la identidad" }, headers: { "Content-Type": "application/json" } };
            }
            return;
        }
        // MIDDLEWARE DE AUTORIZACIÓN (Prioridad a x-optica-auth)
        const authHeader = ((_e = req.headers) === null || _e === void 0 ? void 0 : _e['x-optica-auth']) || ((_f = req.headers) === null || _f === void 0 ? void 0 : _f.authorization);
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            context.res = { status: 401, body: { error: "Sesión denegada. Token ausente o formato inválido." }, headers: { "Content-Type": "application/json" } };
            return;
        }
        let sesionActual;
        try {
            sesionActual = jwt.verify(authHeader.split(" ")[1], JWT_SECRET_CORE);
        }
        catch (err) {
            context.res = { status: 401, body: { error: `Firma rechazada: ${err.message}` }, headers: { "Content-Type": "application/json" } };
            return;
        }
        // 2. ENDPOINT: DIRECTORIO GLOBAL
        if (path === "clientes" && req.method === "GET") {
            try {
                const { resources: clientes } = yield container.items
                    .query("SELECT c.dni, c.nombres, c.telefono, c.direccion FROM c WHERE c.tipo = 'cliente' ORDER BY c.nombres ASC")
                    .fetchAll();
                context.res = { status: 200, body: { clientes }, headers: { "Content-Type": "application/json" } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: "Error de lectura en base de datos" }, headers: { "Content-Type": "application/json" } };
                return;
            }
        }
        // 3. ENDPOINT: CONSULTA DE EXPEDIENTE
        if (path === "cliente" && req.method === "GET") {
            const dni = (_h = (_g = req.query) === null || _g === void 0 ? void 0 : _g.dni) === null || _h === void 0 ? void 0 : _h.trim();
            if (!dni) {
                context.res = { status: 400, body: { error: "DNI requerido" }, headers: { "Content-Type": "application/json" } };
                return;
            }
            try {
                const { resource: cliente } = yield container.item(`cli_${dni}`, "cliente").read();
                const { resources: ordenes } = yield container.items
                    .query({
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cliId ORDER BY c.fechaOrden DESC",
                    parameters: [{ name: "@cliId", value: `cli_${dni}` }]
                }).fetchAll();
                context.res = { status: 200, body: { cliente: cliente || null, ordenes: ordenes || [] }, headers: { "Content-Type": "application/json" } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: "Error consultando el repositorio" }, headers: { "Content-Type": "application/json" } };
                return;
            }
        }
        // 4. ENDPOINT: CREACIÓN DE ORDEN CON TRAZABILIDAD
        if (path === "venta" && req.method === "POST") {
            try {
                const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                if (!payload.dni || !payload.nombres) {
                    context.res = { status: 400, body: { error: "Datos primarios obligatorios" }, headers: { "Content-Type": "application/json" } };
                    return;
                }
                const timestamp = new Date().toISOString();
                const clienteObj = { id: `cli_${payload.dni}`, tipo: "cliente", dni: payload.dni, nombres: payload.nombres, direccion: payload.direccion || "", telefono: payload.telefono || "", fechaRegistro: timestamp };
                yield container.items.upsert(clienteObj);
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
                yield container.items.create(ordenObj);
                context.res = { status: 201, body: { mensaje: "Transacción guardada con éxito", numeroOrden, cliente: clienteObj }, headers: { "Content-Type": "application/json" } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: "Error de escritura en Cosmos DB" }, headers: { "Content-Type": "application/json" } };
                return;
            }
        }
        // 5. ENDPOINT: ELIMINACIÓN DE REGISTROS ERRÓNEOS
        if (path === "venta" && req.method === "DELETE") {
            const idOrden = (_k = (_j = req.query) === null || _j === void 0 ? void 0 : _j.id) === null || _k === void 0 ? void 0 : _k.trim();
            const partitionKey = (_m = (_l = req.query) === null || _l === void 0 ? void 0 : _l.pk) === null || _m === void 0 ? void 0 : _m.trim(); // Requiere el id de partición (tipo)
            if (!idOrden) {
                context.res = { status: 400, body: { error: "Identificador de orden requerido para eliminación" }, headers: { "Content-Type": "application/json" } };
                return;
            }
            try {
                yield container.item(idOrden, partitionKey || "orden").delete();
                context.res = { status: 200, body: { mensaje: "Registro eliminado de la auditoría exitosamente" }, headers: { "Content-Type": "application/json" } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: "No se pudo eliminar el documento de Cosmos DB" }, headers: { "Content-Type": "application/json" } };
                return;
            }
        }
        // 6. ENDPOINT: DASHBOARD
        if (path === "dashboard" && req.method === "GET") {
            try {
                const { resources: topVentas } = yield container.items.query("SELECT TOP 5 c.numeroOrden, c.total, c.fechaOrden FROM c WHERE c.tipo = 'orden' ORDER BY c.fechaOrden DESC").fetchAll();
                const { resources: topClientesRaw } = yield container.items.query("SELECT TOP 5 c.clienteId, COUNT(1) as cantidadComprada FROM c WHERE c.tipo = 'orden' GROUP BY c.clienteId ORDER BY COUNT(1) DESC").fetchAll();
                const topClientes = yield Promise.all(topClientesRaw.map((item) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const { resource: cli } = yield container.item(item.clienteId, "cliente").read();
                        return { nombres: (cli === null || cli === void 0 ? void 0 : cli.nombres) || item.clienteId, cantidadComprada: item.cantidadComprada };
                    }
                    catch (e) {
                        return { nombres: item.clienteId, cantidadComprada: item.cantidadComprada };
                    }
                })));
                context.res = { status: 200, body: { topVentas, topClientes }, headers: { "Content-Type": "application/json" } };
                return;
            }
            catch (error) {
                context.res = { status: 500, body: { error: "Fallo en motor analítico" }, headers: { "Content-Type": "application/json" } };
                return;
            }
        }
        context.res = { status: 404, body: { error: "Firma de API solicitada no implementada" }, headers: { "Content-Type": "application/json" } };
    });
};
exports.default = httpTrigger;
