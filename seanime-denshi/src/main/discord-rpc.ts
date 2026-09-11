import { ipcMain } from "electron"
import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as net from "node:net"
import * as path from "node:path"
import type { DenshiSettings } from "./denshi-settings"
import { log } from "./logging"

const DISCORD_APP_ID = "1224777421941899285"

const OP_HANDSHAKE = 0
const OP_FRAME = 1
const OP_CLOSE = 2
const OP_PING = 3
const OP_PONG = 4

export type DiscordRpcSettingsAccess = {
    get: () => DenshiSettings
}

let socket: net.Socket | null = null
let isConnected = false
let isConnecting = false
let pendingActivity: any = null
let incomingBuffer = Buffer.alloc(0)

function encodePacket(opcode: number, payload: unknown): Buffer {
    const jsonStr = JSON.stringify(payload)
    const jsonBuf = Buffer.from(jsonStr, "utf-8")
    const packet = Buffer.alloc(8 + jsonBuf.length)
    packet.writeInt32LE(opcode, 0)
    packet.writeInt32LE(jsonBuf.length, 4)
    jsonBuf.copy(packet, 8)
    return packet
}

function getPossiblePipePaths(): string[] {
    const paths: string[] = []
    if (process.platform === "win32") {
        for (let i = 0; i < 10; i++) {
            paths.push(`\\\\.\\pipe\\discord-ipc-${i}`)
            paths.push(`\\\\?\\pipe\\discord-ipc-${i}`)
        }
        return paths
    }

    const dirs = [
        process.env.XDG_RUNTIME_DIR,
        process.env.TMPDIR,
        process.env.TMP,
        process.env.TEMP,
        "/tmp",
    ].filter((dir): dir is string => Boolean(dir))

    for (const dir of dirs) {
        for (let i = 0; i < 10; i++) {
            const socketPath = path.join(dir, `discord-ipc-${i}`)
            try {
                if (fs.existsSync(socketPath)) {
                    paths.push(socketPath)
                }
            }
            catch {
                // Ignore filesystem access errors
            }
        }
    }

    return paths
}

async function tryConnect(): Promise<boolean> {
    if (isConnected || isConnecting) return isConnected

    isConnecting = true
    const pipePaths = getPossiblePipePaths()

    for (const pipePath of pipePaths) {
        try {
            const client = await new Promise<net.Socket | null>((resolve) => {
                let settled = false
                const s = net.createConnection(pipePath, () => {
                    if (!settled) {
                        settled = true
                        s.setTimeout(0)
                        resolve(s)
                    }
                })

                s.once("error", () => {
                    if (!settled) {
                        settled = true
                        s.destroy()
                        resolve(null)
                    }
                })

                s.setTimeout(1500, () => {
                    if (!settled) {
                        settled = true
                        s.destroy()
                        resolve(null)
                    }
                })
            })

            if (client) {
                socket = client
                setupSocketListeners(socket)

                // Send Handshake
                const handshake = encodePacket(OP_HANDSHAKE, {
                    v: 1,
                    client_id: DISCORD_APP_ID,
                })
                socket.write(handshake)
                log.info("[DiscordRPC] Connected to Discord pipe at", pipePath)
                isConnecting = false
                return true
            }
        }
        catch {
            // Continue trying next path
        }
    }

    isConnecting = false
    return false
}

function setupSocketListeners(s: net.Socket): void {
    incomingBuffer = Buffer.alloc(0)

    s.on("data", (chunk: Buffer) => {
        incomingBuffer = Buffer.concat([incomingBuffer, chunk])

        while (incomingBuffer.length >= 8) {
            const opcode = incomingBuffer.readInt32LE(0)
            const length = incomingBuffer.readInt32LE(4)

            if (incomingBuffer.length < 8 + length) {
                break
            }

            const bodyBuf = incomingBuffer.subarray(8, 8 + length)
            incomingBuffer = incomingBuffer.subarray(8 + length)

            try {
                const message = JSON.parse(bodyBuf.toString("utf-8"))
                handleSocketMessage(opcode, message)
            }
            catch (e) {
                log.warn("[DiscordRPC] Error parsing response from Discord:", e)
            }
        }
    })

    s.on("close", () => {
        log.info("[DiscordRPC] Disconnected from Discord")
        resetState()
    })

    s.on("error", (err) => {
        log.debug("[DiscordRPC] Socket error:", err.message)
        resetState()
    })
}

