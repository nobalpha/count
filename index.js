//TODO: Remove timeout check (Done)

require("dotenv").config();
const Discord = require("discord.js");
const { MongoClient } = require("mongodb");
const client = new Discord.Client();

let started = false;
let timer, counter, players;

const db_uri = "mongodb://localhost:27017/count";
const mongo_client = new MongoClient(db_uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongo_client.connect();

const stats_db = mongo_client.db("count").collection("stats");

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("switch", async (command, args) => {
  switch (command) {
    case "timeout":
      {
        const channel = args.channel || undefined;
        console.log("timeout");
        const info = "Timeout!! Game over...";
        client.emit("switch", "gameOver", { channel, info });
      }
      break;

    case "setTime":
      {
        const interval = args.interval || 2000;
        const channel = args.channel || undefined;
        client.emit("timer", interval, channel);
      }
      break;

    case "init":
      {
        const start = args.started || undefined;
        const channel = args.channel || undefined;
        timer && clearTimeout(timer);
        started = start;
        players = new Set();
        counter = 0;
        channel.send(`Game is ${start ? "started" : "stopped"}`);
        // if (started)
        //   client.emit("switch", "setTime", { interval: 2000, channel });
      }
      break;

    case "stats":
      {
        const channel = args.channel || undefined;
        const result = await stats_db.find({}).toArray();
        console.log(result);
        channel.send({ embed: generateEmbed(result) });
      }
      break;
    case "input":
      {
        const input = args.input || undefined;
        const message = args.message || undefined;
        const channel = message ? message.channel : undefined;

        // admin controls
        if (input.startsWith("?")) {
          const command = input.slice(1);

          switch (command) {
            case "start":
              client.emit("switch", "init", { channel, started: true });
              break;
            case "stop":
              client.emit("switch", "init", { channel, started: false });
              break;
            case "stats":
              client.emit("switch", "stats", { channel });
              break;
          }
        } else {
          const number = parseInt(input);
          if (started) {
            counter++;
            clearInterval(timer);
            players.add(message.author.tag);
            if (!(counter % 5)) {
              if (!(input.toUpperCase() === "BOOM")) {
                console.log("Game over");
                const info = "Wrong! Needed to be Boom...";
                client.emit("switch", "gameOver", { channel, info });
                return;
              }
            } else {
              if (!(Number.isInteger(number) && number === counter)) {
                console.log("Game over");
                const info = `Wrong! Needed to be ${counter}...`;
                client.emit("switch", "gameOver", { channel, info });
                return;
              }
            }
            console.log("Good job");
            client.emit("switch", "setTime", { interval: 2000, channel });
          }
        }
      }
      break;
    case "gameOver":
      {
        const info = args.info;
        const channel = args.channel;
        console.log(players);
        client.emit("switch", "init", { channel, start: false });
        channel.send(info);
        if (players) {
          console.log("hey");
          for (tag of players) {
            const result = await stats_db
              .find({
                client_tag: tag,
              })
              .toArray();

            console.log(result);

            if (!result.length) {
              const template = {
                client_tag: tag,
                score: 1,
              };

              await stats_db.insertOne(template, (err) => {
                if (err) throw err;
                console.log("Data wrote successfully");
              });

              return;
            }

            await stats_db.updateOne(
              { client_tag: tag },
              {
                $set: {
                  score: ++result[0].score,
                },
              },
              (err) => {
                if (err) throw err;
                console.log("Document updated sucessfully");
              }
            );

            return;
          }
        }
      }
      break;
  }
});

client.on("timer", (ms, channel) => {
  timer = setTimeout(() => {
    client.emit("switch", "timeout", { channel });
  }, ms);
});

client.on("message", (msg) => {
  // Admin commands
  if (msg.author.bot) return;

  const input = msg.content;
  const message = msg;
  const channel = msg.channel;
  console.log(input);
  console.log(message.author.tag);
  client.emit("switch", "input", { input, message, channel });
});

client.login(process.env.TOKEN);

const generateEmbed = (result) => {
  const output = result.map((r) => ({
    name: `<@!${r.client_tag}>`,
    value: r.score,
  }));
  console.log(output);
  return (Embed = {
    color: 0x00ff99,
    title: "Example",
    url: "https://discord.js.org",
    author: {
      name: "Roni",
      icon_url: "https://i.imgur.com/wSTFkRM.png",
      url: "https://discord.js.org",
    },
    description: "A descp...",
    thumbnail: { url: "https://i.imgur.com/wSTFkRM.png" },
    fields: output,
    timestamp: new Date(),
    footer: {
      text: "Example footer",
      icon_url: "https://i.imgur.com/wSTFkRM.png",
    },
  });
};
