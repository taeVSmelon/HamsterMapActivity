import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  const accessToken = req.header("Authorization");
  if (!accessToken) {
    return res.status(401).json({ error: "Missing access token" });
  }

  // Step 1: Verify your server JWT
  jwt.verify(accessToken, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Access token expired or invalid" });
    }

    req.username = user.username;

    // Step 2: Check Discord token
    if (req.discordAccessToken) {
      let discordResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${req.discordAccessToken}`,
        },
      });

      // Step 2.1: If Discord token expired (401), refresh it
      if (discordResponse.status === 401 && req.discordRefreshToken) {
        const refreshResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: process.env.VITE_DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: req.discordRefreshToken,
          }),
        });

        const refreshJson = await refreshResponse.json();

        if (refreshJson.access_token) {
          // update new accessToken and refreshToken
          req.discordAccessToken = refreshJson.access_token;
          req.discordRefreshToken = refreshJson.refresh_token;

          // try getting profile again with new token
          discordResponse = await fetch("https://discord.com/api/users/@me", {
            headers: {
              Authorization: `Bearer ${req.discordAccessToken}`,
            },
          });
        } else {
          return res.status(401).json({ error: "Failed to refresh Discord token" });
        }
      }

      if (discordResponse.ok) {
        const discordUser = await discordResponse.json();
        req.discordUser = discordUser; // ✅ SET user profile into request object
      } else {
        return res.status(400).json({ error: "Failed to fetch Discord user profile" });
      }
    }

    // Step 3: Continue to next
    next();
  });
};

const checkIsJson = (req, res, next) => {
  if (!req.is("application/json")) {
    return res.status(400).json({ error: "Request not JSON" });
  }
  next();
};

// const checkAdminPermission = async (req, res, next) => {
//   const user = await User.findOne({ _id: req.userId });
//   if (!user) return res.status(404).json({ error: "User not found" });
//   if (user.role !== "admin") {
//     return res.status(403).json({ error: "You don't have permission" });
//   }
//   req.user = user;
//   next();
// };

// module.exports = { authenticateToken, JWT_SECRET, checkIsJson, checkAdminPermission };

export { authenticateToken, JWT_SECRET, checkIsJson };
