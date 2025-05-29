import { DiscordSDK } from "@discord/embedded-app-sdk";
// import { createApp } from "vue";
// import App from "./App.vue";

// document.addEventListener("visibilitychange", function() {
//   if (document.visibilityState === "visible") {
//       console.log("Page is visible");
//       // Try to re-init Unity rendering loop if needed
//   } else {
//       console.log("Page is hidden");
//       // Optionally warn or pause yourself
//   }
// });

const HAMSTER_HUB_GUILD = import.meta.env.HAMSTER_HUB_GUILD;
const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const discordSdk = new DiscordSDK(CLIENT_ID);

const setupDiscordSdk = async () => {
  await discordSdk.ready();

  const state = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: state,
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "guilds.members.read",
      "connections",
      "applications.commands",
      "rpc.activities.write",
      "openid",
      // "activities.read",
      // "activities.write"
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

const isHamsterUser = async () => {
  const context = await discordSdk.commands.getContext();
  console.log("Discord context:", context);

  const guildId = context.guildId;

  return guildId == HAMSTER_HUB_GUILD;
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
      userId: discordId,
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
  if (auth && isHamsterUser()) {
    const accessToken = auth["access_token"];

    window._requestBaseApi = `${CLIENT_ID}.discordsays.com/.proxy/api`;

    try {
      const { email } = await getUser(accessToken);
      const { username, nickname, id, haveRole } = await getHamsterHubData(auth.user.id);

      if (!haveRole) {
        return discordSdk.close(4001, "คุณไม่มียศ 'แฮมสเตอร์'");
      }

      // window._nickname = nickname;
      // window._username = username;
      // window._userId = id;
      // window._email = email;

      const loginData = await loginDiscord(id, nickname, username, email);
      window._loginData = JSON.stringify(loginData);

      // try {
      //   const result = await discordSdk.commands.setActivity({
      //     activity: {
      //       details: "Playing HamsterHub 🐹",      // รายละเอียดกิจกรรม
      //       state: "Battling other hamsters!",     // สถานะย่อย
      //       timestamps: {
      //         start: Date.now()                    // เวลาเริ่ม
      //       },
      //       assets: {
      //         large_image: "embedded_background",        // ใช้ชื่อ key จาก Art Assets
      //         large_text: "HamsterHub Arena",      // hover text บนรูปใหญ่
      //         small_image: "logo",           // รูปเล็ก
      //         small_text: "PvP Mode"               // hover text บนรูปเล็ก
      //       },
      //       buttons: [
      //         // {
      //         //   label: "Play Now",
      //         //   url: "https://discord.com/activities/1359877612054249543"
      //         // },
      //         {
      //           label: "Join Group",
      //           url: "https://discord.gg/NmUSmxAUHc"
      //         }
      //       ]
      //     },
      //     // This marks it as an instance of gameplay (optional)
      //     pid: process.pid
      //   });
      //   console.log("Set activity success:", result);
      // } catch (e) {
      //   console.error("Failed to set activity:", e);
      // }
    } catch (err) {
      console.error("Background user init failed:", err);
    }
  } else if (auth) {
    discordSdk.close(4001, "คุณไม่ได้อยู่ในห้อง Hamster Hub");
  } else {
    discordSdk.close(4001, "คุณไม่ได้ยืนยันตัวตน");
  }
});

// createApp(App).mount("#app");

// if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
//   // Mobile device style: fill the whole browser client area with the game canvas:
//   var meta = document.createElement('meta');
//   meta.name = 'viewport';
//   meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes';
//   document.getElementsByTagName('head')[0].appendChild(meta);

//   var canvas = document.querySelector("#unity-canvas");
//   canvas.style.width = "100%";
//   canvas.style.height = "100%";
//   canvas.style.position = "fixed";

//   document.body.style.textAlign = "left";
// }

createUnityInstance(document.querySelector("#unity-canvas"), {
  arguments: [],
  dataUrl: "/.proxy/api/build/HamsterMap.data",
  frameworkUrl: "/.proxy/api/build/HamsterMap.framework.js",
  codeUrl: "/.proxy/api/build/HamsterMap.wasm",
  // dataUrl: "/.proxy/api/build/HamsterMap.data.br",
  // frameworkUrl: "/.proxy/api/build/HamsterMap.framework.js.br",
  // codeUrl: "/.proxy/api/build/HamsterMap.wasm.br",
  streamingAssetsUrl: "StreamingAssets",
  companyName: "HamsterHub",
  productName: "HamsterMap",
  productVersion: "1.0",
  // matchWebGLToCanvasSize: false, // Uncomment this to separately control WebGL canvas render size and DOM element size.
  // devicePixelRatio: 1, // Uncomment this to override low DPI rendering on high DPI displays.
});