import { WebSocketServer } from "ws";
import { parse } from "url";
import jwt from "jsonwebtoken";
import RaidBoss from "./classes/raid.js";
import userModel from "./models/user.js";
import { JWT_SECRET } from "./middlewares/authenticateToken.js";
import WsUserData from "./classes/wsUserData.js";

const raidClients = new Map(); // ws => username

const broadcast = (clients, payload) => {
  const message = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
};

const calculateOnlineTime = (connectedAt, disconnectedAt, oldOnlineTimeByHour) => {
  if (typeof connectedAt !== 'number' || typeof disconnectedAt !== 'number') {
    throw new Error("connectedAt and disconnectedAt must be timestamps (numbers)");
  }

  const updateFields = {
    $inc: {
      "stats.onlineTime": disconnectedAt - connectedAt
    }
  };

  const onlineDurationByHour = Array(24).fill(0); // วินาทีในแต่ละชั่วโมง

  let connectedDate = new Date(connectedAt);
  const closeDate = new Date(disconnectedAt);

  while (connectedDate < closeDate) {
    const hour = connectedDate.getHours(); // ชั่วโมง 0-23

    const nextHour = new Date(connectedDate);
    nextHour.setHours(hour + 1, 0, 0, 0); // ต้นชั่วโมงถัดไป

    const end = nextHour > closeDate ? closeDate : nextHour;

    const duration = Math.floor((end - connectedDate) / 1000); // วินาที

    onlineDurationByHour[hour] += duration;

    connectedDate = end;
  }

  if (!Array.isArray(oldOnlineTimeByHour) || oldOnlineTimeByHour.length !== 24) {
    for (let hour = 0; hour < 24; hour++) {
      onlineDurationByHour[hour] += oldOnlineTimeByHour[hour.toString()];
    }

    updateFields.$set = { 'stats.onlineTimeByHour': onlineDurationByHour };
  } else {
    for (let hour = 0; hour < 24; hour++) {
      if (onlineDurationByHour[hour] > 0) {
        updateFields.$inc[`stats.onlineTimeByHour.${hour}`] = onlineDurationByHour[hour];
      }
    }
  }

  return updateFields;
};

