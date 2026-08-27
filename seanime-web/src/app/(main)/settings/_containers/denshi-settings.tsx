import { SettingsCard } from "@/app/(main)/settings/_components/settings-card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { TextInput } from "@/components/ui/text-input"
import React from "react"
import { RiSettings3Fill } from "react-icons/ri"
import { toast } from "sonner"

export function DenshiSettings() {

    const [settings, setSettings] = React.useState<DenshiSettings | null>(null)
    const settingsRef = React.useRef<DenshiSettings | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        if (window.electron?.denshiSettings) {
            window.electron.denshiSettings.get().then((s) => {
                setSettings(s)
                settingsRef.current = s
                setLoading(false)
            })
        }
    }, [])

    function updateSetting(key: keyof DenshiSettings, value: boolean | string) {
        if (!settingsRef.current || !window.electron?.denshiSettings) return

        const newSettings = { ...settingsRef.current, [key]: value }
        settingsRef.current = newSettings
        setSettings(newSettings)
        window.electron.denshiSettings.set(newSettings)
    }

    async function saveServerSettings() {
        if (!settingsRef.current || !window.electron?.denshiSettings) return

        try {
            const saved = await window.electron.denshiSettings.set(settingsRef.current)
            settingsRef.current = saved
            setSettings(saved)
            toast.success("Server connection saved. Restart Seanime Denshi to apply it.")
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save server connection")
        }
    }

    if (loading || !settings) {
        return null
    }

    return (
        <div className="space-y-4">
            <SettingsCard title="Server connection">
                <Switch
                    side="right"
                    value={settings.serverMode === "external"}
                    onValueChange={(value) => {
                        const newSettings = { ...settingsRef.current!, serverMode: value ? "external" as const : "local" as const }
                        settingsRef.current = newSettings
                        setSettings(newSettings)
                    }}
                    label="Connect to an external server"
                    help="Use an existing Seanime server instead of starting the bundled local server."
                />
                {settings.serverMode === "external" && (
                    <div className="space-y-3">
                        <TextInput
                            label="External server URL"
                            help="Include http:// or https:// and port when needed. Example: http://192.168.1.20:43211"
                            placeholder="https://seanime.example.com"
                            value={settings.externalServerUrl}
                            onValueChange={(value) => {
                                const newSettings = { ...settingsRef.current!, externalServerUrl: value.trim() }
                                settingsRef.current = newSettings
                                setSettings(newSettings)
                            }}
                        />
                    </div>
                )}
                <Button onClick={saveServerSettings} intent="primary-outline">
                    Save server connection
                </Button>
            </SettingsCard>

            <SettingsCard title="Window">
                <Switch
                    side="right"
                    value={settings.minimizeToTray}
                    onValueChange={(v) => updateSetting("minimizeToTray", v)}
                    label="Minimize to tray on close"
                    help="When enabled, closing the window will minimize the app to the system tray instead of quitting."
                />
                <Switch
                    side="right"
                    value={settings.openInBackground}
                    onValueChange={(v) => updateSetting("openInBackground", v)}
                    label="Open in background"
                    help="When enabled, the app will start hidden. You can show it from the system tray."
                />
            </SettingsCard>

            <SettingsCard title="System">
                <Switch
                    side="right"
                    value={settings.openAtLaunch}
                    onValueChange={(v) => updateSetting("openAtLaunch", v)}
                    label="Open at launch"
                    help={window.electron?.platform === "linux"
                        ? "This feature is not supported on Linux."
                        : "When enabled, the app will start automatically when you log in to your computer."}
                    disabled={window.electron?.platform === "linux"}
                />
            </SettingsCard>

            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 border border-gray-200 dark:border-gray-800 border-dashed">
                <RiSettings3Fill className="text-base" />
                <span>Settings are saved automatically and applied after a restart</span>
            </div>
        </div>
    )
}
