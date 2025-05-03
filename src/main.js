import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createApp } from "vue";
import App from "./App.vue";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const discordSdk = new DiscordSDK(CLIENT_ID);

const setupDiscordSdk = async () => {
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "guilds.members.read",
      "connections",
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

const getUser = async (accessToken) => {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    }
  });

  if (response.ok)
    return (await response.json());
  else
    return null;
}

const getHamsterHubData = async (userId) => {
  const response = await fetch(`/.proxy/api/hamsterHub/user?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
  });

  if (response.ok)
    return await response.json();
  else
    return null;
}

const loginDiscord = async (discordId, nickname, username, email) => {
  const response = await fetch("/.proxy/api/loginDiscord", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      discordId,
      nickname,
      username,
      email
    }),
  });

  if (response.ok)
    return await response.json();
  else
    return null;
}


setupDiscordSdk().then(async (auth) => {
  if (auth) {
    const accessToken = auth["access_token"];

    window._requestBaseApi = `${CLIENT_ID}.discordsays.com/.proxy/api`;

    try {
      const { email } = await getUser(accessToken);
      const { username, nickname, id } = await getHamsterHubData(auth.user.id);

      // window._nickname = nickname;
      // window._username = username;
      // window._userId = id;
      // window._email = email;

      const loginData = await loginDiscord(id, nickname, username, email);
      window._loginData = JSON.stringify(loginData);
    } catch (err) {
      console.error("Background user init failed:", err);
    }
  } else {
    discordSdk.close(4001, "User not authorized");
  }
});

createApp(App).mount("#app");