const setupWebsocket = (app, server) => {
  const wss = new WebSocketServer({ server });
  const WEBHOOK_SECRET = "hamsterHub";

  const raidBoss = new RaidBoss();

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping(); // ส่ง ping ไปหา client
    });
  }, 30000); // ทุก 30 วินาที

  wss.on("connection", (ws, req) => {
    const parsedUrl = parse(req.url, true);
    const { token, event, secret, worldId, stageId, rewardTime: oldAfkRewardTime } = parsedUrl.query;

    // console.log("Old reward time:", oldAfkRewardTime);

    // if (worldId <= 0 || stageId <= 0) {
    if (worldId <= 0) {
      console.log(
        `WebSocket Unauthorized closed.. ${worldId} ${stageId}`,
      );
      return ws.close(1008, "Unauthorized");
    }

    if (secret !== WEBHOOK_SECRET) {
      console.log(
        `WebSocket Unauthorized closed.. headers={${secret} ${event} ${token}}`,
      );
      return ws.close(1008, "Unauthorized");
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
      if (err) {
        console.log(`Error connection: ${err}`);
        return ws.close(1008, "Unauthorized");
      }

      const userId = user.userId;

      console.log(`New connection: ${event || "unknown"} (${userId})`);

      let wsUserData = null;

      if (event === "raid" && userId) {
        if (raidBoss.active) {
          raidClients.set(ws, userId);

          ws.send(
            JSON.stringify({
              e: "RS",
              b: raidBoss.bossPrefabName,
              mH: raidBoss.maxHealth,
              h: raidBoss.health,
              d: raidBoss.damage,
            }),
          );
        } else ws.close();
      } else if (event === "overworld") {
        wsUserData = WsUserData.addNew(ws, worldId, userId, stageId, Date.now(), oldAfkRewardTime);

        if (raidBoss.active) {
          ws.send(
            JSON.stringify({
              e: "RS",
              b: raidBoss.bossPrefabName,
              mH: raidBoss.maxHealth,
              h: raidBoss.health,
              d: raidBoss.damage,
            }),
          );
        }

        // console.log(`Start afk time for ${userId}: ${wsUserData.afkRewardTime}`);

        ws.send(
          JSON.stringify({
            e: "AT",
            t: wsUserData.afkRewardTime
          }),
        );

        // await wsUserData.loadOtherPositions();
      } else {
        ws.close();
        return;
      }

      ws.connectedAt = Date.now();
      ws.userId = userId;
      ws.isAlive = true;
      ws.dataSaved = false;

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", async (message) => {
        let data;
        try {
          data = JSON.parse(message);
        } catch (err) {
          console.error("Invalid message:", message);
          return;
        }

        const { u: username, s: signal, sid: stageId, d: damage } = data;
        if (!signal) return;

        switch (signal) {
          // case "TD":
          //   if (!raidBoss.active || typeof damage !== "number" || damage <= 0) return;

          //   const updated = raidBoss.takeDamage(ws, userId, username, damage);

          //   if (updated) {
          //     console.log(
          //       `${userId} dealt ${damage} damage. Boss HP: ${raidBoss.health}`,
          //     );
          //     broadcast(raidClients.keys(), { e: "UBH", h: raidBoss.health });
          //   }

          //   if (raidBoss.health <= 0) {
          //     console.log(`Raid Ended. Players: ${raidBoss.playerJoins.size}`);
          //     const bossMaxHealth = raidBoss.maxHealth;
          //     const rewardId = raidBoss.rewardId;
          //     const playerJoins = raidBoss.playerJoins;
          //     raidBoss.deactivate();
          //     const activeSockets = [...playerJoins]
          //       .filter(([_, data]) => data.damage > 0)
          //       .map(([_, data]) => data.ws);
          //     const sortedPlayers = Array.from(raidBoss.playerJoins.entries())
          //       .map(([userId, data]) => ({ userId, username: data.username, damage: data.damage }))
          //       .sort((a, b) => b.damage - a.damage);
          //     const bestPlayer = {
          //       userId: sortedPlayers[0].userId,
          //       username: sortedPlayers[0].username,
          //       damage: sortedPlayers[0].damage,
          //       damagePercent: sortedPlayers[0].damage / bossMaxHealth * 100,
          //     };

          //     activeSockets.forEach(activeSocket => {
          //       activeSocket.send(
          //         JSON.stringify({
          //           e: "RE",
          //           w: true,
          //           r: rewardId,
          //           bu: bestPlayer.username,
          //           bd: bestPlayer.damagePercent,
          //         }),
          //       );
          //     });
          //     broadcast(
          //       Object.keys(raidClients).filter((item) =>
          //         !activeSockets.includes(item)
          //       ),
          //       {
          //         e: "RE",
          //         w: true,
          //         bu: bestPlayer.username,
          //         bd: bestPlayer.damagePercent,
          //       },
          //     );
          //     broadcast(WsUserData.getAllWs(), {
          //       e: "RE",
          //       w: true,
          //       bu: bestPlayer.username,
          //       bd: bestPlayer.damagePercent,
          //     });

          //     const scoreFields = ["python", "unity", "blender", "website"];

          //     const bulkOps = [];

          //     for (let i = 0; i < sortedPlayers.length; i++) {
          //       const username = sortedPlayers[i].username;
          //       const updated = {};

          //       for (const field of scoreFields) {
          //         if (raidBoss.topScoreReward[field]) {
          //           const scoreToAdd = raidBoss.topScoreReward[field]?.[i] || 0;
          //           updated[`score.${field}`] = scoreToAdd;
          //         }
          //       }

          //       if (Object.keys(updated).length > 0) {
          //         bulkOps.push({
          //           updateOne: {
          //             filter: { username },
          //             update: {
          //               $inc: updated,
          //             },
          //           },
          //         });
          //       }
          //     }

          //     if (bulkOps.length > 0) {
          //       await userModel.bulkWrite(bulkOps);
          //     }
          //   }
          //   break;

          case "UP":
            // await wsUserData.updatePosition(stageId);
            break;

          default:
            break;
        }
      });

      ws.on("close", async (code) => {
        if (ws.dataSaved) return;  // skip if already saved
        ws.dataSaved = true;

        // await wsUserData.updatePosition(-1);
        WsUserData.removeByWs(ws);

        if (raidClients.has(ws)) {
          raidClients.delete(ws);
        }

        const connectedAt = ws.connectedAt;
        const disconnectedAt = Date.now();

        const user = await userModel.findOne({ id: userId }).lean();

        const updateFields = calculateOnlineTime(connectedAt, disconnectedAt, user.stats.onlineTimeByHour);
        await userModel.updateOne({ id: userId }, updateFields, { upsert: true });
      });
    });
  });

  wss.on("close", () => {
    clearInterval(interval); // ล้างเมื่อ server ปิด
  });

  process.on("SIGINT", async () => {
    console.log("Server shutting down gracefully...");

    // Stop the interval for ping/pong if you want:
    clearInterval(interval);

    // Close all WS connections properly
    const closePromises = [];

    wss.clients.forEach(async (ws) => {
      if (ws.dataSaved) return;  // skip if already saved
      ws.dataSaved = true;

      // Perform the same logic as ws 'close' event
      WsUserData.removeByWs(ws);

      if (raidClients.has(ws)) {
        raidClients.delete(ws);
      }

      const connectedAt = ws.connectedAt || Date.now();
      const disconnectedAt = Date.now();
      
      const user = await userModel.findOne({ id: ws.userId }).lean();

      const updateFields = calculateOnlineTime(connectedAt, disconnectedAt, user.stats.onlineTimeByHour);

      // Save to DB - push promises to array to await all
      closePromises.push(userModel.updateOne({ id: ws.userId }, updateFields, { upsert: true }));

      // Close WS connection gracefully
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, "Server shutting down");
      }
    });

    try {
      await Promise.all(closePromises);
      console.log("All user data saved.");
    } catch (error) {
      console.error("Error saving user data on shutdown:", error);
    }

    // Close the WebSocket server
    wss.close(() => {
      console.log("WebSocket server closed.");
    });
  });

  // app.post("/raid/start", (req, res) => {
  //   const {
  //     bossPrefabName,
  //     maxHealth,
  //     health,
  //     damage,
  //     rewardId,
  //     topScoreReward,
  //     playerJoins,
  //   } = req.body;
  //   if (!bossPrefabName || !maxHealth || !damage) {
  //     return res.status(400).json({ error: "Missing data" });
  //   }

  //   if (raidBoss.active) {
  //     return res.status(400).json({ error: "Raid is active" });
  //   }

  //   raidBoss.activate(
  //     bossPrefabName,
  //     maxHealth,
  //     health ?? maxHealth,
  //     damage,
  //     rewardId,
  //     topScoreReward ?? [],
  //     playerJoins ?? [],
  //   );

  //   console.log(`Raid started: ${bossPrefabName} (${maxHealth}, ${damage})`);

  //   broadcast(WsUserData.getAllWs(), {
  //     e: "RS",
  //     b: bossPrefabName,
  //     mH: maxHealth,
  //     d: damage,
  //   });
  //   return res.json({ success: true });
  // });

  // app.post("/raid/stop", (req, res) => {
  //   raidBoss.deactivate();
  //   broadcast(WsUserData.getAllWs(), { e: "RE", w: false });
  //   broadcast(raidClients.keys(), { e: "RE", w: false });
  //   return res.json({ success: true });
  // });

  // app.get("/raid", (req, res) => {
  //   const sortedPlayers = Array.from(raidBoss.playerJoins.entries())
  //     .map(([userId, data]) => ({ userId, username: data.username, damage: data.damage }))
  //     .sort((a, b) => b.damage - a.damage);

  //   return res.json({
  //     active: raidBoss.active,
  //     boss: raidBoss.bossPrefabName,
  //     maxHealth: raidBoss.maxHealth,
  //     health: raidBoss.health,
  //     damage: raidBoss.damage,
  //     rewardId: raidBoss.rewardId,
  //     updateHealthChange: raidBoss.updateHealthChange,
  //     topScoreReward: raidBoss.topScoreReward,
  //     playerJoins: sortedPlayers,
  //   });
  // });

  // app.get("/raidManager", async (req, res) => {
  //   const sortedPlayers = Array.from(raidBoss.playerJoins.entries())
  //     .map(([userId, data]) => ({ userId, username: data.username, damage: data.damage }))
  //     .sort((a, b) => b.damage - a.damage);

  //   res.render("raid", {
  //     raidBoss: {
  //       active: raidBoss.active,
  //       boss: raidBoss.bossPrefabName,
  //       maxHealth: raidBoss.maxHealth,
  //       health: raidBoss.health,
  //       damage: raidBoss.damage,
  //       rewardId: raidBoss.rewardId,
  //       updateHealthChange: raidBoss.updateHealthChange,
  //       topScoreReward: raidBoss.topScoreReward,
  //       playerJoins: sortedPlayers,
  //     },
  //   });
  // });
};

const getWebSocketWithUserId = (userId) => {
  if (typeof userId === "string") {
    userId = Number.parseFloat(userId);
  }

  const ws = WsUserData.getWsByUserId(userId);

  return ws;
};

export { setupWebsocket, getWebSocketWithUserId, broadcast };
