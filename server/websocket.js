import { WebSocketServer } from "ws";
import { parse } from "url";
import jwt from "jsonwebtoken";
import RaidBoss from "./classes/raid.js";
import userModel from "./models/user.js";
import { authenticateToken, JWT_SECRET } from "./middlewares/authenticateToken.js";
import WsUserData from "./classes/wsUserData.js";

const raidClients = new Map(); // ws => username

const setupWebsocket = (app, server) => {
  const wss = new WebSocketServer({ server });
  const WEBHOOK_SECRET = "hamsterHub";

  const raidBoss = new RaidBoss();

  function broadcast(clients, payload) {
    const message = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  wss.on("connection", (ws, req) => {
    const parsedUrl = parse(req.url, true);
    const { token, event, secret, worldId, stageId } = parsedUrl.query;

    if (worldId <= 0 || stageId <= 0)
      return ws.close(1008, "Unauthorized");

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
        wsUserData = WsUserData.addNew(ws, worldId, userId, stageId, Date.now());

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

        ws.send(
          JSON.stringify({
            e: "AT",
            t: wsUserData.afkRewardTime
          }),
        );

        await wsUserData.loadOtherPositions();
      } else {
        ws.close();
        return;
      }

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
          case "TD":
            if (!raidBoss.active || typeof damage !== "number" || damage <= 0) return;

            const updated = raidBoss.takeDamage(ws, userId, username, damage);

            if (updated) {
              console.log(
                `${userId} dealt ${damage} damage. Boss HP: ${raidBoss.health}`,
              );
              broadcast(raidClients.keys(), { e: "UBH", h: raidBoss.health });
            }

            if (raidBoss.health <= 0) {
              console.log(`Raid Ended. Players: ${raidBoss.playerJoins.size}`);
              const bossMaxHealth = raidBoss.maxHealth;
              const rewardId = raidBoss.rewardId;
              const playerJoins = raidBoss.playerJoins;
              raidBoss.deactivate();
              const activeSockets = [...playerJoins]
                .filter(([_, data]) => data.damage > 0)
                .map(([_, data]) => data.ws);
              const sortedPlayers = Array.from(raidBoss.playerJoins.entries())
                .map(([userId, data]) => ({ userId, username: data.username, damage: data.damage }))
                .sort((a, b) => b.damage - a.damage);
              const bestPlayer = {
                userId: sortedPlayers[0].userId,
                username: sortedPlayers[0].username,
                damage: sortedPlayers[0].damage,
                damagePercent: sortedPlayers[0].damage / bossMaxHealth * 100,
              };

              activeSockets.forEach(activeSocket => {
                activeSocket.send(
                  JSON.stringify({
                    e: "RE",
                    w: true,
                    r: rewardId,
                    bu: bestPlayer.username,
                    bd: bestPlayer.damagePercent,
                  }),
                );
              });
              broadcast(
                Object.keys(raidClients).filter((item) =>
                  !activeSockets.includes(item)
                ),
                {
                  e: "RE",
                  w: true,
                  bu: bestPlayer.username,
                  bd: bestPlayer.damagePercent,
                },
              );
              broadcast(WsUserData.getAllWs(), {
                e: "RE",
                w: true,
                bu: bestPlayer.username,
                bd: bestPlayer.damagePercent,
              });

              const scoreFields = ["python", "unity", "blender", "website"];

              const bulkOps = [];

              for (let i = 0; i < sortedPlayers.length; i++) {
                const username = sortedPlayers[i].username;
                const updated = {};

                for (const field of scoreFields) {
                  if (raidBoss.topScoreReward[field]) {
                    const scoreToAdd = raidBoss.topScoreReward[field]?.[i] || 0;
                    updated[`score.${field}`] = scoreToAdd;
                  }
                }

                if (Object.keys(updated).length > 0) {
                  bulkOps.push({
                    updateOne: {
                      filter: { username },
                      update: {
                        $inc: updated,
                      },
                    },
                  });
                }
              }

              if (bulkOps.length > 0) {
                await userModel.bulkWrite(bulkOps);
              }
            }
            break;

          case "UP":
            await wsUserData.updatePosition(stageId);
            break;
        }
      });

      ws.on("close", async () => {
        await wsUserData.updatePosition(-1);
        WsUserData.removeByWs(ws);

        if (raidClients.has(ws)) {
          raidClients.delete(ws);
        }
      });
    });
  });

  app.post("/raid/start", (req, res) => {
    const {
      bossPrefabName,
      maxHealth,
      health,
      damage,
      rewardId,
      topScoreReward,
      playerJoins,
    } = req.body;
    if (!bossPrefabName || !maxHealth || !damage) {
      return res.status(400).json({ error: "Missing data" });
    }

    if (raidBoss.active) {
      return res.status(400).json({ error: "Raid is active" });
    }

    raidBoss.activate(
      bossPrefabName,
      maxHealth,
      health ?? maxHealth,
      damage,
      rewardId,
      topScoreReward ?? [],
      playerJoins ?? [],
    );

    console.log(`Raid started: ${bossPrefabName} (${maxHealth}, ${damage})`);

    broadcast(WsUserData.getAllWs(), {
      e: "RS",
      b: bossPrefabName,
      mH: maxHealth,
      d: damage,
    });
    return res.json({ success: true });
  });

  app.post("/raid/stop", (req, res) => {
    raidBoss.deactivate();
    broadcast(WsUserData.getAllWs(), { e: "RE", w: false });
    broadcast(raidClients.keys(), { e: "RE", w: false });
    return res.json({ success: true });
  });

  app.get("/raid", (req, res) => {
    const sortedPlayers = Array.from(raidBoss.playerJoins.entries())
      .map(([userId, data]) => ({ userId, username: data.username, damage: data.damage }))
      .sort((a, b) => b.damage - a.damage);

    return res.json({
      active: raidBoss.active,
      boss: raidBoss.bossPrefabName,
      maxHealth: raidBoss.maxHealth,
      health: raidBoss.health,
      damage: raidBoss.damage,
      rewardId: raidBoss.rewardId,
      updateHealthChange: raidBoss.updateHealthChange,
      topScoreReward: raidBoss.topScoreReward,
      playerJoins: sortedPlayers,
    });
  });

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

function getWebSocketWithUserId(userId) {
  if (typeof userId === "string") {
    userId = Number.parseFloat(userId);
  }

  const ws = WsUserData.getWsByUserId(userId);

  return ws;
}

export { setupWebsocket, getWebSocketWithUserId };
