import { SettingsCard } from "@/app/(main)/settings/_components/settings-card"
import { cn } from "@/components/ui/core/styling"
import { Field } from "@/components/ui/form"
import React from "react"
import { useFormContext } from "react-hook-form"

type DiscordRichPresenceSettingsProps = {
    children?: React.ReactNode
}

export function DiscordRichPresenceSettings(props: DiscordRichPresenceSettingsProps) {

    const {
        children,
        ...rest
    } = props

    const { watch } = useFormContext()

    const enableRichPresence = watch("enableRichPresence")
    const richPresenceShowServerUrlButton = watch("richPresenceShowServerUrlButton")

    return (
        <>
            <SettingsCard title="Rich Presence" description="Show what you are watching or reading in Discord.">
                <div className="space-y-3">
                    <Field.Switch
                        side="right"
                        name="enableRichPresence"
                        label={<span className="flex gap-1 items-center">Enable</span>}
                    />
                    <div
                        className={cn(
                            "flex gap-4 items-center flex-col md:flex-row !mt-3",
                            enableRichPresence ? "opacity-100" : "opacity-50 pointer-events-none",
                        )}
                    >
                        <Field.Checkbox
                            name="enableAnimeRichPresence"
                            label="Anime"
                            fieldClass="w-fit"
                        />
                        <Field.Checkbox
                            name="enableMangaRichPresence"
                            label="Manga"
                            fieldClass="w-fit"
                        />
                    </div>
                </div>

                <Field.Switch
                    side="right"
                    name="richPresenceHideSeanimeRepositoryButton"
                    label="Hide Seanime Repository Button"
                />

                {/*<Field.Switch*/}
                {/*    side="right"*/}
                {/*    name="richPresenceShowAniListMediaButton"*/}
                {/*    label="Show AniList Media Button"*/}
                {/*    help="Show a button to open the media page on AniList."*/}
                {/*/>*/}

                <Field.Switch
                    side="right"
                    name="richPresenceShowAniListProfileButton"
                    label="Show AniList Profile Button"
                    help="Show a button to open your profile page on AniList."
                />

                <Field.Switch
                    side="right"
                    name="richPresenceShowServerUrlButton"
                    label="Show Server URL Button"
                    help="Show a button in Discord Rich Presence linking to your server URL."
                />

                {richPresenceShowServerUrlButton && (
                    <Field.Text
                        name="richPresenceServerUrl"
                        label="Server URL"
                        placeholder="https://seanime.example.com"
                        help="The URL that the button will open. If left empty, the external server address will be used."
                    />
                )}

                {/*<Field.Switch*/}
                {/*    side="right"*/}
                {/*    name="richPresenceUseMediaTitleStatus"*/}
                {/*    label={<span className="flex gap-2 items-center">Use Media Title as Status <LuTriangleAlert className="text-[--orange]" /></span>}*/}
                {/*    moreHelp="Does not work with the default Discord Desktop Client."*/}
                {/*    help="Replace 'Seanime' with the media title in the activity status. Only works if you use a discord client that utilizes arRPC."*/}
                {/*/>*/}
            </SettingsCard>
        </>
    )
}
