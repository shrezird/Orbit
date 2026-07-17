# Discord Rich Presence for Orbit

Shows what you're doing in Orbit as your Discord status: the board you're
on, the card you're viewing or editing, list/card counts, and elapsed time.

No dependencies — the plugin talks to the Discord desktop app directly over
its local IPC pipe.

## Setup (about 2 minutes)

1. The Discord **desktop app** must be running on this machine.
2. Discord needs a (free) application so the presence has a name:
   - Open <https://discord.com/developers/applications>
   - **New Application** → name it `Orbit` (this is the name Discord shows)
   - Copy the **Application ID** from *General Information*
   - Optional: under *Rich Presence → Art Assets*, upload an image with the
     name `orbit` — it becomes the large presence icon
3. Put the Application ID in `data/plugins/discord-rpc/data.json`:
   `{ "client_id": "123...", "enabled": true }` — then restart Orbit
   (or toggle the plugin off and on in the Plugins menu).
4. **Click the connection icon** in the topbar to toggle the presence on/off.

Connection icon colors: **green** = connected, **yellow** = connecting /
waiting for Discord, **red** = off or disconnected (including when the
application ID hasn't been set yet).

## What it shows

| Where you are    | Details line    | State line              |
|------------------|-----------------|-------------------------|
| Home screen      | Browsing boards | N boards                |
| A board          | Board: (name)   | N lists · M cards       |
| A card open      | Board: (name)   | Viewing card: (title)   |
| Editing a card   | Board: (name)   | Editing card: (title)   |

The elapsed timer shows time since Orbit started.

> **Privacy note:** your board and card names become part of your Discord
> status, visible to anyone who can see your profile. Toggle the badge off
> whenever that's not what you want.

## Config keys (`data.json`)

| Key           | Default     | Meaning                                        |
|---------------|-------------|------------------------------------------------|
| `enabled`     | `true`      | Presence on/off (badge click toggles this)     |
| `client_id`   | `""`        | Your Discord application ID (required)         |
| `timer_mode`  | `"session"` | `"board"` resets the timer on board switch     |
| `large_image` | `"orbit"`   | Art-asset key for the large icon; `""` = none  |
