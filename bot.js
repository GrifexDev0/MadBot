require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const QUESTIONS = "./questions.json";
const SCORES = "./scores.json";
const DAILY = "./daily.json";

// -------- UTILITIES --------
function load(file, fallback = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function generateDailyQuestions() {
  const questions = load(QUESTIONS);
  return [...questions].sort(() => Math.random() - 0.5).slice(0, 10);
}

function getDailyQuiz() {
  let daily = load(DAILY, {});

  if (daily.date !== today()) {
    daily = {
      date: today(),
      questions: generateDailyQuestions(),
    };
    save(DAILY, daily);
  }

  return daily.questions;
}

// -------- COMMANDS --------
const commands = [
  new SlashCommandBuilder()
    .setName("addquestion")
    .setDescription("Ajouter une question")
    .addStringOption((o) =>
      o.setName("question").setDescription("Question").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("answer").setDescription("Réponse").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("clearall")
    .setDescription("Supprimer toutes les questions"),

  new SlashCommandBuilder()
    .setName("startquiz")
    .setDescription("Commencer le quiz"),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Voir le classement"),

  new SlashCommandBuilder()
    .setName("resetscores")
    .setDescription("Réinitialiser le leaderboard"),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commandes enregistrées");
  } catch (err) {
    console.error(err);
  }
})();

// -------- READY --------
client.once("ready", () => {
  console.log(`MadBot connecté : ${client.user.tag}`);
});

// -------- INTERACTIONS --------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ADD QUESTION
  if (interaction.commandName === "addquestion") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "❌ Seuls les Admins peuvent ajouter des questions.",
        ephemeral: true,
      });
    }

    const questions = load(QUESTIONS);

    if (questions.length >= 10) {
      return interaction.reply({
        content: "❌ Maximum 10 questions.",
        ephemeral: true,
      });
    }

    questions.push({
      question: interaction.options.getString("question"),
      answer: interaction.options.getString("answer").toLowerCase(),
    });

    save(QUESTIONS, questions);

    return interaction.reply({
      content: `✅ Question ajoutée (${questions.length}/10)`,
      ephemeral: true,
    });
  }

  // CLEAR ALL QUESTIONS
  if (interaction.commandName === "clearall") {
    save(QUESTIONS, []);
    save(DAILY, {});
    return interaction.reply({
      content: "🧹 Toutes les questions supprimées.",
      ephemeral: true,
    });
  }

  // RESET SCORES
  if (interaction.commandName === "resetscores") {
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "❌ Permission refusée.",
        ephemeral: true,
      });
    }

    save(SCORES, []);
    return interaction.reply({
      content: "🏆 Leaderboard réinitialisé.",
      ephemeral: true,
    });
  }

  // START QUIZ
  if (interaction.commandName === "startquiz") {
    const questions = load(QUESTIONS);

    if (questions.length < 10) {
      return interaction.reply({
        content: "❌ Il faut exactement 10 questions.",
        ephemeral: true,
      });
    }

    let scores = load(SCORES);
    const userId = interaction.user.id;

    let player = scores.find((x) => x.userId === userId);

    if (player && player.lastPlayed === today()) {
      return interaction.reply({
        content: "❌ Tu as déjà joué aujourd'hui.",
        ephemeral: true,
      });
    }

    // create private channel
    // save score
    if (!player) {
      scores.push({
        userId,
        username: interaction.user.username,
        total: score,
        lastPlayed: today(),
      });
    } else {
      player.total += score;
      player.lastPlayed = today();
    }

    save(SCORES, scores);

    await quizChannel.send(`🏁 Quiz terminé ! Score : ${score}/10`);

    // delete after 30 sec
    setTimeout(async () => {
      try {
        await quizChannel.delete();
      } catch (err) {
        console.error(err);
      }
    }, 30000);
  }

  // LEADERBOARD
  if (interaction.commandName === "leaderboard") {
    const scores = load(SCORES)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const text = scores
      .map((u, i) => `${i + 1}. ${u.username} — ${u.total}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 MadBot Leaderboard")
      .setDescription(text || "Aucun score");

    return interaction.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
