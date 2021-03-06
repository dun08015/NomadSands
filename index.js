require("dotenv").config();

const express = require("express");
const router = express.Router();
const app = express();

const session = require("express-session");

const bcrypt = require("bcrypt");
const saltRounds = 2;

const multer = require("multer");
var upload = multer({
  dest: "public/uploads/",
});

const fetch = require("node-fetch");
const FormData = require("form-data");

const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const path = require("path");
app.use(express.static(__dirname + "/public"));

const MongoStore = require("connect-mongo")(session);
const MongoInterface = require("./mongoInterface.js");
const mongoInterface = new MongoInterface();

const DiscordInterface = require("./discordInterface.js");
const discordInterface = new DiscordInterface();
var discordClient = discordInterface.getClient();

discordClient.on("guildMemberAdd", (member) => {
  console.log(member.user.username + "just joined server" + member.guild.id);
});

mongoInterface.connect();

app.use(
  session({
    secret: process.env.SESSION_PASSWORD,
    store: new MongoStore({
      url:
        "mongodb://" +
        process.env.DB_USER +
        ":" +
        process.env.DB_PASSWORD +
        "@" +
        process.env.DB_HOST,
      dbName: "nomadSands",
    }),
  })
);

router.get("/discordLogin", (req, res) => {
  let state = req.session.id + "loginRequest";
  bcrypt.hash(state, saltRounds, (err, hash) => {
    res.redirect(
      "https://discordapp.com/api/oauth2/authorize?response_type=code&client_id=" +
        process.env.DISCORD_ID +
        "&scope=identify%20guilds&state=" +
        hash +
        "&redirect_uri=https%3A%2F%2Fwww.nomadsands.com%2Foauth%2Fredirect"
    );
  });
});

router.get("/oauth/redirect", (req, res) => {
  // user has given permission, time to use the returned code
  // from Discord to get the auth token for the user
  bcrypt
    .compare(req.session.id + "loginRequest", req.query.state)
    .then((result) => {
      if (result === true) {
        if (req.query.error) {
          console.log(req.query.error);
          console.log(req.query.error_description);
          res.redirect("/");
        } else {
          let requestToken = req.query.code;
          let token = {};
          let guildsTemp = {};

          const data = new FormData();
          data.append("client_id", process.env.DISCORD_ID);
          data.append("client_secret", process.env.DISCORD_PASSWORD);
          data.append("grant_type", "authorization_code");
          data.append("scope", "identify");
          data.append("scope", "guilds");
          data.append("scope", "guild.join");
          data.append(
            "redirect_uri",
            "https://www.nomadsands.com/oauth/redirect"
          );
          data.append("code", requestToken);

          fetch("https://discordapp.com/api/oauth2/token", {
            method: "POST",
            body: data,
          })
            .then((fetchResp) => fetchResp.json())
            .then((tokenData) => {
              token = tokenData;
              var fetchedUser = fetch("https://discordapp.com/api/users/@me", {
                headers: {
                  authorization: `${token.token_type} ${token.access_token}`,
                },
              });
              return fetchedUser;
            })
            .then((userData) => userData.json())
            .then((data) => {
              console.error("token type: " + token.token_type);

              //insert user data into database
              var jsonDoc = {
                userId: data.id,
                userName: data.username,
                userAvatar: data.avatar, //avatar should be retreived from discord as this will mismatch if user changes avatar later on discord
                sessionId: req.session.id,
                accessToken: token.access_token,
                tokenType: token.token_type,
                expiresIn: token.expires_in,
                refreshToken: token.refresh_token,
                scope: token.scope,
              };

              mongoInterface.insertDocument("visitorList", jsonDoc);
              //save session data for user authorization check on redirect
              req.session.username = data.username;
              req.session.avatar = data.avatar;
              req.session.userId = data.id;
            })
            .then(() => {
              fetch("https://discordapp.com/api/users/@me/guilds", {
                headers: {
                  authorization: `${token.token_type} ${token.access_token}`,
                },
              })
                .then((userGuilds) => userGuilds.json())
                .then((guilds) => {
                  req.session.guilds = guilds;
                  res.redirect("/");
                });
            });
        }
      } else {
        bcrypt
          .compare(req.session.id + "botAuth", req.query.state)
          .then((result) => {
            if (result === true) {
              if (req.query.error) {
                console.log(req.query.error);
                console.log(req.query.error_description);
                res.redirect("/");
              } else {
                let requestToken = req.query.code;

                const data = new FormData();
                data.append("client_id", process.env.DISCORD_ID);
                data.append("client_secret", process.env.DISCORD_PASSWORD);
                data.append("grant_type", "authorization_code");
                data.append("scope", "bot");
                data.append(
                  "redirect_uri",
                  "https://www.nomadsands.com/oauth/redirect"
                );
                data.append("code", requestToken);

                fetch("https://discordapp.com/api/oauth2/token", {
                  method: "POST",
                  body: data,
                })
                  .then((fetchResp) => fetchResp.json())
                  .then((tokenData) => {
                    console.log(tokenData);
                    res.redirect("/");
                  });
              }
            }
          });
      }
    });
});

