import { useWebsocketMessageListener } from "@/app/(main)/_hooks/handle-websockets"
import { WSEvents } from "@/lib/server/ws-events"
import { __isElectronDesktop__ } from "@/types/constants"
import React from "react"

export function useDiscordRpcListener() {
    useWebsocketMessageListener<any>({
        type: WSEvents.DISCORD_PRESENCE_UPDATED,
        onMessage: (activity) => {
            if (!__isElectronDesktop__) return
            if (window.electron?.discordRpc) {
                window.electron.discordRpc.setActivity(activity)
            }
        },
    })

    useWebsocketMessageListener({
        type: WSEvents.DISCORD_PRESENCE_CLEARED,
        onMessage: () => {
            if (!__isElectronDesktop__) return
            if (window.electron?.discordRpc) {
                window.electron.discordRpc.clearActivity()
            }
        },
    })

    // Clean up activity when window unmounts
    React.useEffect(() => {
        return () => {
            if (__isElectronDesktop__ && window.electron?.discordRpc) {
                window.electron.discordRpc.clearActivity()
            }
        }
    }, [])
}
