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
const httpTrigger = function (context, req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const path = ((_a = context.bindingData) === null || _a === void 0 ? void 0 : _a.path) || ((_b = req.params) === null || _b === void 0 ? void 0 : _b.path);
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
        if (path === "cliente" && req.method === "GET") {
            const dni = (_g = req.query) === null || _g === void 0 ? void 0 : _g.dni;
            try {
                const { resource: cliente } = yield container.item(`cli_${dni}`, "cliente").read();
                const { resources: ordRaw } = yield container.items.query({ query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id", parameters: [{ name: "@id", value: `cli_${dni}` }] }).fetchAll();
                const ordenes = ordRaw.sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
                context.res = { status: 200, body: { cliente, ordenes } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        if (path === "venta" && req.method === "POST") {
            try {
                const p = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
                const ts = new Date().toISOString();
                yield container.items.upsert({ id: `cli_${p.dni}`, tipo: "cliente", dni: p.dni, nombres: p.nombres, direccion: p.direccion, telefono: p.telefono, fechaRegistro: ts });
                const num = `ORD-${Date.now().toString().slice(-6)}`;
                yield container.items.create({ id: `ord_${num}`, tipo: "orden", numeroOrden: num, fechaOrden: ts, clienteId: `cli_${p.dni}`, montura: p.montura, tipoTrabajo: p.tipoTrabajo, tratado: p.tratado, refraccion: p.refraccion, aCuenta: Number(p.aCuenta), saldo: Number(p.saldo), total: Number(p.total), fechaEntrega: p.fechaEntrega, vendedor: sesion.nombre });
                context.res = { status: 201, body: { numeroOrden: num } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        // ELIMINACIÓN REFORZADA: Soporta borrar una Orden o borrar un Cliente Completo
        if (path === "venta" && req.method === "DELETE") {
            if (sesion.role !== "admin") {
                context.res = { status: 403, body: { error: "Sin permisos" } };
                return;
            }
            const id = (_h = req.query) === null || _h === void 0 ? void 0 : _h.id; // Puede ser ord_... o cli_...
            try {
                if (id.startsWith("ord_")) {
                    const { resource: doc } = yield container.item(id, "orden").read();
                    yield container.item(id, "orden").delete();
                    // Si era la última orden, borramos al cliente también
                    const { resources: restantes } = yield container.items.query({ query: "SELECT * FROM c WHERE c.tipo = 'orden' AND c.clienteId = @cid", parameters: [{ name: "@id", value: doc.clienteId }] }).fetchAll();
                    if (restantes.length === 0)
                        yield container.item(doc.clienteId, "cliente").delete().catch(() => { });
                }
                else if (id.startsWith("cli_")) {
                    // BORRADO TOTAL POR DNI (NUKE)
                    const { resources: ordenes } = yield container.items.query({ query: "SELECT c.id FROM c WHERE c.tipo = 'orden' AND c.clienteId = @id", parameters: [{ name: "@id", value: id }] }).fetchAll();
                    for (const o of ordenes) {
                        yield container.item(o.id, "orden").delete().catch(() => { });
                    }
                    yield container.item(id, "cliente").delete().catch(() => { });
                }
                context.res = { status: 200, body: { mensaje: "Purgado completo" } };
                return;
            }
            catch (e) {
                context.res = { status: 500, body: { error: e.message } };
                return;
            }
        }
        if (path === "dashboard" && req.method === "GET") {
            try {
                const { resources: ordenes } = yield container.items.query("SELECT * FROM c WHERE c.tipo = 'orden'").fetchAll();
                const sorted = [...ordenes].sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
                const topVentas = sorted.slice(0, 5).map(o => ({ numeroOrden: o.numeroOrden, total: Number(o.total), fechaOrden: o.fechaOrden }));
                const counts = {};
                ordenes.forEach(o => counts[o.clienteId] = (counts[o.clienteId] || 0) + 1);
                const topCli = yield Promise.all(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map((_a) => __awaiter(this, [_a], void 0, function* ([cid, count]) {
                    const { resource: c } = yield container.item(cid, "cliente").read();
                    return { nombres: (c === null || c === void 0 ? void 0 : c.nombres) || cid, cantidadComprada: count };
                })));
                context.res = { status: 200, body: { topVentas, topClientes: topCli } };
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
