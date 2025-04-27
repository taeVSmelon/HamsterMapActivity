import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createApp } from "vue";
import App from "./App.vue";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const discordSdk = new DiscordSDK(CLIENT_ID);

setupDiscordSdk().then((auth) => {
  console.log("Auth:", auth);
  //   appendVoiceChannelName();
  //   appendUser(auth.user);
  //   appendGuildAvatar(auth.access_token);

  window._requestBaseApi = `${CLIENT_ID}.discordsays.com/.proxy/api`;
  console.log("BaseApi:", window._requestBaseApi);
});

async function setupDiscordSdk() {
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "applications.commands",
    ],
  });

  const response = await fetch("/.proxy/api/discordToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  const auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }

  return auth;
}

createApp(App).mount("#app");