function handleSocketMessage(opcode: number, message: any): void {
    if (opcode === OP_FRAME) {
        if (message.evt === "READY") {
            log.info("[DiscordRPC] Client ready for activity updates")
            isConnected = true
            if (pendingActivity) {
                sendActivityPacket(pendingActivity)
            }
        }
        else if (message.evt === "ERROR") {
            log.warn("[DiscordRPC] Discord reported error:", message.data?.message || message)
        }
    }
    else if (opcode === OP_CLOSE) {
        log.info("[DiscordRPC] Discord requested connection close")
        resetState()
    }
    else if (opcode === OP_PING) {
        if (socket && !socket.destroyed) {
            socket.write(encodePacket(OP_PONG, message.data || {}))
        }
    }
}

function resetState(): void {
    isConnected = false
    isConnecting = false
    incomingBuffer = Buffer.alloc(0)
    if (socket) {
        try {
            socket.destroy()
        }
        catch {
            // Ignore
        }
        socket = null
    }
}

function sendActivityPacket(activity: any): void {
    if (!socket || socket.destroyed || !isConnected) return

    const packet = encodePacket(OP_FRAME, {
        cmd: "SET_ACTIVITY",
        args: {
            pid: process.pid,
            activity: activity,
        },
        nonce: crypto.randomUUID(),
    })

    socket.write(packet, (err) => {
        if (err) {
            log.warn("[DiscordRPC] Failed to send activity packet:", err)
        }
    })
}

export function setDiscordActivity(activity: any, settingsAccess: DiscordRpcSettingsAccess): void {
    const settings = settingsAccess.get()
    // Local server handles its own Discord RPC. Denshi only drives Discord RPC when in external server mode.
    if (settings.serverMode !== "external") {
        if (isConnected || isConnecting) {
            clearDiscordActivity()
            resetState()
        }
        return
    }

    if (!activity) {
        clearDiscordActivity()
        return
    }

    // Clone activity to prevent mutation
    const act = JSON.parse(JSON.stringify(activity))

    // Sanitize and fix button URLs if needed with externalServerUrl
    if (Array.isArray(act.buttons)) {
        act.buttons = act.buttons
            .filter((b: any) => b && typeof b.label === "string" && typeof b.url === "string")
            .map((b: any) => {
                let url = b.url
                if ((!url || url === "") && settings.externalServerUrl) {
                    url = settings.externalServerUrl
                }
                return {
                    label: String(b.label).slice(0, 32),
                    url: url,
                }
            })
            .filter((b: any) => /^https?:\/\//i.test(b.url))
            .slice(0, 2)

        if (act.buttons.length === 0) {
            delete act.buttons
        }
    }

    log.info("[DiscordRPC] Setting activity for", act.details || act.state || "unknown")
    pendingActivity = act

    if (!isConnected) {
        tryConnect().catch((err) => {
            log.debug("[DiscordRPC] Failed to connect to Discord:", err)
        })
        return
    }

    sendActivityPacket(act)
}

export function clearDiscordActivity(): void {
    pendingActivity = null
    if (isConnected) {
        sendActivityPacket(null)
    }
}

export function disposeDiscordRpc(): void {
    clearDiscordActivity()
    resetState()
}

export function registerDiscordRpcIpc(settingsAccess: DiscordRpcSettingsAccess): void {
    ipcMain.handle("discord-rpc:setActivity", async (_event, activity: any) => {
        setDiscordActivity(activity, settingsAccess)
        return true
    })

    ipcMain.handle("discord-rpc:clearActivity", async () => {
        clearDiscordActivity()
        return true
    })
}
