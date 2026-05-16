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
const USUARIOS_AUTORIZADOS = {
    "admin": { pass: "OpticaSegura2026*", nombre: "Administrador Principal", role: "admin" },
    "magaly": { pass: "MagalyPrd2026*", nombre: "Magaly", role: "admin" },
    "flor": { pass: "47571420", nombre: "Flor", role: "especialista" }
};
const NOMBRES_MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const NOMBRES_DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const httpTrigger = function (context, req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const path = ((_a = context.bindingData) === null || _a === void 0 ? void 0 : _a.path) || ((_b = req.params) === null || _b === void 0 ? void 0 : _b.path);
        // 1. AUTENTICACIÓN
        if (path === "login" && req.method === "POST") {
            try {
                const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                const usuarioInput = (_c = payload.usuario) === null || _c === void 0 ? void 0 : _c.trim().toLowerCase();
                const passwordInput = (_d = payload.password) === null || _d === void 0 ? void 0 : _d.trim();
                const userMeta = USUARIOS_AUTORIZADOS[usuarioInput];
                if (userMeta && passwordInput === userMeta.pass) {
                    const token = jwt.sign({ user: usuarioInput, nombre: userMeta.nombre, role: userMeta.role, ts: Date.now() }, JWT_SECRET_CORE, { expiresIn: "24h" });
                    context.res = { status: 200, body: { token, usuario: userMeta.nombre, role: userMeta.role }, headers: { "Content-Type": "application/json" } };
                    return;
                }
                context.res = { status: 401, body: { error: "Credenciales incorrectas" } };
            }
            catch (err) {
                context.res = { status: 500, body: { error: "Error login" } };
            }
            return;
        }
        // MIDDLEWARE DE SEGURIDAD
        const authHeader = ((_e = req.headers) === null || _e === void 0 ? void 0 : _e['x-optica-auth']) || ((_f = req.headers) === null || _f === void 0 ? void 0 : _f.authorization);
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            context.res = { status: 401, body: { error: "No autorizado" } };
            return;
        }
        let sesion;
        try {
            sesion = jwt.verify(authHeader.split(" ")[1], JWT_SECRET_CORE);
        }
        catch (err) {
            context.res = { status: 401, body: { error: "Token inválido" } };
            return;
        }
        // 2. DIRECTORIO GLOBAL
        if (path === "clientes" && req.method === "GET") {
            try {
                const { resources: raw } = yield container.items.query("SELECT * FROM c WHERE c.tipo = 'cliente'").fetchAll();
                const clientes = raw.sort((a, b) => (a.nombres || "").localeCompare(b.nombres || ""));
                context.res = { status: 200, body: { clientes } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        // 3. CONSULTA DE EXPEDIENTE
        if (path === "cliente" && req.method === "GET") {
            const dni = (_g = req.query) === null || _g === void 0 ? void 0 : _g.dni;
            try {
                const { resource: cliente } = yield container.item(`cli_${dni}`, "cliente").read();
                const { resources: ordRaw } = yield container.items.query({
                    query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id",
                    parameters: [{ name: "@id", value: `cli_${dni}` }]
                }).fetchAll();
                const ordenes = ordRaw.sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
                context.res = { status: 200, body: { cliente, ordenes } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        // =========================================================================
        // 4. REGISTRO DE VENTA (Actualizado para guardar monturaPrecio y tipoTrabajoPrecio)
        // =========================================================================
        if (path === "venta" && req.method === "POST") {
            try {
                const p = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                const ts = new Date().toISOString();
                // Creación o actualización del paciente
                yield container.items.upsert({ id: `cli_${p.dni}`, tipo: "cliente", dni: p.dni, nombres: p.nombres, direccion: p.direccion, telefono: p.telefono, fechaRegistro: ts });
                // Generación de número de orden
                const num = `ORD-${Date.now().toString().slice(-6)}`;
                // Guardado físico en Cosmos DB (Ahora intercepta los precios desglosados)
                yield container.items.create({
                    id: `ord_${num}`,
                    tipo: "orden",
                    numeroOrden: num,
                    fechaOrden: ts,
                    clienteId: `cli_${p.dni}`,
                    montura: p.montura,
                    monturaPrecio: Number(p.monturaPrecio) || 0, // <-- INYECCIÓN DE DATO FALTANTE
                    tipoTrabajo: p.tipoTrabajo,
                    tipoTrabajoPrecio: Number(p.tipoTrabajoPrecio) || 0, // <-- INYECCIÓN DE DATO FALTANTE
                    tratado: p.tratado,
                    refraccion: p.refraccion,
                    aCuenta: Number(p.aCuenta),
                    saldo: Number(p.saldo),
                    total: Number(p.total),
                    fechaEntrega: p.fechaEntrega,
                    vendedor: sesion.nombre
                });
                context.res = { status: 201, body: { numeroOrden: num } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        // 5. BORRADO EN CASCADA
        if (path === "venta" && req.method === "DELETE") {
            if (sesion.role !== "admin") {
                context.res = { status: 403, body: { error: "Sin permisos" } };
                return;
            }
            const id = (_h = req.query) === null || _h === void 0 ? void 0 : _h.id;
            try {
                if (id.startsWith("ord_")) {
                    const { resource: doc } = yield container.item(id, "orden").read();
                    if (doc) {
                        yield container.item(id, "orden").delete().catch(() => { });
                        const { resources: restantes } = yield container.items.query({
                            query: "SELECT c.id FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cid",
                            parameters: [{ name: "@cid", value: doc.clienteId }]
                        }).fetchAll();
                        if (restantes.length === 0)
                            yield container.item(doc.clienteId, "cliente").delete().catch(() => { });
                    }
                }
                else if (id.startsWith("cli_")) {
                    const { resources: ordenes } = yield container.items.query({
                        query: "SELECT c.id FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id",
                        parameters: [{ name: "@id", value: id }]
                    }).fetchAll();
                    for (const o of ordenes) {
                        yield container.item(o.id, "orden").delete().catch(() => { });
                    }
                    yield container.item(id, "cliente").delete().catch(() => { });
                }
                context.res = { status: 200, body: { mensaje: "Purgado" } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        // 6. DASHBOARD MAESTRO
        if (path === "dashboard" && req.method === "GET") {
            try {
                const { resources: todasOrdenes } = yield container.items.query("SELECT * FROM c WHERE c.tipo = 'orden'").fetchAll();
                const ordenesValidas = todasOrdenes || [];
                const sorted = [...ordenesValidas].sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
                const topRaw = sorted.slice(0, 10);
                const topVentasDetallado = yield Promise.all(topRaw.map((o) => __awaiter(this, void 0, void 0, function* () {
                    let nombreCliente = "Paciente";
                    try {
                        if (o.clienteId) {
                            const { resource: c } = yield container.item(o.clienteId, "cliente").read();
                            if (c && c.nombres)
                                nombreCliente = c.nombres.trim();
                        }
                    }
                    catch (e) { }
                    return {
                        id: o.id,
                        numeroOrden: o.numeroOrden,
                        label: `${o.numeroOrden} | ${nombreCliente}`,
                        total: Number(o.total) || 0,
                        saldo: Number(o.saldo) || 0,
                        fechaOrden: o.fechaOrden
                    };
                })));
                const ahora = new Date();
                const mesActual = ahora.getMonth();
                const anioActual = ahora.getFullYear();
                const ordenesMesActual = ordenesValidas.filter(o => {
                    if (!o.fechaOrden)
                        return false;
                    const d = new Date(o.fechaOrden);
                    return d.getMonth() === mesActual && d.getFullYear() === anioActual;
                });
                const ingresosTotales = ordenesMesActual.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                const ingresosLiquidos = ordenesMesActual.reduce((sum, o) => sum + ((Number(o.total) || 0) - (Number(o.saldo || 0))), 0);
                const totalOrdenes = ordenesMesActual.length;
                const countsMeses = {};
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    countsMeses[key] = 0;
                }
                ordenesValidas.forEach(o => {
                    if (!o.fechaOrden)
                        return;
                    const key = o.fechaOrden.substring(0, 7);
                    if (countsMeses[key] !== undefined)
                        countsMeses[key] += Number(o.total) || 0;
                });
                const analiticaMensual = Object.entries(countsMeses).sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => ({
                    mes: `${NOMBRES_MESES[Number(key.substring(5)) - 1]}`, total: value
                }));
                const countsDias = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
                ordenesValidas.forEach(o => {
                    if (!o.fechaOrden)
                        return;
                    const d = new Date(o.fechaOrden);
                    countsDias[d.getDay()] += Number(o.total) || 0;
                });
                const analiticaDiaria = Object.entries(countsDias).map(([key, value]) => ({
                    dia: NOMBRES_DIAS[Number(key)],
                    cantidad: value
                }));
                context.res = {
                    status: 200,
                    body: {
                        topVentas: topVentasDetallado,
                        kpisMes: { ingresosTotales, ingresosLiquidos, totalOrdenes },
                        analiticaMensual,
                        analiticaDiaria
                    }
                };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
    });
};
exports.default = httpTrigger;