//check if users are logged in before routing
app.use(["/createMatch", "/myMatches", "/logout"], (req, res, next) => {
  if (!req.session.userId) {
    res.sendFile(path.join(__dirname, "/html/non-authenticated/home.html"));
  } else {
    next();
  }
});

router.get("/", (req, res) => {
  if (!req.session.username) {
    res.sendFile(path.join(__dirname, "/html/non-authenticated/home.html"));
  } else {
    res.sendFile(path.join(__dirname, "/html/authenticated/home_auth.html"));
  }
});

router.get("/getUser", (req, res) => {
  res.send(req.session.username);
});

router.get("/getUserAvatar", (req, res) => {
  res.send(
    "https://cdn.discordapp.com/avatars/" +
      req.session.userId +
      "/" +
      req.session.avatar +
      ".png"
  );
});

router.get("/viewMatches", (req, res) => {
  res.sendFile(path.join(__dirname, "/html/non-authenticated/matchList.html"));
});

router.get("/allMatches", async (req, res) => {
  var matchList = await mongoInterface.findAllMatches(req.query.term);
  for (var key in matchList) {
    let match = matchList[key];
    var avatar = await discordInterface.getUserAvatar(
      match.discordServer,
      match.organizerUserId
    );
    if (avatar) {
      match.organizerAvatar = avatar;
    }
  }
  res.send([req.session.username, matchList]);
});

router.get("/findMatches", async (req, res) => {
  var matchList = await mongoInterface.searchMatches(req.query.searchParm);
  for (var key in matchList) {
    let match = matchList[key];
    var avatar = await discordInterface.getUserAvatar(
      match.discordServer,
      match.organizerUserId
    );
    match.organizerAvatar = avatar;
  }
  res.send([req.session.username, matchList]);
});

router.post("/joinMatch", (req, res) => {
  discordInterface.createInvite(req.body.guildId).then((val) => {
    res.send(val);
  });
});

router.post("/deleteMatch", (req, res) => {
  mongoInterface.deleteMatch(req.body.matchId).then((val) => {
    res.send(val);
  });
});

router.get("/getUserGuilds", async (req, res) => {
  let result = [];
  if (req.session.guilds) {
    for (let i = 0; i < req.session.guilds.length; i++) {
      let partialGuild = req.session.guilds[i];
      if (partialGuild.owner === true) {
        var membership = await discordInterface.isBotMember(partialGuild.id);
        partialGuild["botIsMember"] = membership;
        result.push(partialGuild);
      }
    }
  } else {
    console.log("no guilds exist");
  }
  res.send(result);
});

router.get("/discordBotAuth", (req, res) => {
  let guildID = req.query.guildID;
  let state = req.session.id + "botAuth";
  bcrypt.hash(state, saltRounds, (err, hash) => {
    res.redirect(
      "https://discordapp.com/api/oauth2/authorize?response_type=code&client_id=" +
        process.env.DISCORD_ID +
        "&scope=bot&permissions=1&state=" +
        hash +
        "&guild_id=" +
        guildID +
        "&redirect_uri=https%3A%2F%2Fwww.nomadsands.com%2Foauth%2Fredirect"
    );
  });
});

router.get("/autocomplete", (req, res) => {
  mongoInterface.findGames(req.query.term).then((val) => {
    res.send(val);
  });
});

router.post(
  "/newMatchWithThumbnail",
  upload.single("matchThumbnail"),
  (req, res) => {
    var jsonDoc = {
      matchThumbnail: "uploads/" + req.file.filename,
      gameName: req.body.gameName,
      matchOrganizer: req.session.username,
      maxPlayers: req.body.maxPlayers,
      playerCount: 0,
      matchTitle: req.body.matchTitle,
      matchDate: req.body.matchDate,
      matchTime: req.body.matchTime,
    };

    mongoInterface.insertDocument("matchList", jsonDoc).then((val) => {
      res.send(val);
    });
  }
);

router.post("/newMatch", upload.none(), (req, res) => {
  var jsonDoc = {
    matchThumbnail: req.body.matchThumbnail,
    gameName: req.body.gameName,
    matchOrganizer: req.session.username,
    organizerAvatar: req.session.avatar,
    organizerUserId: req.session.userId,
    maxPlayers: req.body.maxPlayers,
    playerCount: 0,
    matchTitle: req.body.matchTitle,
    matchDate: req.body.matchDate,
    matchTime: req.body.matchTime,
    discordServer: req.body.discordServerID,
    botIsMember: false,
  };

  mongoInterface.insertDocument("matchList", jsonDoc).then((result) => {
    res.send([req.session.username, result]);
  });
});

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return console.log(err);
    }
    res.redirect("/");
  });
});

app.use("/", router);
app.listen(3000, "localhost");
